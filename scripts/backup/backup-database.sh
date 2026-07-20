#!/bin/bash

# Script para fazer backup do banco de dados (MySQL master) e Redis
# O backup do MySQL usa mysqldump com transação consistente (--single-transaction)
# O backup do Redis usa BGSAVE para snapshot RDB não-bloqueante
#
# Uso: ./backup-database.sh [diretório-de-destino] [opções]
#
# Opções:
#   -r N    Manter apenas os últimos N backups (padrão: 5)
#   -R      Pular backup do Redis
#   -M      Pular backup do MySQL
#   -e ENV  Arquivo .env a usar (padrão: .env)
#   -q      Modo silencioso
#   -h      Mostrar ajuda
#
# Estrutura de saída:
#   <BACKUP_DIR>/
#     db-backup-20260717_120000/
#       mysql-<DB_NAME>-20260717_120000.sql.zst   ← dump comprimido
#       redis-20260717_120000.rdb.zst              ← snapshot RDB comprimido
#       info.txt                                   ← metadados
#       manifest.sha256                            ← checksums

set -euo pipefail

# Carregar utilitário de verificação/instalação de ferramentas
# shellcheck source=_tools-check.sh
source "$(dirname "$(realpath "$0")")/_tools-check.sh"

# ============================================
# Configurações
# ============================================
BACKUP_DIR="./backups"
MAX_BACKUPS=5
SKIP_REDIS=false
SKIP_MYSQL=false
QUIET=false
ENV_FILE=".env"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="db-backup-${TIMESTAMP}"
LOG_FILE=""

# ============================================
# Funções utilitárias
# ============================================

show_help() {
    echo "Uso: $0 [diretório-de-destino] [opções]"
    echo ""
    echo "Opções:"
    echo "  -r N    Manter apenas os últimos N backups (padrão: 5)"
    echo "  -R      Pular backup do Redis"
    echo "  -M      Pular backup do MySQL"
    echo "  -e ENV  Arquivo .env (padrão: .env)"
    echo "  -q      Modo silencioso"
    echo "  -h      Mostrar esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  $0                    # Backup MySQL + Redis para ./backups"
    echo "  $0 /mnt/backups -r 7  # Manter 7 backups"
    echo "  $0 -R                 # Apenas MySQL (sem Redis)"
    echo "  $0 -M                 # Apenas Redis (sem MySQL)"
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
    if [ $exit_code -ne 0 ] && [ -n "${BACKUP_PATH:-}" ] && [ -d "${BACKUP_PATH}.inprogress" ]; then
        log "⚠️  Falha detectada. Removendo backup incompleto..."
        rm -rf "${BACKUP_PATH}.inprogress" 2>/dev/null || true
    fi
}

# Lê uma variável do arquivo .env (suporta aspas simples, duplas ou sem aspas)
env_var() {
    local var="$1"
    local default="${2:-}"
    local value
    value=$(grep -E "^${var}=" "${ENV_FILE}" 2>/dev/null | head -n1 | sed "s/^${var}=//;s/^['\"]//;s/['\"]$//" || true)
    echo "${value:-$default}"
}

# ============================================
# Parse de argumentos
# ============================================

if [ $# -gt 0 ] && [[ ! "${1:-}" =~ ^- ]]; then
    BACKUP_DIR="$1"
    shift
fi

while getopts "r:RMe:qh" opt; do
    case $opt in
        r) MAX_BACKUPS=$OPTARG ;;
        R) SKIP_REDIS=true ;;
        M) SKIP_MYSQL=true ;;
        e) ENV_FILE=$OPTARG ;;
        q) QUIET=true ;;
        h) show_help; exit 0 ;;
        *) show_help; exit 1 ;;
    esac
done

# ============================================
# Validações e pré-requisitos
# ============================================

log "🔍 Verificando pré-requisitos..."

# Docker obrigatório
if ! docker info >/dev/null 2>&1; then
    log "❌ Erro: Docker não está rodando ou sem permissão"
    exit 1
fi

# Verificar .env
if [ ! -f "${ENV_FILE}" ]; then
    log "❌ Arquivo .env não encontrado: ${ENV_FILE}"
    log "   Use -e para especificar o caminho"
    exit 1
fi

# Verificar zstd (para compressão — tem fallback Docker)
ensure_tools zstd sha256sum

