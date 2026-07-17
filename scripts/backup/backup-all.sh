#!/bin/bash

# Orquestra backup completo: binários (RustFS) + banco de dados (MySQL + Redis)
# em paralelo, com relatório unificado de tempo e espaço.
#
# Uso: ./backup-all.sh [diretório-de-destino] [opções]
#
# Opções:
#   -r N    Manter apenas os últimos N backups de CADA tipo (padrão: 5)
#   -s      Parar containers durante backup (consistência máxima)
#   -B      Pular backup de binários (RustFS)
#   -D      Pular backup de banco de dados
#   -R      Pular backup do Redis (dentro do DB backup)
#   -e ENV  Arquivo .env a usar (padrão: .env)
#   -q      Modo silencioso
#   -h      Mostrar ajuda

set -euo pipefail

# ============================================
# Configurações
# ============================================
BACKUP_DIR="./backups"
MAX_BACKUPS=5
STOP_CONTAINERS=false
SKIP_BINARIES=false
SKIP_DATABASE=false
SKIP_REDIS=false
QUIET=false
ENV_FILE=".env"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# ============================================
# Funções utilitárias
# ============================================

show_help() {
    echo "Uso: $0 [diretório-de-destino] [opções]"
    echo ""
    echo "Opções:"
    echo "  -r N    Manter os últimos N backups de cada tipo (padrão: 5)"
    echo "  -s      Parar containers durante backup (mais seguro)"
    echo "  -B      Pular backup de binários (RustFS)"
    echo "  -D      Pular backup de banco de dados (MySQL + Redis)"
    echo "  -R      Pular backup do Redis"
    echo "  -e ENV  Arquivo .env (padrão: .env)"
    echo "  -q      Modo silencioso"
    echo "  -h      Mostrar esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  $0                     # Backup completo"
    echo "  $0 /mnt/backups -r 7   # Manter 7 backups de cada tipo"
    echo "  $0 -B                  # Apenas banco de dados"
    echo "  $0 -D                  # Apenas binários (RustFS)"
    echo "  $0 -s                  # Para containers (consistência total)"
}

log() {
    if [ "${QUIET:-false}" = false ]; then
        echo "${1:-}"
    fi
}

hr() {
    log "════════════════════════════════════════════════════════════"
}

duration_human() {
    local seconds=$1
    if [ "$seconds" -ge 3600 ]; then
        printf "%dh%02dm%02ds" $((seconds / 3600)) $(( (seconds % 3600) / 60)) $((seconds % 60))
    elif [ "$seconds" -ge 60 ]; then
        printf "%dm%02ds" $((seconds / 60)) $((seconds % 60))
    else
        printf "%ds" "$seconds"
    fi
}

# ============================================
# Parse de argumentos
# ============================================

if [ $# -gt 0 ] && [[ ! "${1:-}" =~ ^- ]]; then
    BACKUP_DIR="$1"
    shift
fi

while getopts "r:sBDRe:qh" opt; do
    case $opt in
        r) MAX_BACKUPS=$OPTARG ;;
        s) STOP_CONTAINERS=true ;;
        B) SKIP_BINARIES=true ;;
        D) SKIP_DATABASE=true ;;
        R) SKIP_REDIS=true ;;
        e) ENV_FILE=$OPTARG ;;
        q) QUIET=true ;;
        h) show_help; exit 0 ;;
        *) show_help; exit 1 ;;
    esac
done

# ============================================
# Validação básica
# ============================================

SCRIPT_DIR="$(dirname "$(realpath "$0")")"

if [ "$SKIP_BINARIES" = true ] && [ "$SKIP_DATABASE" = true ]; then
    echo "❌ Erro: -B e -D juntos não fazem nada."
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker não está rodando ou sem permissão."
    exit 1
fi

mkdir -p "${BACKUP_DIR}"

# Arquivo de log do orquestrador
ORCHESTRATOR_LOG="${BACKUP_DIR}/backup-all-${TIMESTAMP}.log"

# ============================================
# Cabeçalho
# ============================================

START_TIME=$(date +%s)

hr
log "🚀 BACKUP COMPLETO — $(date '+%Y-%m-%d %H:%M:%S')"
hr
log "📁 Destino:   ${BACKUP_DIR}"
log "📦 Retenção:  ${MAX_BACKUPS} backups por tipo"
log "🗄️  MySQL+Redis: $([ "$SKIP_DATABASE" = true ] && echo "⏭️  pulado" || echo "✅ incluído")"
log "🖼️  Binários:  $([ "$SKIP_BINARIES" = true ] && echo "⏭️  pulado" || echo "✅ incluído")"
if [ "$STOP_CONTAINERS" = true ]; then
    log "⏸️  Modo:      parar containers (consistência máxima)"
