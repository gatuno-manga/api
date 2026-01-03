#!/bin/bash

# Script para fazer backup do volume api-data
# Uso: ./backup-api-data.sh [diretório-de-destino] [opções]
#
# Opções:
#   -r N    Manter apenas os últimos N backups (padrão: 5)
#   -s      Parar container da API durante backup (consistência)
#   -q      Modo silencioso (sem barra de progresso)
#   -h      Mostrar ajuda

set -e

# ============================================
# Configurações
# ============================================
VOLUME_NAME="gatuno_api-data"
BACKUP_DIR="./backups"
MAX_BACKUPS=5
STOP_CONTAINER=false
QUIET=false
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="api-data-backup-${TIMESTAMP}.tar.gz"
LOG_FILE=""

# ============================================
# Funções utilitárias
# ============================================

show_help() {
    echo "Uso: $0 [diretório-de-destino] [opções]"
    echo ""
    echo "Opções:"
    echo "  -r N    Manter apenas os últimos N backups (padrão: 5)"
    echo "  -s      Parar container da API durante backup"
    echo "  -q      Modo silencioso"
    echo "  -h      Mostrar esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  $0                      # Backup para ./backups"
    echo "  $0 /mnt/storage         # Backup para /mnt/storage"
    echo "  $0 -r 10 -s             # Manter 10 backups, parar API"
}

log() {
    local message="$1"
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    if [ -n "$LOG_FILE" ]; then
        echo "[$timestamp] $message" >> "$LOG_FILE"
    fi
    if [ "$QUIET" = false ]; then
        echo "$message"
    fi
}

log_inline() {
    local message="$1"
    if [ "$QUIET" = false ]; then
        echo -ne "$message"
    fi
}

# Barra de progresso visual
# Uso: progress_bar <atual> <total> <descrição>
progress_bar() {
    local current=$1
    local total=$2
    local desc="${3:-Processando}"
    local width=30

    if [ "$total" -eq 0 ]; then
        total=1
    fi

    local percent=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))

    # Construir barra
    local bar=""
    for ((i=0; i<filled; i++)); do bar="${bar}█"; done
    for ((i=0; i<empty; i++)); do bar="${bar}░"; done

    printf "\r%s [%s] %3d%% (%d/%d)" "$desc" "$bar" "$percent" "$current" "$total"
}