# Ler variáveis de ambiente
DB_NAME=$(env_var "DB_NAME" "gatuno")
DB_USER=$(env_var "DB_USER" "gatuno")
DB_PASS=$(env_var "DB_PASS" "")
REDIS_PASSWORD=$(env_var "REDIS_PASSWORD" "")

# Validar credenciais MySQL se não pular
if [ "$SKIP_MYSQL" = false ] && [ -z "$DB_PASS" ]; then
    log "❌ DB_PASS não encontrado no arquivo ${ENV_FILE}"
    exit 1
fi

# Verificar container MySQL rodando
MYSQL_CONTAINER="gatuno-database"
if [ "$SKIP_MYSQL" = false ]; then
    if ! docker inspect "$MYSQL_CONTAINER" >/dev/null 2>&1; then
        log "❌ Container MySQL não encontrado: ${MYSQL_CONTAINER}"
        log "   Inicie o ambiente antes de fazer backup"
        exit 1
    fi
    if [ "$(docker inspect -f '{{.State.Running}}' "$MYSQL_CONTAINER")" != "true" ]; then
        log "❌ Container MySQL não está rodando: ${MYSQL_CONTAINER}"
        exit 1
    fi
fi

# Verificar container Redis rodando
REDIS_CONTAINER="gatuno-redis"
if [ "$SKIP_REDIS" = false ]; then
    if ! docker inspect "$REDIS_CONTAINER" >/dev/null 2>&1; then
        log "⚠️  Container Redis não encontrado: ${REDIS_CONTAINER} — pulando Redis"
        SKIP_REDIS=true
    elif [ "$(docker inspect -f '{{.State.Running}}' "$REDIS_CONTAINER")" != "true" ]; then
        log "⚠️  Container Redis não está rodando — pulando Redis"
        SKIP_REDIS=true
    fi
fi

mkdir -p "${BACKUP_DIR}"
LOG_FILE="${BACKUP_DIR}/db-backup-${TIMESTAMP}.log"

log "✅ Pré-requisitos OK"
log "📝 Log: ${LOG_FILE}"
log ""

# ============================================
# Criar diretório de backup
# ============================================

BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
INPROGRESS_PATH="${BACKUP_PATH}.inprogress"
mkdir -p "${INPROGRESS_PATH}"

trap cleanup EXIT

log "════════════════════════════════════════════════════"
log "🗄️  Iniciando backup do banco de dados"
log "════════════════════════════════════════════════════"
log "📁 Destino: ${BACKUP_PATH}"
log ""

# ============================================
# Backup MySQL (master)
# ============================================

MYSQL_SUCCESS=false
MYSQL_FILE=""
MYSQL_SIZE=""

if [ "$SKIP_MYSQL" = false ]; then
    log "🐬 MySQL — database: ${DB_NAME} (container: ${MYSQL_CONTAINER})"

    MYSQL_DUMP_FILE="${INPROGRESS_PATH}/mysql-${DB_NAME}-${TIMESTAMP}.sql"
    MYSQL_FILE_COMPRESSED="${MYSQL_DUMP_FILE}.zst"

    # mysqldump com --single-transaction para consistência sem bloquear
    # --master-data=2: inclui posição binlog como comentário (útil para replicação)
    # --routines --events --triggers: inclui objetos armazenados
    log "   📤 Executando mysqldump (single-transaction)..."

    if docker exec "$MYSQL_CONTAINER" \
        mysqldump \
            --user="${DB_USER}" \
            "--password=${DB_PASS}" \
            --single-transaction \
            --quick \
            --lock-tables=false \
            --routines \
            --events \
            --triggers \
            --set-gtid-purged=OFF \
            --master-data=2 \
            "${DB_NAME}" \
        > "${MYSQL_DUMP_FILE}" 2>/dev/null; then

        # Verificar que o dump não está vazio
        DUMP_LINES=$(wc -l < "${MYSQL_DUMP_FILE}")
        if [ "$DUMP_LINES" -lt 10 ]; then
            log "   ❌ Dump gerado está vazio ou incompleto (${DUMP_LINES} linhas)"
            rm -f "${MYSQL_DUMP_FILE}"
        else
            log "   ✅ Dump concluído (${DUMP_LINES} linhas)"

            # Comprimir com zstd
            log "   🗜️  Comprimindo..."
            if command -v zstd >/dev/null 2>&1; then
                zstd -T0 -3 --rm "${MYSQL_DUMP_FILE}" -o "${MYSQL_FILE_COMPRESSED}" >/dev/null 2>&1
            else
                # Fallback Docker para compressão
                docker run --rm \
                    -v "${INPROGRESS_PATH}:/work" \
                    alpine \
                    sh -c "apk add --no-cache zstd >/dev/null 2>&1 && zstd -T0 -3 /work/$(basename "${MYSQL_DUMP_FILE}") -o /work/$(basename "${MYSQL_FILE_COMPRESSED}") && rm /work/$(basename "${MYSQL_DUMP_FILE}")"
            fi

            MYSQL_SIZE=$(du -sh "${MYSQL_FILE_COMPRESSED}" 2>/dev/null | cut -f1)
            MYSQL_FILE=$(basename "${MYSQL_FILE_COMPRESSED}")
            log "   ✅ MySQL backup: ${MYSQL_FILE} (${MYSQL_SIZE})"
            MYSQL_SUCCESS=true
        fi
    else
        log "   ❌ Falha no mysqldump"
        rm -f "${MYSQL_DUMP_FILE}"
    fi

    log ""