else
    log "▶️  Modo:      online (sem parar containers)"
fi
log ""

# ============================================
# Construir argumentos para sub-scripts
# ============================================

# Args comuns
COMMON_ARGS=("${BACKUP_DIR}" "-r" "${MAX_BACKUPS}")
[ "$QUIET" = true ] && COMMON_ARGS+=("-q")
[ "$ENV_FILE" != ".env" ] && DATABASE_EXTRA_ARGS=("-e" "${ENV_FILE}") || DATABASE_EXTRA_ARGS=()

# Args específicos
BINARY_ARGS=("${COMMON_ARGS[@]}")
[ "$STOP_CONTAINERS" = true ] && BINARY_ARGS+=("-s")

DATABASE_ARGS=("${COMMON_ARGS[@]}" "${DATABASE_EXTRA_ARGS[@]}")
[ "$SKIP_REDIS" = true ] && DATABASE_ARGS+=("-R")

# ============================================
# Executar backups em paralelo
# ============================================

# Arquivos de status para comunicação com sub-shells
STATUS_DIR="${BACKUP_DIR}/.backup-all-${TIMESTAMP}"
mkdir -p "${STATUS_DIR}"

BINARY_PID=""
DATABASE_PID=""
BINARY_START=""
DATABASE_START=""

# --- Binários (RustFS) ---
if [ "$SKIP_BINARIES" = false ]; then
    log "🖼️  Iniciando backup de binários em background..."
    BINARY_START=$(date +%s)
    (
        if "${SCRIPT_DIR}/backup-api-data.sh" "${BINARY_ARGS[@]}" \
            >> "${STATUS_DIR}/binary.log" 2>&1; then
            echo "0" > "${STATUS_DIR}/binary.exit"
        else
            echo "$?" > "${STATUS_DIR}/binary.exit"
        fi
    ) &
    BINARY_PID=$!
fi

# --- Banco de dados ---
if [ "$SKIP_DATABASE" = false ]; then
    log "🗄️  Iniciando backup do banco de dados em background..."
    DATABASE_START=$(date +%s)
    (
        if "${SCRIPT_DIR}/backup-database.sh" "${DATABASE_ARGS[@]}" \
            >> "${STATUS_DIR}/database.log" 2>&1; then
            echo "0" > "${STATUS_DIR}/database.exit"
        else
            echo "$?" > "${STATUS_DIR}/database.exit"
        fi
    ) &
    DATABASE_PID=$!
fi

log ""

# ============================================
# Aguardar com monitoramento de progresso
# ============================================

if [ "$QUIET" = false ]; then
    DOTS=0
    while true; do
        BINARY_DONE=true
        DATABASE_DONE=true

        [ -n "$BINARY_PID" ] && kill -0 "$BINARY_PID" 2>/dev/null && BINARY_DONE=false
        [ -n "$DATABASE_PID" ] && kill -0 "$DATABASE_PID" 2>/dev/null && DATABASE_DONE=false

        if [ "$BINARY_DONE" = true ] && [ "$DATABASE_DONE" = true ]; then
            break
        fi

        # Status visual
        ELAPSED=$(( $(date +%s) - START_TIME ))
        STATUS_LINE="   ⏳ $(duration_human $ELAPSED)"
        [ "$BINARY_DONE" = false ] && STATUS_LINE+="  🖼️  binários..."
        [ "$DATABASE_DONE" = false ] && STATUS_LINE+="  🗄️  banco..."

        printf "\r%-70s" "$STATUS_LINE"
        sleep 2
    done
    printf "\r%-70s\n" "   ✓ Todos os processos concluídos"
    echo ""
else
    # Modo silencioso: apenas esperar
    [ -n "$BINARY_PID" ] && wait "$BINARY_PID" 2>/dev/null || true
    [ -n "$DATABASE_PID" ] && wait "$DATABASE_PID" 2>/dev/null || true
fi

END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

# ============================================
# Coletar resultados
# ============================================

BINARY_EXIT=0
DATABASE_EXIT=0
BINARY_DURATION=0
DATABASE_DURATION=0

if [ -n "$BINARY_PID" ]; then
    wait "$BINARY_PID" 2>/dev/null || true
    BINARY_EXIT=$(cat "${STATUS_DIR}/binary.exit" 2>/dev/null || echo "1")
    BINARY_END=$(date +%s)
    BINARY_DURATION=$((BINARY_END - BINARY_START))
