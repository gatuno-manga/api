#!/bin/bash

# Script para fazer backup do volume rustfs-data (RustFS / MinIO)
# Estratégia: deduplicação via hardlinks — arquivos idênticos entre backups
# ocupam espaço em disco apenas uma vez (ideal para volumes com muitas imagens).
# O manifesto de checksums também é incremental: arquivos que o rsync não
# precisou transferir (por já estarem no --link-dest) reaproveitam o hash do
# manifesto anterior em vez de serem relidos do disco.
#
# Uso: ./backup-api-data.sh [diretório-de-destino] [opções]
#
# Opções:
#   -r N    Manter apenas os últimos N backups (padrão: 5)
#   -s      Parar container do RustFS durante backup (consistência total)
#   -t      Calcular e mostrar o uso total do diretório de backups (mais lento)
#   -q      Modo silencioso
#   -h      Mostrar ajuda
#
# Estrutura de saída:
#   <BACKUP_DIR>/
#     rustfs-backup-20260717_120000/   ← diretório do backup
#       data/                          ← espelho do volume (hardlinks para backup anterior)
#       manifest.sha256                ← checksums de todos os arquivos
#       info.txt                       ← metadados do backup
#     rustfs-backup-20260717_000000/   ← backup anterior (hardlinks apontam para cá)
#     ...

set -euo pipefail

# Carregar utilitário de verificação/instalação de ferramentas
# shellcheck source=_tools-check.sh
source "$(dirname "$(realpath "$0")")/_tools-check.sh"

# ============================================
# Configurações
# ============================================
VOLUME_NAME="gatuno_rustfs_data"
BACKUP_DIR="./backups"
MAX_BACKUPS=5
STOP_CONTAINER=false
SHOW_TOTAL=false
QUIET=false
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="rustfs-backup-${TIMESTAMP}"
LOG_FILE=""
ROOT_DIR="$(cd "$(dirname "$(realpath "$0")")/../.." && pwd)"

# ============================================
# Funções utilitárias
# ============================================

show_help() {
    echo "Uso: $0 [diretório-de-destino] [opções]"
    echo ""
    echo "Opções:"
    echo "  -r N    Manter apenas os últimos N backups (padrão: 5)"
    echo "  -s      Parar container do RustFS durante backup"
    echo "  -t      Calcular uso total do diretório de backups (mais lento)"
    echo "  -q      Modo silencioso"
    echo "  -h      Mostrar esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  $0                      # Backup para ./backups"
    echo "  $0 /mnt/storage         # Backup para /mnt/storage"
    echo "  $0 -r 3 -s              # Manter 3 backups, parar RustFS"
    echo ""
    echo "Sobre o espaço em disco:"
    echo "  Arquivos idênticos entre backups são armazenados apenas uma vez via"
    echo "  hardlinks. Deletar um backup só libera espaço dos arquivos exclusivos"
    echo "  daquele backup (não referenciados por outros)."
    echo ""
    echo "Docker Compose:"
    echo "  Defina GATUNO_COMPOSE_FILES (ex: 'docker-compose.common.yml:docker-compose.prod.yml')"
    echo "  para -s funcionar em produção. Sem isso, assume common+dev."
}

log() {
    local message="${1:-}"
    local timestamp
    timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    if [ -n "${LOG_FILE:-}" ]; then
        echo "[$timestamp] $message" >> "$LOG_FILE"
    fi
    if [ "${QUIET:-false}" = false ]; then
        echo "$message"
    fi
}

