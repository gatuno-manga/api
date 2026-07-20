#!/bin/bash

# Script para fazer backup do volume rustfs-data (RustFS / MinIO)
# Estratégia: deduplicação via hardlinks — arquivos idênticos entre backups
# ocupam espaço em disco apenas uma vez (ideal para volumes com muitas imagens).
#
# Uso: ./backup-api-data.sh [diretório-de-destino] [opções]
#
# Opções:
#   -r N    Manter apenas os últimos N backups (padrão: 5)
#   -s      Parar container do RustFS durante backup (consistência total)
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
QUIET=false
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="rustfs-backup-${TIMESTAMP}"
LOG_FILE=""

# ============================================
# Funções utilitárias
# ============================================

show_help() {
    echo "Uso: $0 [diretório-de-destino] [opções]"
    echo ""
    echo "Opções:"
    echo "  -r N    Manter apenas os últimos N backups (padrão: 5)"
    echo "  -s      Parar container do RustFS durante backup"
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
        docker compose stop -t 0 rustfs 2>/dev/null || true
        docker compose start rustfs 2>/dev/null || true
    fi

    # Limpar diretório incompleto se o backup falhou
    if [ $exit_code -ne 0 ] && [ -n "${INPROGRESS_PATH:-}" ]; then
        if [ -d "${INPROGRESS_PATH}" ]; then
            log "⚠️  Falha detectada (código: $exit_code). Removendo backup incompleto..."
            rm -rf "${INPROGRESS_PATH}" 2>/dev/null || true
        fi
    fi
}

du_real() { du -sh --apparent-size "$1" 2>/dev/null | cut -f1; }
du_disk() { du -sh "$1" 2>/dev/null | cut -f1; }

# ============================================
# Parse de argumentos
# ============================================

if [ $# -gt 0 ] && [[ ! "${1:-}" =~ ^- ]]; then
    BACKUP_DIR="$1"
    shift
fi

while getopts "r:sqh" opt; do
    case $opt in
        r) MAX_BACKUPS=$OPTARG ;;
        s) STOP_CONTAINER=true ;;
        q) QUIET=true ;;
        h) show_help; exit 0 ;;
        *) show_help; exit 1 ;;
    esac
done

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
# Obter path real do volume no host (elimina overhead Docker)
# ─────────────────────────────────────────────────────────
VOLUME_HOST_PATH=$(docker volume inspect "${VOLUME_NAME}" --format '{{.Mountpoint}}' 2>/dev/null)

if [ -z "${VOLUME_HOST_PATH}" ] || [ ! -d "${VOLUME_HOST_PATH}" ]; then
    log "❌ Erro: Não foi possível localizar o path do volume no host"
    log "   Volume inspect retornou: '${VOLUME_HOST_PATH:-<vazio>}'"
    log "   Verifique se o Docker tem permissão para inspecionar volumes"
    exit 1
fi

log "   📂 Volume host path: ${VOLUME_HOST_PATH}"

mkdir -p "${BACKUP_DIR}"
LOG_FILE="${BACKUP_DIR}/backup-${TIMESTAMP}.log"
log "📝 Log: ${LOG_FILE}"
log "✅ Pré-requisitos OK"
log ""

# ============================================
# Análise do volume e espaço
# ============================================

log "📊 Analisando volume ${VOLUME_NAME}..."

VOLUME_KB=$(du -sk "${VOLUME_HOST_PATH}" 2>/dev/null | cut -f1 || echo 0)
VOLUME_KB=${VOLUME_KB:-0}
FILE_COUNT=$(find "${VOLUME_HOST_PATH}" -type f 2>/dev/null | wc -l || echo 0)
FILE_COUNT=${FILE_COUNT:-0}

log "📊 Informações do volume:"
log "   💾 Tamanho total: $((VOLUME_KB / 1024))MB"
log "   📄 Arquivos: ${FILE_COUNT}"

LATEST_BACKUP_DATA=$(ls -1dt "${BACKUP_DIR}"/rustfs-backup-*/data 2>/dev/null | head -n1 || true)
if [ -n "${LATEST_BACKUP_DATA}" ]; then
    PREV_FILE_COUNT=$(find "${LATEST_BACKUP_DATA}" -type f 2>/dev/null | wc -l || echo 0)
    log "   📦 Backup anterior: ${PREV_FILE_COUNT} arquivos (hardlinks reutilizados)"