fi

# ============================================
# Backup Redis (BGSAVE → cópia do RDB)
# ============================================

REDIS_SUCCESS=false
REDIS_FILE=""
REDIS_SIZE=""

if [ "$SKIP_REDIS" = false ]; then
    log "🔴 Redis (container: ${REDIS_CONTAINER})"

    REDIS_RDB_FILE="${INPROGRESS_PATH}/redis-${TIMESTAMP}.rdb"
    REDIS_FILE_COMPRESSED="${REDIS_RDB_FILE}.zst"

    # Disparar BGSAVE e aguardar conclusão
    log "   📸 Disparando BGSAVE..."

    if [ -n "$REDIS_PASSWORD" ]; then
        REDIS_CLI_CMD="redis-cli -a ${REDIS_PASSWORD}"
    else
        REDIS_CLI_CMD="redis-cli"
    fi

    docker exec "$REDIS_CONTAINER" sh -c "${REDIS_CLI_CMD} BGSAVE" >/dev/null 2>&1

    # Aguardar BGSAVE terminar (polling com timeout de 120s)
    TIMEOUT=120
    ELAPSED=0
    while true; do
        STATUS=$(docker exec "$REDIS_CONTAINER" sh -c "${REDIS_CLI_CMD} LASTSAVE" 2>/dev/null || echo "0")
        BGSAVE_STATUS=$(docker exec "$REDIS_CONTAINER" sh -c "${REDIS_CLI_CMD} INFO persistence" 2>/dev/null | grep "rdb_bgsave_in_progress" | tr -d '\r' | cut -d: -f2 || echo "0")

        if [ "${BGSAVE_STATUS}" = "0" ]; then
            break
        fi

        sleep 2
        ELAPSED=$((ELAPSED + 2))
        if [ $ELAPSED -ge $TIMEOUT ]; then
            log "   ⚠️  Timeout aguardando BGSAVE — copiando RDB mesmo assim"
            break
        fi
        log "   ⏳ Aguardando BGSAVE... (${ELAPSED}s)"
    done

    # Copiar o arquivo RDB do container
    REDIS_DATA_DIR=$(docker exec "$REDIS_CONTAINER" sh -c "${REDIS_CLI_CMD} CONFIG GET dir 2>/dev/null | tail -n1" || echo "/data")
    REDIS_RDB_NAME=$(docker exec "$REDIS_CONTAINER" sh -c "${REDIS_CLI_CMD} CONFIG GET dbfilename 2>/dev/null | tail -n1" || echo "dump.rdb")

    if docker cp "${REDIS_CONTAINER}:${REDIS_DATA_DIR}/${REDIS_RDB_NAME}" "${REDIS_RDB_FILE}" 2>/dev/null; then
        RDB_SIZE=$(du -sh "${REDIS_RDB_FILE}" 2>/dev/null | cut -f1)
        log "   ✅ RDB copiado (${RDB_SIZE})"

        # Comprimir
        log "   🗜️  Comprimindo RDB..."
        if command -v zstd >/dev/null 2>&1; then
            zstd -T0 -3 --rm "${REDIS_RDB_FILE}" -o "${REDIS_FILE_COMPRESSED}" >/dev/null 2>&1
        else
            docker run --rm \
                -v "${INPROGRESS_PATH}:/work" \
                alpine \
                sh -c "apk add --no-cache zstd >/dev/null 2>&1 && zstd -T0 -3 /work/$(basename "${REDIS_RDB_FILE}") -o /work/$(basename "${REDIS_FILE_COMPRESSED}") && rm /work/$(basename "${REDIS_RDB_FILE}")"
        fi

        REDIS_SIZE=$(du -sh "${REDIS_FILE_COMPRESSED}" 2>/dev/null | cut -f1)
        REDIS_FILE=$(basename "${REDIS_FILE_COMPRESSED}")
        log "   ✅ Redis backup: ${REDIS_FILE} (${REDIS_SIZE})"
        REDIS_SUCCESS=true
    else
        log "   ❌ Falha ao copiar RDB do container"
        rm -f "${REDIS_RDB_FILE}"
    fi

    log ""
