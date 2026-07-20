#!/bin/bash

# Script para restaurar o volume rustfs a partir do novo formato de backup em diretório
# Uso: ./restore-api-data.sh [diretório-de-backup] [opções]
#
# O argumento pode ser:
#   - Um diretório de backup específico: ./backups/rustfs-backup-20260717_120000
#   - O diretório pai de backups:        ./backups   (lista disponíveis e pede escolha)
#   - Omitido:                           lista backups em ./backups e pede escolha
#
# Opções:
#   -s      Parar container rustfs antes do restore
#   -f      Forçar (sem confirmação interativa)
#   -v      Verificar manifest.sha256 antes de restaurar
#   -q      Modo silencioso
#   -h      Mostrar ajuda

set -euo pipefail

# Source da verificação de ferramentas (rsync_with_fallback, ensure_tools, etc.)
# shellcheck source=./_tools-check.sh
source "$(dirname "$0")/_tools-check.sh"

# ============================================
# Configurações
# ============================================

VOLUME_NAME="gatuno_rustfs_data"
COMPOSE_FILE="docker-compose.dev.yml"
STOP_CONTAINER=false
FORCE=false
VERIFY_MANIFEST=false
QUIET=false
BACKUP_DIR=""
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE=""
CONTAINER_STOPPED=false

# ============================================
# Funções utilitárias
# ============================================

log() {
    local message="$1"
    local ts
    ts=$(date "+%Y-%m-%d %H:%M:%S")
    if [ -n "$LOG_FILE" ]; then
        echo "[$ts] $message" >> "$LOG_FILE"
    fi
    if [ "$QUIET" = false ]; then
        echo "$message"
    fi
}

show_help() {
    cat <<EOF
Uso: $0 [diretório-de-backup] [opções]

  Se [diretório-de-backup] for omitido ou apontar para o diretório pai de backups,
  o script lista os backups disponíveis e pede para o usuário escolher.

  O diretório de backup deve conter:
    data/            ← conteúdo do volume
    manifest.sha256  ← checksums dos arquivos
    info.txt         ← metadados (opcional)

Opções:
  -s      Parar container rustfs antes do restore
  -f      Forçar restauração (sem confirmação interativa)
  -v      Verificar manifest.sha256 antes de restaurar
  -q      Modo silencioso
  -h      Mostrar esta ajuda

Exemplos:
  $0
  $0 ./backups
  $0 ./backups/rustfs-backup-20260717_120000
  $0 ./backups/rustfs-backup-20260717_120000 -s -v -f
EOF
}

# Lista backups disponíveis em um diretório pai e pede ao usuário para escolher.
# Preenche BACKUP_DIR com o selecionado.
pick_backup_from_dir() {
    local parent_dir="$1"
    local backups=()

    while IFS= read -r -d '' entry; do
        backups+=("$entry")
    done < <(find "$parent_dir" -maxdepth 1 -type d -name 'rustfs-backup-*' -print0 | sort -z)

    if [ ${#backups[@]} -eq 0 ]; then
        echo "❌ Nenhum backup encontrado em: $parent_dir"
        echo "   Esperado: ${parent_dir}/rustfs-backup-*/"
        exit 1
    fi

    echo "📋 Backups disponíveis em $(realpath "$parent_dir"):"
    echo ""
    local index=1
    for backup in "${backups[@]}"; do
        local name
        name=$(basename "$backup")
        local info_file="${backup}/info.txt"
        local size_info=""
        if [ -d "${backup}/data" ]; then
            size_info=$(du -sh "${backup}/data" 2>/dev/null | cut -f1 || echo "?")
        fi
        local extra=""
        if [ -f "$info_file" ]; then
            extra=$(grep -i "^date\|^timestamp\|^files\|^data_" "$info_file" 2>/dev/null | head -2 | tr '\n' ' ' || true)
        fi
        printf "  [%d] %s  (%s)  %s\n" "$index" "$name" "$size_info" "$extra"
        index=$((index + 1))
    done

    echo ""
    local choice
    read -rp "Escolha o número do backup [1-${#backups[@]}]: " choice

    if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt ${#backups[@]} ]; then
        echo "❌ Escolha inválida: $choice"
        exit 1
    fi

    BACKUP_DIR="${backups[$((choice - 1))]}"
}

# Limpa e reinicia o container se foi parado
cleanup() {
    if [ "$STOP_CONTAINER" = true ] && [ "$CONTAINER_STOPPED" = true ]; then
        log ""
        log "🔄 Reiniciando container rustfs..."
        docker compose -f "$COMPOSE_FILE" start rustfs 2>/dev/null || true
    fi
}

# ============================================
# Parse de argumentos
# ============================================

# Primeiro argumento posicional (não começa com '-') é o diretório de backup ou pai
if [ "${1:-}" ] && [[ ! "${1:-}" =~ ^- ]]; then
    BACKUP_DIR="$1"
    shift
fi

while getopts "sfvqh" opt; do
    case $opt in
        s) STOP_CONTAINER=true ;;
        f) FORCE=true ;;
        v) VERIFY_MANIFEST=true ;;
        q) QUIET=true ;;
        h) show_help; exit 0 ;;
        *) show_help; exit 1 ;;
    esac