# Spinner animado
spinner() {
    local pid=$1
    local desc="${2:-Processando}"
    local chars='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0

    while kill -0 "$pid" 2>/dev/null; do
        printf "\r%s %s" "${chars:$i:1}" "$desc"
        i=$(( (i + 1) % ${#chars} ))
        sleep 0.1
    done
    printf "\r✓ %s          \n" "$desc"
}

cleanup() {
    # Reiniciar container se foi parado
    if [ "$STOP_CONTAINER" = true ] && [ "$CONTAINER_STOPPED" = true ]; then
        log "🔄 Reiniciando container da API..."
        docker-compose -f docker-compose.dev.yml start api 2>/dev/null || true
    fi
}

# ============================================
# Parse de argumentos
# ============================================

# Primeiro argumento pode ser o diretório
if [ -n "$1" ] && [[ ! "$1" =~ ^- ]]; then
    BACKUP_DIR="$1"
    shift
fi

# Parse das opções
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

# Verificar se Docker está rodando
if ! docker info >/dev/null 2>&1; then
    log "❌ Erro: Docker não está rodando ou sem permissão"
    exit 1
fi

# Verificar se o volume existe
if ! docker volume inspect "${VOLUME_NAME}" >/dev/null 2>&1; then
    log "❌ Erro: Volume ${VOLUME_NAME} não existe"
    log "   Volumes disponíveis:"
    docker volume ls --format "   - {{.Name}}" | grep -i gatuno || echo "   Nenhum volume gatuno encontrado"
    exit 1
fi

# Criar diretório de backup se não existir
mkdir -p "${BACKUP_DIR}"

# Configurar arquivo de log
LOG_FILE="${BACKUP_DIR}/backup-${TIMESTAMP}.log"
log "📝 Log: ${LOG_FILE}"

log "✅ Pré-requisitos OK"
log ""

# ============================================
# Análise do volume
# ============================================

log "📊 Analisando volume ${VOLUME_NAME}..."

VOLUME_INFO=$(docker run --rm -v ${VOLUME_NAME}:/data alpine sh -c "
  TOTAL_FILES=\$(find /data -type f 2>/dev/null | wc -l)
  TOTAL_DIRS=\$(find /data -type d 2>/dev/null | wc -l)
  TOTAL_SIZE=\$(du -sh /data 2>/dev/null | cut -f1)
  TOTAL_BYTES=\$(du -sb /data 2>/dev/null | cut -f1)
  echo \"\$TOTAL_FILES|\$TOTAL_DIRS|\$TOTAL_SIZE|\$TOTAL_BYTES\"
")

TOTAL_FILES=$(echo "$VOLUME_INFO" | cut -d'|' -f1)
TOTAL_DIRS=$(echo "$VOLUME_INFO" | cut -d'|' -f2)
TOTAL_SIZE=$(echo "$VOLUME_INFO" | cut -d'|' -f3)
TOTAL_BYTES=$(echo "$VOLUME_INFO" | cut -d'|' -f4)

log "📊 Informações do volume:"
log "   📁 Arquivos: ${TOTAL_FILES}"
log "   📂 Diretórios: ${TOTAL_DIRS}"
log "   💾 Tamanho total: ${TOTAL_SIZE}"
log ""

# Verificar espaço em disco disponível
AVAILABLE_KB=$(df -P "${BACKUP_DIR}" | tail -1 | awk '{print $4}')
REQUIRED_KB=$((TOTAL_BYTES / 1024))

if [ "$REQUIRED_KB" -gt "$AVAILABLE_KB" ]; then
    log "❌ Erro: Espaço em disco insuficiente"
    log "   Necessário: $((REQUIRED_KB / 1024))MB"
    log "   Disponível: $((AVAILABLE_KB / 1024))MB"
    exit 1
fi

log "💾 Espaço em disco: OK ($((AVAILABLE_KB / 1024))MB disponível)"
log ""

# ============================================
# Parar container (se solicitado)
# ============================================

CONTAINER_STOPPED=false
trap cleanup EXIT

if [ "$STOP_CONTAINER" = true ]; then
    log "⏸️  Parando container da API para consistência..."
    if docker-compose -f docker-compose.dev.yml stop api 2>/dev/null; then
        CONTAINER_STOPPED=true
        log "   Container parado com sucesso"
    else
        log "   ⚠️  Aviso: Não foi possível parar o container"
    fi
    log ""
fi

# ============================================
# Criar backup com barra de progresso
# ============================================

log "💾 Criando backup..."
log "📁 Destino: ${BACKUP_DIR}/${BACKUP_FILE}"
log ""

# Criar backup usando container Alpine com progresso
docker run --rm \
  -v ${VOLUME_NAME}:/data:ro \
  -v "$(cd "${BACKUP_DIR}" && pwd):/backup" \
  -e TOTAL_FILES="${TOTAL_FILES}" \
  -e BACKUP_FILE="${BACKUP_FILE}" \
  -e QUIET="${QUIET}" \
  alpine \
  sh -c '
    cd /data

    # Função para barra de progresso
    show_progress() {
        current=$1
        total=$2
        width=30

        if [ "$total" -eq 0 ]; then total=1; fi

        percent=$((current * 100 / total))
        filled=$((current * width / total))
        empty=$((width - filled))

        bar=""
        i=0
        while [ $i -lt $filled ]; do
            bar="${bar}█"
            i=$((i + 1))
        done
        while [ $i -lt $width ]; do
            bar="${bar}░"
            i=$((i + 1))
        done

        printf "\r📦 Compactando [%s] %3d%%" "$bar" "$percent"
    }

    # Monitorar progresso em background
    if [ "$QUIET" != "true" ]; then
        (
            while [ ! -f /backup/${BACKUP_FILE} ]; do sleep 0.5; done

            prev_size=0
            stall_count=0

            while [ -f /backup/${BACKUP_FILE}.tmp ] || [ $stall_count -lt 3 ]; do
                if [ -f /backup/${BACKUP_FILE} ]; then
                    current_size=$(stat -c%s /backup/${BACKUP_FILE} 2>/dev/null || echo 0)
                    # Estimar progresso baseado no tamanho (compressão ~30%)
                    estimated_final=$(('"${TOTAL_BYTES}"' * 30 / 100))
                    if [ $estimated_final -gt 0 ]; then
                        percent=$((current_size * 100 / estimated_final))
                        if [ $percent -gt 100 ]; then percent=100; fi

                        width=30
                        filled=$((percent * width / 100))

                        bar=""
                        i=0
                        while [ $i -lt $filled ]; do
                            bar="${bar}█"
                            i=$((i + 1))
                        done
                        while [ $i -lt $width ]; do
                            bar="${bar}░"
                            i=$((i + 1))
                        done

                        size_mb=$((current_size / 1024 / 1024))
                        printf "\r📦 Compactando [%s] %3d%% (%dMB)" "$bar" "$percent" "$size_mb"
                    fi

                    if [ "$current_size" -eq "$prev_size" ]; then
                        stall_count=$((stall_count + 1))
                    else
                        stall_count=0
                    fi
                    prev_size=$current_size
                fi
                sleep 0.5
            done
        ) &
        PROGRESS_PID=$!
    fi

    # Criar arquivo temporário primeiro
    touch /backup/${BACKUP_FILE}.tmp

    # Criar arquivo tar
    tar czf /backup/${BACKUP_FILE} . 2>/dev/null
    EXIT_CODE=$?

    # Remover marcador temporário
    rm -f /backup/${BACKUP_FILE}.tmp

    # Parar monitor de progresso
    if [ "$QUIET" != "true" ] && [ -n "$PROGRESS_PID" ]; then
        kill $PROGRESS_PID 2>/dev/null || true
        wait $PROGRESS_PID 2>/dev/null || true
    fi

    printf "\r✅ Compactação concluída                              \n"
    exit $EXIT_CODE
  '

log ""

# ============================================
# Verificar integridade do backup
# ============================================

log "🔍 Verificando integridade do backup..."

if ! tar tzf "${BACKUP_DIR}/${BACKUP_FILE}" >/dev/null 2>&1; then
    log "❌ Erro: Backup corrompido! Removendo arquivo..."
    rm -f "${BACKUP_DIR}/${BACKUP_FILE}"
    exit 1
fi

BACKUP_ITEMS=$(tar tzf "${BACKUP_DIR}/${BACKUP_FILE}" 2>/dev/null | wc -l)
log "   ✅ Arquivo íntegro (${BACKUP_ITEMS} itens)"

# Gerar hash SHA256
log "🔐 Gerando hash SHA256..."
sha256sum "${BACKUP_DIR}/${BACKUP_FILE}" > "${BACKUP_DIR}/${BACKUP_FILE}.sha256"
HASH=$(cat "${BACKUP_DIR}/${BACKUP_FILE}.sha256" | cut -d' ' -f1)
log "   Hash: ${HASH:0:16}..."
log ""

# ============================================
# Política de retenção
# ============================================

BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/api-data-backup-*.tar.gz 2>/dev/null | wc -l)

if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    log "🗑️  Aplicando política de retenção (máximo: ${MAX_BACKUPS})..."

    # Listar backups antigos a remover
    OLD_BACKUPS=$(ls -1t "${BACKUP_DIR}"/api-data-backup-*.tar.gz | tail -n +$((MAX_BACKUPS + 1)))

    for old_backup in $OLD_BACKUPS; do
        log "   Removendo: $(basename "$old_backup")"
        rm -f "$old_backup"
        rm -f "${old_backup}.sha256"
    done

    log "   ✅ ${BACKUP_COUNT} -> ${MAX_BACKUPS} backups"
    log ""
fi

# ============================================
# Resumo final
# ============================================

FINAL_SIZE=$(ls -lh "${BACKUP_DIR}/${BACKUP_FILE}" | awk '{print $5}')

log "════════════════════════════════════════════"
log "✅ BACKUP CONCLUÍDO COM SUCESSO!"
log "════════════════════════════════════════════"
log "📦 Arquivo: ${BACKUP_DIR}/${BACKUP_FILE}"
log "💾 Tamanho: ${FINAL_SIZE}"
log "🔐 SHA256:  ${HASH:0:16}..."
log "📝 Log:     ${LOG_FILE}"
log "════════════════════════════════════════════"