fi

# ============================================
# Gerar manifest e info
# ============================================

if [ "$MYSQL_SUCCESS" = false ] && [ "$REDIS_SUCCESS" = false ]; then
    log "❌ Nenhum backup foi concluído com sucesso."
    exit 1
fi

log "🔐 Gerando manifest.sha256..."
find "${INPROGRESS_PATH}" -type f | sort | \
    xargs sha256sum 2>/dev/null | \
    sed "s|${INPROGRESS_PATH}/||" \
    > "${INPROGRESS_PATH}/manifest.sha256" &
HASH_PID=$!
if [ "$QUIET" = false ]; then
    spinner "$HASH_PID" "Calculando checksums..."
else
    wait "$HASH_PID"
fi

# Info
cat > "${INPROGRESS_PATH}/info.txt" << EOF
backup_name:    ${BACKUP_NAME}
timestamp:      ${TIMESTAMP}
created_at:     $(date -Iseconds)
mysql_database: ${DB_NAME}
mysql_user:     ${DB_USER}
mysql_file:     ${MYSQL_FILE:-skipped}
redis_file:     ${REDIS_FILE:-skipped}
mysql_success:  ${MYSQL_SUCCESS}
redis_success:  ${REDIS_SUCCESS}
EOF

# Finalizar (renomear de .inprogress)
mv "${INPROGRESS_PATH}" "${BACKUP_PATH}"
log ""

# ============================================
# Política de retenção
# ============================================

mapfile -t ALL_BACKUPS < <(ls -1dt "${BACKUP_DIR}"/db-backup-* 2>/dev/null | grep -v '\.inprogress$' || true)
BACKUP_COUNT=${#ALL_BACKUPS[@]}

if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    log "🗑️  Aplicando política de retenção (máximo: ${MAX_BACKUPS})..."
    TO_REMOVE=("${ALL_BACKUPS[@]:$MAX_BACKUPS}")
    for old_backup in "${TO_REMOVE[@]}"; do
        FREED=$(du -sh "${old_backup}" 2>/dev/null | cut -f1)
        log "   Removendo: $(basename "${old_backup}") (${FREED})"
        rm -rf "${old_backup}"
    done
    log "   ✅ ${BACKUP_COUNT} → ${MAX_BACKUPS} backups"
    log ""
fi

# ============================================
# Relatório final
# ============================================

TOTAL_SIZE=$(du -sh "${BACKUP_PATH}" 2>/dev/null | cut -f1)

log "════════════════════════════════════════════════════"
log "✅ BACKUP DO BANCO DE DADOS CONCLUÍDO!"
log "════════════════════════════════════════════════════"
log "📁 Diretório: ${BACKUP_PATH}"
log "💾 Tamanho total: ${TOTAL_SIZE}"
log ""

if [ "$MYSQL_SUCCESS" = true ]; then
    log "🐬 MySQL:  ✅ ${MYSQL_FILE} (${MYSQL_SIZE})"
else
    log "🐬 MySQL:  ⏭️  pulado"
fi

if [ "$REDIS_SUCCESS" = true ]; then
    log "🔴 Redis:  ✅ ${REDIS_FILE} (${REDIS_SIZE})"
else
    log "🔴 Redis:  ⏭️  pulado"
fi

log ""
log "📋 Manifesto: ${BACKUP_PATH}/manifest.sha256"
log "ℹ️  Info:      ${BACKUP_PATH}/info.txt"
log "📝 Log:       ${LOG_FILE}"
log "════════════════════════════════════════════════════"