done

# ============================================
# Resolução do diretório de backup
# ============================================

DEFAULT_BACKUPS_DIR="./backups"

if [ -z "$BACKUP_DIR" ]; then
    # Sem argumento: listar em ./backups
    if [ ! -d "$DEFAULT_BACKUPS_DIR" ]; then
        echo "❌ Diretório padrão de backups não encontrado: $DEFAULT_BACKUPS_DIR"
        echo "   Informe o caminho: $0 <diretório-de-backup>"
        exit 1
    fi
    pick_backup_from_dir "$DEFAULT_BACKUPS_DIR"
elif [ -d "$BACKUP_DIR" ] && [ ! -f "${BACKUP_DIR}/manifest.sha256" ]; then
    # Argumento é um diretório pai (não tem manifest.sha256 diretamente)
    pick_backup_from_dir "$BACKUP_DIR"
fi

# ============================================
# Validação do diretório de backup
# ============================================

if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Diretório de backup não encontrado: $BACKUP_DIR"
    exit 1
fi

BACKUP_ABS=$(cd "$BACKUP_DIR" && pwd)

if [ ! -d "${BACKUP_ABS}/data" ]; then
    echo "❌ Diretório de dados não encontrado: ${BACKUP_ABS}/data"
    echo "   O backup deve conter um subdiretório 'data/'."
    exit 1
fi

if [ ! -f "${BACKUP_ABS}/manifest.sha256" ]; then
    echo "❌ Arquivo de manifesto não encontrado: ${BACKUP_ABS}/manifest.sha256"
    echo "   O backup deve conter 'manifest.sha256'."
    exit 1
fi

# Configurar log no diretório pai do backup
PARENT_DIR=$(dirname "$BACKUP_ABS")
LOG_FILE="${PARENT_DIR}/restore-${TIMESTAMP}.log"

# ============================================
# Pré-requisitos
# ============================================

log "🔍 Verificando pré-requisitos..."

# Verificar ferramentas necessárias (rsync é o único crítico; tem fallback Docker)
ensure_tools rsync

if ! docker info > /dev/null 2>&1; then
    log "❌ Erro: Docker não está rodando ou sem permissão de acesso."
    exit 1
fi

if ! docker volume inspect "$VOLUME_NAME" > /dev/null 2>&1; then
    log "   ⚠️  Volume ${VOLUME_NAME} não existe. Criando..."
    docker volume create "$VOLUME_NAME"
    log "   ✅ Volume criado."
fi

log "✅ Pré-requisitos OK"
log "📝 Log: ${LOG_FILE}"
log ""

# ============================================
# Verificação de manifest.sha256 (opcional com -v)
# ============================================

if [ "$VERIFY_MANIFEST" = true ]; then
    log "🔐 Verificando integridade via manifest.sha256..."

    # sha256sum -c espera que os caminhos no manifest sejam relativos ao CWD
    pushd "${BACKUP_ABS}" > /dev/null
    if sha256sum -c "manifest.sha256" --quiet 2>&1 | tee -a "$LOG_FILE"; then
        log "   ✅ Todos os arquivos verificados com sucesso."
    else
        log "❌ Falha na verificação do manifest.sha256. Abort."
        popd > /dev/null
        exit 1
    fi
    popd > /dev/null
    log ""
fi

# ============================================
# Informações do backup
# ============================================

BACKUP_NAME=$(basename "$BACKUP_ABS")
DATA_SIZE=$(du -sh "${BACKUP_ABS}/data" 2>/dev/null | cut -f1 || echo "?")
FILE_COUNT=$(find "${BACKUP_ABS}/data" -type f 2>/dev/null | wc -l)

log "📊 Informações do backup:"
log "   📦 Nome:    ${BACKUP_NAME}"
log "   💾 Tamanho: ${DATA_SIZE}"
log "   📁 Arquivos: ${FILE_COUNT}"

if [ -f "${BACKUP_ABS}/info.txt" ]; then
    log ""
    log "   📄 info.txt:"
    while IFS= read -r line; do
        log "      ${line}"
    done < "${BACKUP_ABS}/info.txt"
fi

log ""

# ============================================
# Estado atual do volume
# ============================================

log "📊 Volume atual (${VOLUME_NAME}):"
CURRENT_FILES=$(docker run --rm \
    -v "${VOLUME_NAME}:/data" \
    alpine \
    sh -c 'find /data -type f 2>/dev/null | wc -l')
log "   📁 Arquivos no volume: ${CURRENT_FILES}"
log ""

# ============================================
# Confirmação interativa
# ============================================

