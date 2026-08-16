#!/bin/bash

# Script para restaurar um backup de banco de dados (db-backup-*) gerado por
# backup-database.sh: MySQL via `mysql` (pipe direto do .sql.zst) e Redis via
# substituição do arquivo RDB (requer parar o container, já que o Redis só
# carrega o RDB na inicialização).
#
# Uso: ./restore-database.sh [diretório-de-backup] [opções]
#
# O argumento pode ser:
#   - Um diretório de backup específico: ./backups/db-backup-20260717_120000
#   - O diretório pai de backups:        ./backups   (lista disponíveis e pede escolha)
#   - Omitido:                           lista backups em ./backups e pede escolha
#
# Opções:
#   -M      Pular restauração do MySQL
#   -R      Pular restauração do Redis
#   -e ENV  Arquivo .env a usar (padrão: .env)
#   -f      Forçar (sem confirmação interativa)
#   -v      Verificar manifest.sha256 antes de restaurar
#   -q      Modo silencioso
#   -h      Mostrar ajuda

set -euo pipefail

# shellcheck source=./_tools-check.sh
source "$(dirname "$(realpath "$0")")/_tools-check.sh"

# ============================================
# Configurações
# ============================================

SKIP_MYSQL=false
SKIP_REDIS=false
ENV_FILE=".env"
FORCE=false
VERIFY_MANIFEST=false
QUIET=false
BACKUP_DIR=""
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE=""
REDIS_STOPPED=false
ROOT_DIR="$(cd "$(dirname "$(realpath "$0")")/../.." && pwd)"

MYSQL_CONTAINER="gatuno-database"
REDIS_CONTAINER="gatuno-redis"

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

  Se [diretório-de-backup] for omitido ou apontar para o diretório pai de
  backups, o script lista os backups disponíveis e pede para escolher.

Opções:
  -M      Pular restauração do MySQL
  -R      Pular restauração do Redis
  -e ENV  Arquivo .env (padrão: .env)
  -f      Forçar restauração (sem confirmação interativa)
  -v      Verificar manifest.sha256 antes de restaurar
  -q      Modo silencioso
  -h      Mostrar esta ajuda

Exemplos:
  $0
  $0 ./backups
  $0 ./backups/db-backup-20260717_120000
  $0 ./backups/db-backup-20260717_120000 -v -f

Nota sobre o MySQL:
  mysqldump gera DROP TABLE IF EXISTS antes de cada CREATE TABLE (padrão),
  então tabelas existentes são substituídas — mas o restore roda contra o
  banco de dados como ele está agora. Para um restore "limpo", garanta que
  não há alterações concorrentes na tabela durante a restauração.

Docker Compose:
  Defina GATUNO_COMPOSE_FILES (ex: 'docker-compose.common.yml:docker-compose.prod.yml')
  para a restauração do Redis conseguir parar/reiniciar o container em produção.
EOF
}

# Lê uma variável do arquivo .env (suporta aspas simples, duplas ou sem aspas)
env_var() {
    local var="$1"
    local default="${2:-}"
    local value
    value=$(grep -E "^${var}=" "${ENV_FILE}" 2>/dev/null | head -n1 | sed "s/^${var}=//;s/^['\"]//;s/['\"]$//" || true)
    echo "${value:-$default}"
}

# Descomprime um .zst para stdout — usa zstd do host ou Docker Alpine como fallback.
decompress_to_stdout() {
    local file_abs="$1"
    if command -v zstd >/dev/null 2>&1; then
        zstd -dc "${file_abs}"
    else
        docker run --rm -v "$(dirname "${file_abs}"):/work:ro" alpine \
            sh -c "apk add --no-cache zstd >/dev/null 2>&1 && zstd -dc /work/$(basename "${file_abs}")"
    fi
}