spinner() {
    local pid=${1:-}
    local desc="${2:-Processando}"
    local chars='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0
    if [ -z "$pid" ]; then return; fi
    while kill -0 "$pid" 2>/dev/null; do
        printf "\r%s %s" "${chars:$i:1}" "$desc"
        i=$(( (i + 1) % ${#chars} ))
        sleep 0.1
    done
    printf "\r✓ %-50s\n" "$desc"
}

cleanup() {
    local exit_code=$?

    # Reiniciar container se foi parado
    if [ "${STOP_CONTAINER}" = true ] && [ "${CONTAINER_STOPPED:-false}" = true ]; then
        log "🔄 Reiniciando container do RustFS..."
        docker compose "${COMPOSE_ARGS[@]}" stop -t 0 rustfs 2>/dev/null || true
        docker compose "${COMPOSE_ARGS[@]}" start rustfs 2>/dev/null || true
    fi

    # Limpar diretório incompleto se o backup falhou (ou foi interrompido)
    if [ $exit_code -ne 0 ] && [ -n "${INPROGRESS_PATH:-}" ]; then
        if [ -d "${INPROGRESS_PATH}" ]; then
            log "⚠️  Falha detectada (código: $exit_code). Removendo backup incompleto..."
            rm -rf "${INPROGRESS_PATH}" 2>/dev/null || docker run --rm -v "$(realpath "${BACKUP_DIR}"):/backups" alpine rm -rf "/backups/$(basename "${INPROGRESS_PATH}")" 2>/dev/null || true
        fi
    fi
}

du_real() { du -sh --apparent-size "$1" 2>/dev/null | cut -f1; }
du_disk() { du -sh "$1" 2>/dev/null | cut -f1; }

# Encontra o backup completo mais recente (exclui .inprogress e backups sem
# info.txt, que indicam uma execução anterior interrompida).
find_latest_complete_backup() {
    local dir="$1"
    local d
    while IFS= read -r -d '' d; do
        if [ -f "${d}/info.txt" ]; then
            echo "${d}"
            return
        fi
    done < <(find "${dir}" -maxdepth 1 -type d -name 'rustfs-backup-*' ! -name '*.inprogress' -print0 2>/dev/null | sort -rz)
}

# Gera manifest.sha256 de forma incremental: arquivos que o rsync não marcou
# como transferidos (portanto vieram do --link-dest, ou já existiam idênticos)
# reaproveitam o hash do manifesto anterior. Só os transferidos/novos são
# relidos do disco. Se algo não bater, recalcula tudo (rede de segurança).
build_manifest() {
    export LC_ALL=C
    local data_dir="$1"
    local out_manifest="$2"
    local prev_manifest="$3"
    local transferred_file="$4"
    local work_dir
    work_dir="$(dirname "${data_dir}")"

    local filelist="${work_dir}/.filelist.tmp"
    find "${data_dir}" -type f -printf '%P\n' | sort > "${filelist}"
    local total_files
    total_files=$(wc -l < "${filelist}")

    if [ -n "${prev_manifest}" ] && [ -f "${prev_manifest}" ] && [ "${total_files}" -gt 0 ]; then
        local transferred_sorted="${work_dir}/.transferred.sorted.tmp"
        LC_ALL=C sort -u "${transferred_file}" > "${transferred_sorted}"

        # Arquivos do backup atual que o rsync NÃO precisou transferir
        # (candidatos a reaproveitar hash do manifesto anterior)
        local reuse_candidates="${work_dir}/.reuse_candidates.tmp"
        comm -23 "${filelist}" "${transferred_sorted}" > "${reuse_candidates}"

        # Linhas do manifesto anterior cujo caminho está nos candidatos
        # (formato sha256sum: 64 chars de hash + 2 espaços + caminho)
        local reused="${work_dir}/.reused.tmp"
        awk 'NR==FNR{want[$0]=1; next} { if (substr($0,67) in want) print }' \
            "${reuse_candidates}" "${prev_manifest}" > "${reused}"

        local reused_paths="${work_dir}/.reused_paths.tmp"
        awk '{print substr($0,67)}' "${reused}" | LC_ALL=C sort > "${reused_paths}"

        # O que sobrou (novo ou transferido) precisa de hash calculado agora
        local need_hash="${work_dir}/.need_hash.tmp"
        comm -23 "${filelist}" "${reused_paths}" > "${need_hash}"

        local fresh="${work_dir}/.fresh.tmp"
        hash_filelist "${need_hash}" "${data_dir}" "${fresh}"

        cat "${reused}" "${fresh}" > "${out_manifest}"

        rm -f "${transferred_sorted}" "${reuse_candidates}" "${reused}" "${reused_paths}" "${need_hash}" "${fresh}"

        local manifest_lines
        manifest_lines=$(wc -l < "${out_manifest}")
        if [ "${manifest_lines}" -ne "${total_files}" ]; then
            log "   ⚠️  Manifesto incremental incompleto (${manifest_lines}/${total_files} arquivos) — recalculando tudo"
            hash_filelist "${filelist}" "${data_dir}" "${out_manifest}"
        fi
    else
        hash_filelist "${filelist}" "${data_dir}" "${out_manifest}"
    fi

    rm -f "${filelist}"
}

# ============================================
# Parse de argumentos
# ============================================

if [ $# -gt 0 ] && [[ ! "${1:-}" =~ ^- ]]; then
    BACKUP_DIR="$1"
    shift
fi

while getopts "r:stqh" opt; do
    case $opt in
        r) MAX_BACKUPS=$OPTARG ;;
        s) STOP_CONTAINER=true ;;
        t) SHOW_TOTAL=true ;;
        q) QUIET=true ;;
        h) show_help; exit 0 ;;
        *) show_help; exit 1 ;;
    esac
