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

# Loga as primeiras linhas de um arquivo de erro, com indentação
log_error_excerpt() {
    local err_file="$1"
    if [ -s "${err_file}" ]; then
        log "   Erro:"
        while IFS= read -r line; do
            log "      ${line}"
        done < <(head -n 20 "${err_file}")
    fi
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
# Limpar backups .inprogress órfãos de execuções anteriores
# ============================================

mapfile -t ORPHANED < <(find "${BACKUP_DIR}" -maxdepth 1 -type d -name 'db-backup-*.inprogress' 2>/dev/null || true)
if [ ${#ORPHANED[@]} -gt 0 ]; then
    log "🧹 Removendo ${#ORPHANED[@]} backup(s) .inprogress órfão(s) de execuções anteriores..."
    for orphan in "${ORPHANED[@]}"; do
        log "   $(basename "${orphan}")"
        rm -rf "${orphan}"
    done
    log ""
fi

# ============================================
# Criar diretório de backup
# ============================================

BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
INPROGRESS_PATH="${BACKUP_PATH}.inprogress"
mkdir -p "${INPROGRESS_PATH}"

trap cleanup EXIT INT TERM

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

    MYSQL_FILE_COMPRESSED="${INPROGRESS_PATH}/mysql-${DB_NAME}-${TIMESTAMP}.sql.zst"
    DUMP_ERR="${INPROGRESS_PATH}/mysqldump.err"
    DUMP_LINES_FILE="${INPROGRESS_PATH}/.dump_lines"

    # --master-data foi renomeado para --source-data no MySQL 8.4+; detectar
    # qual a flag suportada em vez de assumir uma delas (evita falha silenciosa).
    MYSQLDUMP_ARGS=(--user="${DB_USER}" --single-transaction --quick --lock-tables=false \
        --routines --events --triggers --set-gtid-purged=OFF)
    HELP_OUTPUT=$(docker exec -e MYSQL_PWD="${DB_PASS}" "$MYSQL_CONTAINER" mysqldump --help 2>/dev/null || true)
    if echo "${HELP_OUTPUT}" | grep -q -- '--source-data'; then
        MYSQLDUMP_ARGS+=(--source-data=2)
    elif echo "${HELP_OUTPUT}" | grep -q -- '--master-data'; then
        MYSQLDUMP_ARGS+=(--master-data=2)
    else
        log "   ⚠️  mysqldump sem suporte a --source-data/--master-data — posição binlog não incluída"
    fi

    log "   📤 Executando mysqldump (single-transaction)..."

    # Comprimir em pipe direto (sem arquivo .sql intermediário) quando zstd
    # está disponível no host — metade do IO e do pico de espaço em disco.
    # A senha vai via variável de ambiente (não aparece em `docker top`/`ps`).
    set +e
    if command -v zstd >/dev/null 2>&1; then
        docker exec -e MYSQL_PWD="${DB_PASS}" "$MYSQL_CONTAINER" \
            mysqldump "${MYSQLDUMP_ARGS[@]}" "${DB_NAME}" \
            2> "${DUMP_ERR}" \
            | tee >(wc -l > "${DUMP_LINES_FILE}") \
            | zstd -T0 -3 -q -o "${MYSQL_FILE_COMPRESSED}"
        MYSQLDUMP_EXIT="${PIPESTATUS[0]}"
    else
        MYSQL_DUMP_FILE_RAW="${INPROGRESS_PATH}/mysql-${DB_NAME}-${TIMESTAMP}.sql"
        docker exec -e MYSQL_PWD="${DB_PASS}" "$MYSQL_CONTAINER" \
            mysqldump "${MYSQLDUMP_ARGS[@]}" "${DB_NAME}" \
            > "${MYSQL_DUMP_FILE_RAW}" 2> "${DUMP_ERR}"
        MYSQLDUMP_EXIT=$?
        if [ "$MYSQLDUMP_EXIT" -eq 0 ]; then
            wc -l < "${MYSQL_DUMP_FILE_RAW}" > "${DUMP_LINES_FILE}"
            docker run --rm \
                -v "${INPROGRESS_PATH}:/work" \
                alpine \
                sh -c "apk add --no-cache zstd >/dev/null 2>&1 && zstd -T0 -3 /work/$(basename "${MYSQL_DUMP_FILE_RAW}") -o /work/$(basename "${MYSQL_FILE_COMPRESSED}") && rm /work/$(basename "${MYSQL_DUMP_FILE_RAW}")"
        fi
    fi
    set -e

    if [ "$MYSQLDUMP_EXIT" -ne 0 ]; then
        log "   ❌ Falha no mysqldump (código ${MYSQLDUMP_EXIT})"
        log_error_excerpt "${DUMP_ERR}"
        rm -f "${MYSQL_FILE_COMPRESSED}"
    else
        DUMP_LINES=$(cat "${DUMP_LINES_FILE}" 2>/dev/null || echo 0)
        if [ "$DUMP_LINES" -lt 10 ]; then
            log "   ❌ Dump gerado está vazio ou incompleto (${DUMP_LINES} linhas)"
            log_error_excerpt "${DUMP_ERR}"
            rm -f "${MYSQL_FILE_COMPRESSED}"
        else
            log "   ✅ Dump concluído (${DUMP_LINES} linhas)"
            MYSQL_SIZE=$(du -sh "${MYSQL_FILE_COMPRESSED}" 2>/dev/null | cut -f1)
            MYSQL_FILE=$(basename "${MYSQL_FILE_COMPRESSED}")
            log "   ✅ MySQL backup: ${MYSQL_FILE} (${MYSQL_SIZE})"
            MYSQL_SUCCESS=true
        fi
    fi
    rm -f "${DUMP_LINES_FILE}"

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

    REDIS_FILE_COMPRESSED="${INPROGRESS_PATH}/redis-${TIMESTAMP}.rdb.zst"

    REDIS_ENV_ARGS=()
    if [ -n "$REDIS_PASSWORD" ]; then
        REDIS_ENV_ARGS=(-e "REDISCLI_AUTH=${REDIS_PASSWORD}")
    fi

    redis_cli() {
        docker exec "${REDIS_ENV_ARGS[@]}" "$REDIS_CONTAINER" redis-cli "$@"
    }

    # Confirma que o BGSAVE realmente gerou um snapshot NOVO: espera
    # rdb_bgsave_in_progress voltar a 0, e exige que LASTSAVE tenha avançado
    # e que rdb_last_bgsave_status não seja "err". Sem isso, um BGSAVE que
    # falha silenciosamente resultaria em cópia de um RDB antigo reportado
    # como sucesso.
    REDIS_LASTSAVE_BEFORE=$(redis_cli LASTSAVE 2>/dev/null || echo "")
    REDIS_BGSAVE_CONFIRMED=false

    for attempt in 1 2; do
        log "   📸 Disparando BGSAVE (tentativa ${attempt}/2)..."
        redis_cli BGSAVE >/dev/null 2>&1

        TIMEOUT=120
        ELAPSED=0
        while true; do
            IN_PROGRESS=$(redis_cli INFO persistence 2>/dev/null | grep "^rdb_bgsave_in_progress:" | tr -d '\r' | cut -d: -f2 || echo "1")
            if [ "${IN_PROGRESS}" = "0" ]; then break; fi
            sleep 2
            ELAPSED=$((ELAPSED + 2))
            if [ $ELAPSED -ge $TIMEOUT ]; then
                log "   ⚠️  Timeout aguardando BGSAVE (${TIMEOUT}s)"
                break
            fi
            log "   ⏳ Aguardando BGSAVE... (${ELAPSED}s)"
        done

        REDIS_LASTSAVE_AFTER=$(redis_cli LASTSAVE 2>/dev/null || echo "")
        REDIS_LAST_STATUS=$(redis_cli INFO persistence 2>/dev/null | grep "^rdb_last_bgsave_status:" | tr -d '\r' | cut -d: -f2 || echo "")

        if [ "${REDIS_LASTSAVE_AFTER}" != "${REDIS_LASTSAVE_BEFORE}" ] && [ "${REDIS_LAST_STATUS}" != "err" ]; then
            REDIS_BGSAVE_CONFIRMED=true
            break
        fi
        log "   ⚠️  BGSAVE não confirmado (LASTSAVE inalterado ou status de erro)"
    done

    if [ "$REDIS_BGSAVE_CONFIRMED" != true ]; then
        log "   ❌ Não foi possível confirmar snapshot novo do Redis — pulando cópia do RDB"
    else
        REDIS_DATA_DIR=$(redis_cli CONFIG GET dir 2>/dev/null | tail -n1)
        REDIS_RDB_NAME=$(redis_cli CONFIG GET dbfilename 2>/dev/null | tail -n1)
        REDIS_DATA_DIR="${REDIS_DATA_DIR:-/data}"
        REDIS_RDB_NAME="${REDIS_RDB_NAME:-dump.rdb}"

        log "   🗜️  Copiando e comprimindo RDB..."
        set +e
        if command -v zstd >/dev/null 2>&1; then
            # Stream direto do container para zstd — evita cópia intermediária no host
            docker exec "${REDIS_ENV_ARGS[@]}" "$REDIS_CONTAINER" \
                cat "${REDIS_DATA_DIR}/${REDIS_RDB_NAME}" \
                | zstd -T0 -3 -q -o "${REDIS_FILE_COMPRESSED}"
            COPY_EXIT="${PIPESTATUS[0]}"
        else
            REDIS_RDB_FILE_RAW="${INPROGRESS_PATH}/redis-${TIMESTAMP}.rdb"
            if docker cp "${REDIS_CONTAINER}:${REDIS_DATA_DIR}/${REDIS_RDB_NAME}" "${REDIS_RDB_FILE_RAW}" 2>/dev/null; then
                docker run --rm \
                    -v "${INPROGRESS_PATH}:/work" \
                    alpine \
                    sh -c "apk add --no-cache zstd >/dev/null 2>&1 && zstd -T0 -3 /work/$(basename "${REDIS_RDB_FILE_RAW}") -o /work/$(basename "${REDIS_FILE_COMPRESSED}") && rm /work/$(basename "${REDIS_RDB_FILE_RAW}")"
                COPY_EXIT=$?
            else
                COPY_EXIT=1
            fi
        fi
        set -e

        if [ "$COPY_EXIT" -eq 0 ] && [ -s "${REDIS_FILE_COMPRESSED}" ]; then
            REDIS_SIZE=$(du -sh "${REDIS_FILE_COMPRESSED}" 2>/dev/null | cut -f1)
            REDIS_FILE=$(basename "${REDIS_FILE_COMPRESSED}")
            log "   ✅ Redis backup: ${REDIS_FILE} (${REDIS_SIZE})"
            REDIS_SUCCESS=true
        else
            log "   ❌ Falha ao copiar/comprimir RDB do container"
            rm -f "${REDIS_FILE_COMPRESSED}"
        fi
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
find "${INPROGRESS_PATH}" -mindepth 1 -maxdepth 1 -type f ! -name '.*' ! -name 'manifest.sha256' -printf '%P\n' | \
    LC_ALL=C sort > "${INPROGRESS_PATH}/.filelist.tmp"

hash_filelist "${INPROGRESS_PATH}/.filelist.tmp" "${INPROGRESS_PATH}" "${INPROGRESS_PATH}/manifest.sha256" &
HASH_PID=$!
if [ "$QUIET" = false ]; then
    spinner "$HASH_PID" "Calculando checksums..."
fi
wait "$HASH_PID"
rm -f "${INPROGRESS_PATH}/.filelist.tmp"

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

mapfile -t ALL_BACKUPS < <(find "${BACKUP_DIR}" -maxdepth 1 -type d -name 'db-backup-*' ! -name '*.inprogress' 2>/dev/null | sort -r || true)
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

# Poda de logs de execuções antigas (db-backup-*.log soltos no diretório),
# mesma retenção dos backups. O glob antigo (sem -type d) apagava esses
# logs junto com os diretórios, inflando a contagem de retenção pela metade.
mapfile -t OLD_LOGS < <(find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'db-backup-*.log' 2>/dev/null | sort -r || true)
if [ "${#OLD_LOGS[@]}" -gt "$MAX_BACKUPS" ]; then
    for old_log in "${OLD_LOGS[@]:$MAX_BACKUPS}"; do
        rm -f "${old_log}"
    done
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
    log "🐬 MySQL:  ⏭️  pulado ou falhou"
fi

if [ "$REDIS_SUCCESS" = true ]; then
    log "🔴 Redis:  ✅ ${REDIS_FILE} (${REDIS_SIZE})"
else
    log "🔴 Redis:  ⏭️  pulado ou falhou"
fi

log ""
log "📋 Manifesto: ${BACKUP_PATH}/manifest.sha256"
log "ℹ️  Info:      ${BACKUP_PATH}/info.txt"
log "📝 Log:       ${LOG_FILE}"
log "════════════════════════════════════════════════════"