fi
log ""

AVAILABLE_KB=$(df -Pk "${BACKUP_DIR}" | tail -n1 | awk '{print $4}')
if [ "${VOLUME_KB}" -gt "${AVAILABLE_KB}" ]; then
    log "❌ Erro: Espaço em disco potencialmente insuficiente"
    log "   Volume: $((VOLUME_KB / 1024))MB"
    log "   Disponível: $((AVAILABLE_KB / 1024))MB"
    log "   Nota: Com deduplicação o espaço real necessário pode ser menor"
    exit 1
fi

log "💾 Espaço em disco: OK ($((AVAILABLE_KB / 1024))MB disponível)"
log ""

# ============================================
# Parar container (se solicitado)
# ============================================

CONTAINER_STOPPED=false
INPROGRESS_PATH=""
trap cleanup EXIT

if [ "$STOP_CONTAINER" = true ]; then
    log "⏸️  Parando container do RustFS para consistência..."
    if docker compose stop rustfs 2>/dev/null; then
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
    log "   Referência: $(dirname "${LATEST_BACKUP_DATA}" | xargs basename)"
    LINK_DEST_ARG="--link-dest=$(realpath "${LATEST_BACKUP_DATA}")"
else
    log "   🔗 Primeiro backup (sem deduplicação)"
fi

log "   Origem: ${VOLUME_HOST_PATH}"
log "   Destino: ${INPROGRESS_PATH}/data/"
log ""

START_TS=$(date +%s)

# rsync direto: host path → backup dir, sem container intermediário
rsync -a --no-owner --no-group \
    ${LINK_DEST_ARG} \
    "${VOLUME_HOST_PATH}/" \
    "${INPROGRESS_PATH}/data/"

END_TS=$(date +%s)
ELAPSED=$((END_TS - START_TS))
log "   ✓ rsync concluído em ${ELAPSED}s"
log ""

# ============================================
# Gerar manifesto de checksums
# ============================================

log "🔐 Gerando manifesto de checksums..."

find "${INPROGRESS_PATH}/data" -type f | sort | \
    xargs sha256sum 2>/dev/null | \
    sed "s|${INPROGRESS_PATH}/data/||" \
    > "${INPROGRESS_PATH}/manifest.sha256" &

HASH_PID=$!
if [ "$QUIET" = false ]; then
    spinner "$HASH_PID" "Calculando SHA256..."
else
    wait "$HASH_PID"
fi

# ============================================
# Gravar metadados do backup
# ============================================

TOTAL_FILES=$(find "${INPROGRESS_PATH}/data" -type f | wc -l)
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

mapfile -t ALL_BACKUPS < <(ls -1dt "${BACKUP_DIR}"/rustfs-backup-* 2>/dev/null | grep -v '\.inprogress$' || true)
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

# ============================================
# Relatório final
# ============================================

FINAL_APPARENT=$(du_real "${BACKUP_PATH}/data")
FINAL_DISK=$(du_disk "${BACKUP_PATH}/data")
MANIFEST_LINES=$(wc -l < "${BACKUP_PATH}/manifest.sha256")
TOTAL_DISK=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1 || echo "N/A")

log "════════════════════════════════════════════════════"
log "✅ BACKUP CONCLUÍDO COM SUCESSO!"
log "════════════════════════════════════════════════════"
log "📦 Backup:           ${BACKUP_PATH}"
log "📄 Arquivos:         ${MANIFEST_LINES}"
log "⏱️  Tempo:            ${ELAPSED}s"
log "📐 Tamanho aparente: ${FINAL_APPARENT}"
log "💾 Tamanho em disco: ${FINAL_DISK}"
log ""
log "📊 Uso total dos ${#ALL_BACKUPS[@]} backups retidos: ${TOTAL_DISK}"
log ""
log "📝 Log:              ${LOG_FILE}"
log "📋 Manifesto:        ${BACKUP_PATH}/manifest.sha256"
log "ℹ️  Info:             ${BACKUP_PATH}/info.txt"
log "════════════════════════════════════════════════════"