done

resolve_compose_args "${ROOT_DIR}"

# ============================================
# Validações prévias
# ============================================

log "🔍 Verificando pré-requisitos..."

if ! docker info >/dev/null 2>&1; then
    log "❌ Erro: Docker não está rodando ou sem permissão"
    exit 1
fi

ensure_tools rsync sha256sum

# Verificar se o volume existe
if ! docker volume inspect "${VOLUME_NAME}" >/dev/null 2>&1; then
    log "❌ Erro: Volume ${VOLUME_NAME} não existe"
    log "   Volumes disponíveis:"
    docker volume ls --format "   - {{.Name}}" | grep -i gatuno || echo "   Nenhum volume gatuno encontrado"
    exit 1
fi

# ─────────────────────────────────────────────────────────
# Obter path real do volume no host ou usar fallback Docker
# ─────────────────────────────────────────────────────────
VOLUME_HOST_PATH=$(docker volume inspect "${VOLUME_NAME}" --format '{{.Mountpoint}}' 2>/dev/null || true)
USE_DOCKER_VOLUME=false

if [ -n "${VOLUME_HOST_PATH}" ] && [ -d "${VOLUME_HOST_PATH}" ] && [ -r "${VOLUME_HOST_PATH}" ]; then
    log "   📂 Volume host path: ${VOLUME_HOST_PATH}"
else
    log "   🐳 Volume acessado via container Docker (mountpoint restrito no host)"
    USE_DOCKER_VOLUME=true
    VOLUME_HOST_PATH="docker://${VOLUME_NAME}"
fi

mkdir -p "${BACKUP_DIR}"
LOG_FILE="${BACKUP_DIR}/backup-${TIMESTAMP}.log"
log "📝 Log: ${LOG_FILE}"
log "✅ Pré-requisitos OK"
log ""

# ============================================
# Limpar backups .inprogress órfãos de execuções anteriores
# (interrupções deixam esses diretórios para trás; eles nunca devem ser
# usados como referência de --link-dest nem contados na retenção)
# ============================================