# Lista backups db-backup-* de um diretório pai e pede ao usuário para escolher.
pick_backup_from_dir() {
    local parent_dir="$1"
    local backups=()

    while IFS= read -r -d '' entry; do
        backups+=("$entry")
    done < <(find "$parent_dir" -maxdepth 1 -type d -name 'db-backup-*' -print0 | sort -z)

    if [ ${#backups[@]} -eq 0 ]; then
        echo "❌ Nenhum backup encontrado em: $parent_dir"
        echo "   Esperado: ${parent_dir}/db-backup-*/"
        exit 1
    fi

    echo "📋 Backups disponíveis em $(realpath "$parent_dir"):"
    echo ""
    local index=1
    for backup in "${backups[@]}"; do
        local name
        name=$(basename "$backup")
        local size_info
        size_info=$(du -sh "${backup}" 2>/dev/null | cut -f1 || echo "?")
        local extra=""
        if [ -f "${backup}/info.txt" ]; then
            extra=$(grep -E "^mysql_success|^redis_success" "${backup}/info.txt" 2>/dev/null | tr '\n' ' ' || true)
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

cleanup() {
    if [ "$REDIS_STOPPED" = true ]; then
        log ""
        log "🔄 Reiniciando container Redis..."
        docker compose "${COMPOSE_ARGS[@]}" start redis 2>/dev/null || true
    fi
}

# ============================================
# Parse de argumentos
# ============================================

if [ "${1:-}" ] && [[ ! "${1:-}" =~ ^- ]]; then
    BACKUP_DIR="$1"
    shift
fi

while getopts "MRe:fvqh" opt; do
    case $opt in
        M) SKIP_MYSQL=true ;;
        R) SKIP_REDIS=true ;;
        e) ENV_FILE=$OPTARG ;;
        f) FORCE=true ;;
        v) VERIFY_MANIFEST=true ;;
        q) QUIET=true ;;
        h) show_help; exit 0 ;;
        *) show_help; exit 1 ;;
    esac
done

if [ "$SKIP_MYSQL" = true ] && [ "$SKIP_REDIS" = true ]; then
    echo "❌ Erro: -M e -R juntos não fazem nada."
    exit 1
fi

resolve_compose_args "${ROOT_DIR}"

# ============================================
# Resolução do diretório de backup
# ============================================

DEFAULT_BACKUPS_DIR="./backups"

if [ -z "$BACKUP_DIR" ]; then
    if [ ! -d "$DEFAULT_BACKUPS_DIR" ]; then
        echo "❌ Diretório padrão de backups não encontrado: $DEFAULT_BACKUPS_DIR"
        echo "   Informe o caminho: $0 <diretório-de-backup>"
        exit 1
    fi
    pick_backup_from_dir "$DEFAULT_BACKUPS_DIR"
elif [ -d "$BACKUP_DIR" ] && [ ! -f "${BACKUP_DIR}/manifest.sha256" ]; then
    pick_backup_from_dir "$BACKUP_DIR"
fi

if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Diretório de backup não encontrado: $BACKUP_DIR"
    exit 1
fi

BACKUP_ABS=$(cd "$BACKUP_DIR" && pwd)

if [ ! -f "${BACKUP_ABS}/manifest.sha256" ]; then
    echo "❌ Arquivo de manifesto não encontrado: ${BACKUP_ABS}/manifest.sha256"
    exit 1
fi
if [ ! -f "${BACKUP_ABS}/info.txt" ]; then
    echo "❌ Arquivo de metadados não encontrado: ${BACKUP_ABS}/info.txt"
    exit 1
fi

PARENT_DIR=$(dirname "$BACKUP_ABS")
LOG_FILE="${PARENT_DIR}/restore-db-${TIMESTAMP}.log"

# ============================================
# Pré-requisitos
# ============================================

log "🔍 Verificando pré-requisitos..."

if ! docker info > /dev/null 2>&1; then
    log "❌ Erro: Docker não está rodando ou sem permissão"
    exit 1
fi

MYSQL_FILE=$(grep -E '^mysql_file:' "${BACKUP_ABS}/info.txt" | sed 's/^mysql_file:[[:space:]]*//')
REDIS_FILE=$(grep -E '^redis_file:' "${BACKUP_ABS}/info.txt" | sed 's/^redis_file:[[:space:]]*//')