if [ "$FORCE" = false ]; then
    echo "⚠️  ATENÇÃO: Esta operação irá sobrescrever o conteúdo do volume '${VOLUME_NAME}'."
    echo ""
    echo "   Volume atual:  ${CURRENT_FILES} arquivos"
    echo "   Backup:        ${FILE_COUNT} arquivos  (${DATA_SIZE})  [${BACKUP_NAME}]"
    echo ""
    read -rp "Deseja continuar? (s/N): " -n 1 REPLY
    echo
    if [[ ! "$REPLY" =~ ^[Ss]$ ]]; then
        log "Operação cancelada pelo usuário."
        exit 0
    fi
    echo ""
fi

log "🔄 Iniciando restauração..."
log ""

# ============================================
# Parar container rustfs (se -s)
# ============================================

trap cleanup EXIT

if [ "$STOP_CONTAINER" = true ]; then
    log "⏸️  Parando container rustfs..."
    if docker compose -f "$COMPOSE_FILE" stop rustfs 2>/dev/null; then
        CONTAINER_STOPPED=true
        log "   ✅ Container parado."
    else
        log "   ⚠️  Aviso: Não foi possível parar o container (pode não estar rodando)."
    fi
    log ""
fi

# ============================================
# Restauração: copiar data/ para o volume via Docker
# ============================================
#
# Estratégia: montar o diretório de backup do host e o volume Docker no mesmo
# container Alpine e usar rsync -a --delete para sincronizar /source/ → /target/.
# Isso evita qualquer extração intermediária e aproveita rsync_with_fallback.

log "💾 Restaurando ${BACKUP_NAME} → ${VOLUME_NAME}..."

DATA_ABS="${BACKUP_ABS}/data"

docker run --rm \
    -v "${VOLUME_NAME}:/target" \
    -v "${DATA_ABS}:/source:ro" \
    alpine \
    sh -c 'apk add --no-cache rsync > /dev/null 2>&1 && rsync -a --delete /source/ /target/'

RESTORE_EXIT=$?

if [ "$RESTORE_EXIT" -ne 0 ]; then
    log "❌ ERRO: Restauração falhou (rsync retornou ${RESTORE_EXIT})."
    exit "$RESTORE_EXIT"
fi

log "   ✅ Cópia concluída."
log ""

# ============================================
# Verificação pós-restore
# ============================================

log "🔍 Verificação final no volume..."

POST_CHECK=$(docker run --rm \
    -v "${VOLUME_NAME}:/data" \
    alpine \
    sh -c '
        FILES=$(find /data -type f 2>/dev/null | wc -l)
        DIRS=$(find /data -type d 2>/dev/null | wc -l)
        SIZE=$(du -sh /data 2>/dev/null | cut -f1)
        echo "${FILES}|${DIRS}|${SIZE}"
    ')

FINAL_FILES=$(echo "$POST_CHECK" | cut -d'|' -f1)
FINAL_DIRS=$(echo "$POST_CHECK" | cut -d'|' -f2)
FINAL_SIZE=$(echo "$POST_CHECK" | cut -d'|' -f3)

log "   📁 Arquivos: ${FINAL_FILES}"
log "   📂 Diretórios: ${FINAL_DIRS}"
log "   💾 Tamanho: ${FINAL_SIZE}"
log ""

INTEGRITY_OK=true
if [ "$FILE_COUNT" -gt 0 ]; then
    DIFF=$(( FILE_COUNT - FINAL_FILES ))
    if [ "$DIFF" -lt 0 ]; then DIFF=$(( -DIFF )); fi
    TOLERANCE=$(( FILE_COUNT * 2 / 100 ))
    if [ "$TOLERANCE" -lt 1 ]; then TOLERANCE=1; fi

    if [ "$DIFF" -gt "$TOLERANCE" ]; then
        log "⚠️  AVISO: Diferença significativa de arquivos!"
        log "   Esperado (backup): ${FILE_COUNT}"
        log "   Encontrado (vol):  ${FINAL_FILES}"
        log "   Diferença: ${DIFF} arquivos"
        log ""
        INTEGRITY_OK=false
    else
        log "   ✅ Integridade OK (diferença: ${DIFF} arquivo(s))."
        log ""
    fi
fi

# ============================================
# Resumo final
# ============================================

log "════════════════════════════════════════════"
if [ "$INTEGRITY_OK" = true ]; then
    log "✅ RESTAURAÇÃO CONCLUÍDA COM SUCESSO!"
else
    log "⚠️  RESTAURAÇÃO CONCLUÍDA COM AVISOS"
fi
log "════════════════════════════════════════════"
log "📦 Backup:             ${BACKUP_NAME}"
log "📁 Arquivos no volume: ${FINAL_FILES}"
log "💾 Tamanho no volume:  ${FINAL_SIZE}"
log "📝 Log:                ${LOG_FILE}"

if [ "$CONTAINER_STOPPED" = true ]; then
    log ""
    log "🔄 Container rustfs será reiniciado automaticamente (trap EXIT)..."
else
    log ""
    log "💡 Reinicie o container para aplicar as mudanças:"
    log "   docker compose -f ${COMPOSE_FILE} restart rustfs"
fi

log "════════════════════════════════════════════"

if [ "$INTEGRITY_OK" = false ]; then
    exit 2
fi