mapfile -t ORPHANED < <(find "${BACKUP_DIR}" -maxdepth 1 -type d -name 'rustfs-backup-*.inprogress' 2>/dev/null || true)
if [ ${#ORPHANED[@]} -gt 0 ]; then
    log "🧹 Removendo ${#ORPHANED[@]} backup(s) .inprogress órfão(s) de execuções anteriores..."
    for orphan in "${ORPHANED[@]}"; do
        log "   $(basename "${orphan}")"
        rm -rf "${orphan}" 2>/dev/null || docker run --rm -v "$(realpath "${BACKUP_DIR}"):/backups" alpine rm -rf "/backups/$(basename "${orphan}")" 2>/dev/null || true
    done
    log ""
fi

# ============================================
# Análise do volume e espaço
# ============================================

log "📊 Analisando volume ${VOLUME_NAME}..."

if [ "$USE_DOCKER_VOLUME" = true ]; then
    VOLUME_KB=$(docker run --rm -v "${VOLUME_NAME}:/src:ro" alpine du -sk /src 2>/dev/null | cut -f1 || echo 0)
else
    VOLUME_KB=$(du -sk "${VOLUME_HOST_PATH}" 2>/dev/null | cut -f1 || echo 0)
fi
VOLUME_KB=${VOLUME_KB:-0}

log "📊 Informações do volume:"
log "   💾 Tamanho total: $((VOLUME_KB / 1024))MB"

LATEST_BACKUP=$(find_latest_complete_backup "${BACKUP_DIR}")
LATEST_BACKUP_DATA=""
if [ -n "${LATEST_BACKUP}" ]; then
    LATEST_BACKUP_DATA="${LATEST_BACKUP}/data"
    if [ -f "${LATEST_BACKUP}/manifest.sha256" ]; then
        PREV_FILE_COUNT=$(wc -l < "${LATEST_BACKUP}/manifest.sha256")
        log "   📦 Backup anterior: ${PREV_FILE_COUNT} arquivos (hardlinks reutilizados: $(basename "${LATEST_BACKUP}"))"
    fi
fi
log ""

# Com --link-dest, arquivos idênticos são hardlinked (não ocupam espaço novo);
# só precisamos de margem para os arquivos novos/alterados, não do volume inteiro.
if [ -n "${LATEST_BACKUP_DATA}" ]; then
    REQUIRED_KB=$((VOLUME_KB / 10))
    MIN_MARGIN_KB=$((1024 * 1024)) # 1GB
    if [ "${REQUIRED_KB}" -lt "${MIN_MARGIN_KB}" ]; then REQUIRED_KB=${MIN_MARGIN_KB}; fi
else
    REQUIRED_KB=${VOLUME_KB}
fi

AVAILABLE_KB=$(df -Pk "${BACKUP_DIR}" | tail -n1 | awk '{print $4}')
if [ "${REQUIRED_KB}" -gt "${AVAILABLE_KB}" ]; then
    log "❌ Erro: Espaço em disco potencialmente insuficiente"
    log "   Necessário (estimado): $((REQUIRED_KB / 1024))MB"
    log "   Disponível: $((AVAILABLE_KB / 1024))MB"
    exit 1
fi

log "💾 Espaço em disco: OK ($((AVAILABLE_KB / 1024))MB disponível)"
log ""

# ============================================
# Parar container (se solicitado)
# ============================================

CONTAINER_STOPPED=false
INPROGRESS_PATH=""
trap cleanup EXIT INT TERM

if [ "$STOP_CONTAINER" = true ]; then
    log "⏸️  Parando container do RustFS para consistência..."
    if docker compose "${COMPOSE_ARGS[@]}" stop rustfs 2>/dev/null; then
        CONTAINER_STOPPED=true
        log "   Container parado com sucesso"
    else
        log "   ⚠️  Aviso: Não foi possível parar o container"
    fi
    log ""
fi

# ============================================
# Criar backup com deduplicação via hardlinks
# Uma única passagem de rsync — sem staging intermediário
# ============================================

BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
INPROGRESS_PATH="${BACKUP_PATH}.inprogress"
mkdir -p "${INPROGRESS_PATH}/data"

log "🔗 Criando backup com deduplicação via hardlinks..."

LINK_DEST_ARG=""
if [ -n "${LATEST_BACKUP_DATA}" ] && [ -d "${LATEST_BACKUP_DATA}" ]; then
    log "   Referência: $(basename "${LATEST_BACKUP}")"
    LINK_DEST_ARG="--link-dest=$(realpath "${LATEST_BACKUP_DATA}")"
else
    log "   🔗 Primeiro backup (sem deduplicação)"
fi

log "   Origem: ${VOLUME_HOST_PATH}"
log "   Destino: ${INPROGRESS_PATH}/data/"
log ""

START_TS=$(date +%s)

# rsync direto ou via container Docker (se host path for restrito).
# --out-format='%n' registra os arquivos efetivamente transferidos (novos ou
# alterados); arquivos que só foram hardlinked via --link-dest não aparecem
# aqui — é essa lista que torna o manifesto incremental.
if [ "$USE_DOCKER_VOLUME" = true ]; then
    DOCKER_LINK_MOUNT=()
    DOCKER_LINK_OPT=""
    if [ -n "${LATEST_BACKUP_DATA}" ] && [ -d "${LATEST_BACKUP_DATA}" ]; then
        DOCKER_LINK_MOUNT=("-v" "$(realpath "${LATEST_BACKUP_DATA}"):/link-dest:ro")
        DOCKER_LINK_OPT="--link-dest=/link-dest"
    fi

    if ! docker run --rm \
        -v "${VOLUME_NAME}:/volume-src:ro" \
        -v "$(realpath "${INPROGRESS_PATH}/data"):/volume-dest" \
        "${DOCKER_LINK_MOUNT[@]}" \
        alpine sh -c "apk add --no-cache rsync >/dev/null 2>&1 && rsync -a --no-owner --no-group ${DOCKER_LINK_OPT} --out-format='%n' /volume-src/ /volume-dest/ && chmod -R u+rwX,go+rX /volume-dest"; then
        log "❌ Erro: rsync via Docker falhou"
        exit 1
    fi > "${INPROGRESS_PATH}/.transferred"
else
    if ! rsync -a --no-owner --no-group \
        ${LINK_DEST_ARG} \
        --out-format='%n' \
        "${VOLUME_HOST_PATH}/" \
        "${INPROGRESS_PATH}/data/" > "${INPROGRESS_PATH}/.transferred"; then
        log "❌ Erro: rsync falhou"
        exit 1
    fi
fi

END_TS=$(date +%s)
ELAPSED=$((END_TS - START_TS))
TRANSFERRED_COUNT=$(wc -l < "${INPROGRESS_PATH}/.transferred")
log "   ✓ rsync concluído em ${ELAPSED}s (${TRANSFERRED_COUNT} arquivo(s) transferido(s))"
log ""

# ============================================
# Gerar manifesto de checksums (incremental)
# ============================================

log "🔐 Gerando manifesto de checksums..."

PREV_MANIFEST=""
if [ -n "${LATEST_BACKUP}" ] && [ -f "${LATEST_BACKUP}/manifest.sha256" ]; then
    PREV_MANIFEST="${LATEST_BACKUP}/manifest.sha256"
fi

build_manifest "${INPROGRESS_PATH}/data" "${INPROGRESS_PATH}/manifest.sha256" \
    "${PREV_MANIFEST}" "${INPROGRESS_PATH}/.transferred" &

HASH_PID=$!
if [ "$QUIET" = false ]; then
    spinner "$HASH_PID" "Calculando checksums..."
fi
wait "$HASH_PID"

rm -f "${INPROGRESS_PATH}/.transferred"

# ============================================
# Gravar metadados do backup
# ============================================

TOTAL_FILES=$(wc -l < "${INPROGRESS_PATH}/manifest.sha256")
APPARENT_SIZE=$(du_real "${INPROGRESS_PATH}/data")
DISK_SIZE=$(du_disk "${INPROGRESS_PATH}/data")

cat > "${INPROGRESS_PATH}/info.txt" << EOF
backup_name:      ${BACKUP_NAME}
volume_name:      ${VOLUME_NAME}
volume_host_path: ${VOLUME_HOST_PATH}
timestamp:        ${TIMESTAMP}
created_at:       $(date -Iseconds)
elapsed_seconds:  ${ELAPSED}
total_files:      ${TOTAL_FILES}
transferred:      ${TRANSFERRED_COUNT}
apparent_size:    ${APPARENT_SIZE}
disk_size:        ${DISK_SIZE}
link_dest:        ${LATEST_BACKUP_DATA:-none}
EOF

# ============================================
# Finalizar backup (renomear de .inprogress)
# ============================================

mv "${INPROGRESS_PATH}" "${BACKUP_PATH}"
INPROGRESS_PATH=""  # limpar para não deletar no cleanup

log "   ✅ Backup finalizado"
log ""

# ============================================
# Política de retenção
# ============================================

mapfile -t ALL_BACKUPS < <(find "${BACKUP_DIR}" -maxdepth 1 -type d -name 'rustfs-backup-*' ! -name '*.inprogress' 2>/dev/null | sort -r || true)
BACKUP_COUNT=${#ALL_BACKUPS[@]}

if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    log "🗑️  Aplicando política de retenção (máximo: ${MAX_BACKUPS})..."
    TO_REMOVE=("${ALL_BACKUPS[@]:$MAX_BACKUPS}")
    for old_backup in "${TO_REMOVE[@]}"; do
        FREED=$(du_disk "${old_backup}")
        log "   Removendo: $(basename "${old_backup}") (${FREED} em disco)"
        rm -rf "${old_backup}"
    done
    log "   ✅ ${BACKUP_COUNT} → ${MAX_BACKUPS} backups"
    log ""
fi

# Poda de logs de execuções antigas (backup-*.log soltos no diretório),
# mesma retenção dos backups.
mapfile -t OLD_LOGS < <(find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'backup-*.log' 2>/dev/null | sort -r || true)
if [ "${#OLD_LOGS[@]}" -gt "$MAX_BACKUPS" ]; then
    for old_log in "${OLD_LOGS[@]:$MAX_BACKUPS}"; do
        rm -f "${old_log}"
    done
fi

# ============================================
# Relatório final
# ============================================

MANIFEST_LINES=$(wc -l < "${BACKUP_PATH}/manifest.sha256")

log "════════════════════════════════════════════════════"
log "✅ BACKUP CONCLUÍDO COM SUCESSO!"
log "════════════════════════════════════════════════════"
log "📦 Backup:           ${BACKUP_PATH}"
log "📄 Arquivos:         ${MANIFEST_LINES} (${TRANSFERRED_COUNT} transferido(s))"
log "⏱️  Tempo:            ${ELAPSED}s"
log "📐 Tamanho aparente: ${APPARENT_SIZE}"
log "💾 Tamanho em disco: ${DISK_SIZE}"
log ""

if [ "$SHOW_TOTAL" = true ]; then
    TOTAL_DISK=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1 || echo "N/A")
    log "📊 Uso total dos ${#ALL_BACKUPS[@]} backups retidos: ${TOTAL_DISK}"
    log ""
fi

log "📝 Log:              ${LOG_FILE}"
log "📋 Manifesto:        ${BACKUP_PATH}/manifest.sha256"
log "ℹ️  Info:             ${BACKUP_PATH}/info.txt"
log "════════════════════════════════════════════════════"