if [ "$SKIP_MYSQL" = false ]; then
    if [ -z "$MYSQL_FILE" ] || [ "$MYSQL_FILE" = "skipped" ] || [ ! -f "${BACKUP_ABS}/${MYSQL_FILE}" ]; then
        log "⚠️  Backup não contém dump do MySQL válido — pulando"
        SKIP_MYSQL=true
    fi
fi

if [ "$SKIP_REDIS" = false ]; then
    if [ -z "$REDIS_FILE" ] || [ "$REDIS_FILE" = "skipped" ] || [ ! -f "${BACKUP_ABS}/${REDIS_FILE}" ]; then
        log "⚠️  Backup não contém RDB do Redis válido — pulando"
        SKIP_REDIS=true
    fi
fi

if [ "$SKIP_MYSQL" = true ] && [ "$SKIP_REDIS" = true ]; then
    log "❌ Nada para restaurar neste backup."
    exit 1
fi

if [ "$SKIP_MYSQL" = false ]; then
    if [ ! -f "${ENV_FILE}" ]; then
        log "❌ Arquivo .env não encontrado: ${ENV_FILE} (necessário para credenciais do MySQL)"
        exit 1
    fi
    DB_NAME=$(env_var "DB_NAME" "gatuno")
    DB_USER=$(env_var "DB_USER" "gatuno")
    DB_PASS=$(env_var "DB_PASS" "")
    if [ -z "$DB_PASS" ]; then
        log "❌ DB_PASS não encontrado em ${ENV_FILE}"
        exit 1
    fi
    if ! docker inspect "$MYSQL_CONTAINER" >/dev/null 2>&1 || \
       [ "$(docker inspect -f '{{.State.Running}}' "$MYSQL_CONTAINER")" != "true" ]; then
        log "❌ Container MySQL não está rodando: ${MYSQL_CONTAINER}"
        exit 1
    fi
    ensure_tools sha256sum
fi

if [ "$SKIP_REDIS" = false ]; then
    REDIS_PASSWORD=""
    [ -f "${ENV_FILE}" ] && REDIS_PASSWORD=$(env_var "REDIS_PASSWORD" "")
    if ! docker inspect "$REDIS_CONTAINER" >/dev/null 2>&1; then
        log "❌ Container Redis não encontrado: ${REDIS_CONTAINER}"
        exit 1
    fi
fi

log "✅ Pré-requisitos OK"
log "📝 Log: ${LOG_FILE}"
log ""

# ============================================
# Verificação de manifest.sha256 (opcional com -v)
# ============================================

if [ "$VERIFY_MANIFEST" = true ]; then
    log "🔐 Verificando integridade via manifest.sha256..."
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

log "📊 Informações do backup:"
log "   📦 Nome:  $(basename "${BACKUP_ABS}")"
[ "$SKIP_MYSQL" = false ] && log "   🐬 MySQL: ${MYSQL_FILE} → banco '${DB_NAME}'"
[ "$SKIP_REDIS" = false ] && log "   🔴 Redis: ${REDIS_FILE}"
log ""

# ============================================
# Confirmação interativa
# ============================================

if [ "$FORCE" = false ]; then
    echo "⚠️  ATENÇÃO: Esta operação irá sobrescrever dados existentes."
    [ "$SKIP_MYSQL" = false ] && echo "   MySQL: tabelas do banco '${DB_NAME}' serão substituídas (DROP + CREATE via mysqldump)."
    [ "$SKIP_REDIS" = false ] && echo "   Redis: todo o dataset atual será substituído pelo snapshot do backup."
    echo ""
    read -rp "Deseja continuar? (s/N): " -n 1 REPLY
    echo
    if [[ ! "$REPLY" =~ ^[Ss]$ ]]; then
        log "Operação cancelada pelo usuário."
        exit 0
    fi
    echo ""
fi

trap cleanup EXIT INT TERM

MYSQL_RESTORED=false
REDIS_RESTORED=false

# ============================================
# Restaurar MySQL
# ============================================