fi

if [ -n "$DATABASE_PID" ]; then
    wait "$DATABASE_PID" 2>/dev/null || true
    DATABASE_EXIT=$(cat "${STATUS_DIR}/database.exit" 2>/dev/null || echo "1")
    DATABASE_END=$(date +%s)
    DATABASE_DURATION=$((DATABASE_END - DATABASE_START))
fi

# Limpar arquivos de status
rm -rf "${STATUS_DIR}"

# ============================================
# Coletar tamanhos dos backups criados
# ============================================

# Backup de binários mais recente
LATEST_BINARY=$(ls -1dt "${BACKUP_DIR}"/rustfs-backup-* 2>/dev/null | grep -v '\.inprogress$' | head -n1 || true)
BINARY_SIZE=""
if [ -n "$LATEST_BINARY" ] && [ -d "$LATEST_BINARY" ]; then
    BINARY_APPARENT=$(du -sh --apparent-size "${LATEST_BINARY}/data" 2>/dev/null | cut -f1 || echo "?")
    BINARY_DISK=$(du -sh "${LATEST_BINARY}/data" 2>/dev/null | cut -f1 || echo "?")
    BINARY_SIZE="${BINARY_APPARENT} aparente / ${BINARY_DISK} em disco"
fi

# Backup de banco mais recente
LATEST_DB=$(ls -1dt "${BACKUP_DIR}"/db-backup-* 2>/dev/null | grep -v '\.inprogress$' | head -n1 || true)
DB_SIZE=""
if [ -n "$LATEST_DB" ] && [ -d "$LATEST_DB" ]; then
    DB_SIZE=$(du -sh "${LATEST_DB}" 2>/dev/null | cut -f1 || echo "?")
fi

# Uso total do diretório de backups
TOTAL_BACKUP_USAGE=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1 || echo "?")

# ============================================
# Relatório final
# ============================================

ALL_OK=true

hr
log "📊 RELATÓRIO FINAL — $(date '+%Y-%m-%d %H:%M:%S')"
hr
log ""

# Binários
if [ "$SKIP_BINARIES" = false ]; then
    if [ "${BINARY_EXIT}" = "0" ]; then
        log "🖼️  Binários (RustFS):   ✅ SUCESSO"
        log "   Backup:   $(basename "${LATEST_BINARY:-N/A}")"
        [ -n "$BINARY_SIZE" ] && log "   Tamanho: ${BINARY_SIZE}"
        log "   Tempo:    $(duration_human $BINARY_DURATION)"
    else
        log "🖼️  Binários (RustFS):   ❌ FALHA (código: ${BINARY_EXIT})"
        log "   Log: ${STATUS_DIR}/binary.log"
        ALL_OK=false
    fi
    log ""
fi

# Banco de dados
if [ "$SKIP_DATABASE" = false ]; then
    if [ "${DATABASE_EXIT}" = "0" ]; then
        log "🗄️  Banco de dados:      ✅ SUCESSO"
        log "   Backup:   $(basename "${LATEST_DB:-N/A}")"
        [ -n "$DB_SIZE" ] && log "   Tamanho: ${DB_SIZE}"
        log "   Tempo:    $(duration_human $DATABASE_DURATION)"
    else
        log "🗄️  Banco de dados:      ❌ FALHA (código: ${DATABASE_EXIT})"
        ALL_OK=false
    fi
    log ""
fi

log "───────────────────────────────────────────────────────────"
log "⏱️  Tempo total:          $(duration_human $TOTAL_DURATION)"
log "💾 Uso total em backups: ${TOTAL_BACKUP_USAGE}"
log ""

if [ "$ALL_OK" = true ]; then
    log "✅ BACKUP COMPLETO CONCLUÍDO COM SUCESSO!"
else
    log "⚠️  BACKUP CONCLUÍDO COM ERROS — verifique os logs acima"
fi

hr

# Salvar resumo no log do orquestrador
{
    echo "=== BACKUP ALL ==="
    echo "timestamp: ${TIMESTAMP}"
    echo "binaries: $([ "$SKIP_BINARIES" = true ] && echo "skipped" || echo "exit=${BINARY_EXIT}")"
    echo "database: $([ "$SKIP_DATABASE" = true ] && echo "skipped" || echo "exit=${DATABASE_EXIT}")"
    echo "duration: $(duration_human $TOTAL_DURATION)"
    echo "total_usage: ${TOTAL_BACKUP_USAGE}"
} >> "${ORCHESTRATOR_LOG}"

if [ "$ALL_OK" = false ]; then
    exit 1
fi