if [ "$SKIP_MYSQL" = false ]; then
    log "🐬 Restaurando MySQL (banco: ${DB_NAME})..."
    if decompress_to_stdout "${BACKUP_ABS}/${MYSQL_FILE}" | \
        docker exec -i -e MYSQL_PWD="${DB_PASS}" "$MYSQL_CONTAINER" \
            mysql --user="${DB_USER}" "${DB_NAME}"; then
        log "   ✅ MySQL restaurado com sucesso."
        MYSQL_RESTORED=true
    else
        log "   ❌ Falha ao restaurar MySQL."
    fi
    log ""
fi

# ============================================
# Restaurar Redis
# ============================================

if [ "$SKIP_REDIS" = false ]; then
    log "🔴 Restaurando Redis..."

    REDIS_ENV_ARGS=()
    [ -n "$REDIS_PASSWORD" ] && REDIS_ENV_ARGS=(-e "REDISCLI_AUTH=${REDIS_PASSWORD}")

    # Precisa consultar dir/dbfilename ANTES de parar o container.
    REDIS_DATA_DIR=$(docker exec "${REDIS_ENV_ARGS[@]}" "$REDIS_CONTAINER" redis-cli CONFIG GET dir 2>/dev/null | tail -n1)
    REDIS_RDB_NAME=$(docker exec "${REDIS_ENV_ARGS[@]}" "$REDIS_CONTAINER" redis-cli CONFIG GET dbfilename 2>/dev/null | tail -n1)
    REDIS_DATA_DIR="${REDIS_DATA_DIR:-/data}"
    REDIS_RDB_NAME="${REDIS_RDB_NAME:-dump.rdb}"

    TMP_RDB=$(mktemp)
    if decompress_to_stdout "${BACKUP_ABS}/${REDIS_FILE}" > "${TMP_RDB}"; then
        log "   ⏸️  Parando container Redis (RDB só é carregado na inicialização)..."
        if docker compose "${COMPOSE_ARGS[@]}" stop redis 2>/dev/null; then
            REDIS_STOPPED=true
        else
            log "   ⚠️  Aviso: não foi possível parar via compose; tentando 'docker stop'"
            docker stop "$REDIS_CONTAINER" >/dev/null 2>&1 && REDIS_STOPPED=true
        fi

        if docker cp "${TMP_RDB}" "${REDIS_CONTAINER}:${REDIS_DATA_DIR}/${REDIS_RDB_NAME}"; then
            log "   ✅ RDB substituído."
            REDIS_RESTORED=true
        else
            log "   ❌ Falha ao copiar RDB para o container."
        fi

        log "   ▶️  Reiniciando container Redis..."
        if docker compose "${COMPOSE_ARGS[@]}" start redis 2>/dev/null || docker start "$REDIS_CONTAINER" >/dev/null 2>&1; then
            REDIS_STOPPED=false  # já reiniciado — evita duplo restart no trap cleanup
        fi
    else
        log "   ❌ Falha ao descomprimir o RDB do backup."
    fi
    rm -f "${TMP_RDB}"
    log ""
fi

# ============================================
# Resumo final
# ============================================

log "════════════════════════════════════════════"
if { [ "$SKIP_MYSQL" = true ] || [ "$MYSQL_RESTORED" = true ]; } && \
   { [ "$SKIP_REDIS" = true ] || [ "$REDIS_RESTORED" = true ]; }; then
    log "✅ RESTAURAÇÃO CONCLUÍDA COM SUCESSO!"
    EXIT_CODE=0
else
    log "⚠️  RESTAURAÇÃO CONCLUÍDA COM FALHAS — verifique o log acima"
    EXIT_CODE=1
fi
log "════════════════════════════════════════════"
[ "$SKIP_MYSQL" = false ] && log "🐬 MySQL: $([ "$MYSQL_RESTORED" = true ] && echo "✅ restaurado" || echo "❌ falhou")"
[ "$SKIP_REDIS" = false ] && log "🔴 Redis: $([ "$REDIS_RESTORED" = true ] && echo "✅ restaurado" || echo "❌ falhou")"
log "📝 Log: ${LOG_FILE}"
log "════════════════════════════════════════════"

exit "$EXIT_CODE"
