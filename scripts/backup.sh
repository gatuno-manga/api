#!/bin/bash
# backup.sh — Gerenciador unificado de backups do ecossistema Gatuno
#
# Uso:
#   ./scripts/backup.sh [comando] [diretório] [opções]
#
# Comandos disponíveis:
#   all            (Padrão) Executa backup completo (binários RustFS + MySQL + Redis)
#   db             Executa backup apenas do banco de dados (MySQL + Redis)
#   data           Executa backup apenas dos binários RustFS (com deduplicação)
#   pre-migration  Executa backup de segurança do banco antes de aplicar migrations
#   list           Lista todos os backups existentes com detalhes e tamanhos
#   restore [db|data] [caminho]
#                  Restaura um backup com verificação de integridade SHA256
#   prune          Remove backups legados .tar.zst com segurança
#   schedule       Instala e ativa o systemd timer para backup automático diário
#   help           Mostra esta mensagem de ajuda

set -euo pipefail

SCRIPT_DIR="$(dirname "$(realpath "$0")")"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_SCRIPTS_DIR="${SCRIPT_DIR}/backup"

if [ -d "${PROJECT_DIR}/../infra/backups" ]; then
    BACKUPS_DIR="$(cd "${PROJECT_DIR}/../infra/backups" && pwd)"
elif [ -d "${PROJECT_DIR}/backups" ]; then
    BACKUPS_DIR="${PROJECT_DIR}/backups"
else
    BACKUPS_DIR="${PROJECT_DIR}/backups"
fi

ENV_FILE="${PROJECT_DIR}/.env"
[ ! -f "${ENV_FILE}" ] && [ -f "${PROJECT_DIR}/../infra/.env" ] && ENV_FILE="${PROJECT_DIR}/../infra/.env"
[ ! -f "${ENV_FILE}" ] && [ -f "${PROJECT_DIR}/../api/.env" ] && ENV_FILE="${PROJECT_DIR}/../api/.env"

# ============================================
# Helpers
# ============================================

hr() {
    echo "════════════════════════════════════════════════════════════"
}

show_help() {
    cat <<HELPEOF
Gatuno Backup Manager — CLI de gerenciamento de backups

Uso:
  $0 [comando] [diretório] [opções]

  [diretório] é opcional e substitui o diretório de backups padrão
  (em "restore", é o caminho do backup a restaurar).

Comandos:
  all              Backup completo (RustFS + MySQL + Redis em paralelo)
  db               Backup apenas do banco de dados (MySQL + Redis)
  data             Backup apenas dos binários RustFS (deduplicado)
  pre-migration    Backup do banco antes de rodar migrations SQL
  list             Lista backups disponíveis, tamanhos e datas
  restore db       Restaura um backup de banco de dados
  restore data     Restaura um backup de binários RustFS
  prune            Limpa backups antigos no formato legado .tar.zst
  schedule         Configura agendamento automático via systemd timer (03:00)
  help             Mostra esta ajuda

Opções comuns repassadas aos scripts:
  -r N             Manter últimos N backups (padrão: 5)
  -s               Parar containers para consistência máxima
  -q               Modo silencioso

Exemplos rápidos:
  $0                                # Backup completo padrão
  $0 db                             # Apenas MySQL + Redis
  $0 all /backups -q                # Backup completo em /backups, silencioso
  $0 pre-migration                  # Snapshot rápido pré-migration
  $0 list                           # Ver histórico e espaço ocupado
  $0 restore db                     # Menu interativo de restauração de banco
  $0 restore data                   # Menu interativo de restauração de imagens
HELPEOF
}

cmd_list() {
    hr
    echo "📋 BACKUPS DISPONÍVEIS — ${BACKUPS_DIR}"
    hr
    echo ""

    echo "🗄️  BANCO DE DADOS (MySQL + Redis):"
    local db_count=0
    while IFS= read -r d; do
        if [ -n "$d" ] && [ -d "$d" ]; then
            db_count=$((db_count + 1))
            local size
            size=$(du -sh "$d" 2>/dev/null | cut -f1)
            local files
            files=$(find "$d" -type f ! -name '.*' | wc -l)
            echo "   • $(basename "$d")  |  Tamanho: ${size}  |  Arquivos: ${files}"
        fi
    done < <(find "${BACKUPS_DIR}" -maxdepth 1 -type d -name 'db-backup-*' ! -name '*.inprogress' 2>/dev/null | sort -r)

    if [ "$db_count" -eq 0 ]; then
        echo "   (Nenhum backup de banco encontrado)"
    fi
    echo ""

    echo "🖼️  BINÁRIOS RUSTFS (Deduplicados via hardlinks):"
    local bin_count=0
    while IFS= read -r d; do
        if [ -n "$d" ] && [ -d "$d" ]; then
            bin_count=$((bin_count + 1))
            local app_size disk_size
            app_size=$(du -sh --apparent-size "${d}/data" 2>/dev/null | cut -f1 || echo "?")
            disk_size=$(du -sh "${d}/data" 2>/dev/null | cut -f1 || echo "?")
            local total_f
            total_f=$(wc -l < "${d}/manifest.sha256" 2>/dev/null || echo "?")
            echo "   • $(basename "$d")  |  Aparente: ${app_size} / Disco: ${disk_size}  |  Arquivos: ${total_f}"
        fi
    done < <(find "${BACKUPS_DIR}" -maxdepth 1 -type d -name 'rustfs-backup-*' ! -name '*.inprogress' 2>/dev/null | sort -r)

    if [ "$bin_count" -eq 0 ]; then
        echo "   (Nenhum backup de binários encontrado)"
    fi
    echo ""

    local total_usage
    total_usage=$(du -sh "${BACKUPS_DIR}" 2>/dev/null | cut -f1 || echo "?")
    hr
    echo "💾 Espaço total em disco ocupado por backups: ${total_usage}"
    hr
}

cmd_schedule() {
    hr
    echo "⏰ Configuração do Systemd Timer para Backups Automáticos"
    hr
    echo ""
    echo "Para ativar o backup diário automático às 03:00 em produção, execute como root (sudo):"
    echo ""
    echo "  sudo cp \"${BACKUP_SCRIPTS_DIR}/gatuno-backup.service\" /etc/systemd/system/"
    echo "  sudo cp \"${BACKUP_SCRIPTS_DIR}/gatuno-backup.timer\" /etc/systemd/system/"
    echo "  sudo systemctl daemon-reload"
    echo "  sudo systemctl enable --now gatuno-backup.timer"
    echo ""
    echo "Para verificar status do timer:"
    echo "  systemctl list-timers | grep gatuno"
    echo "  journalctl -u gatuno-backup.service -f"
    hr
}

# ============================================
# Router de comandos
# ============================================

CMD="${1:-all}"
shift || true

RESTORE_TYPE=""
if [ "$CMD" = "restore" ]; then
    RESTORE_TYPE="${1:-}"
    shift || true
fi

# Um diretório posicional (ex: "all /backups -q") substitui o padrão. Ele é
# consumido aqui porque os scripts esperam o diretório como primeiro argumento
# e as flags depois — repassá-lo no meio das flags interrompe o getopts deles.
if [ $# -gt 0 ] && [[ ! "$1" =~ ^- ]]; then
    BACKUPS_DIR="$1"
    shift
fi

case "$CMD" in
    all)
        "${BACKUP_SCRIPTS_DIR}/backup-all.sh" "${BACKUPS_DIR}" -e "${ENV_FILE}" "$@"
        ;;
    db)
        "${BACKUP_SCRIPTS_DIR}/backup-database.sh" "${BACKUPS_DIR}" -e "${ENV_FILE}" "$@"
        ;;
    data)
        "${BACKUP_SCRIPTS_DIR}/backup-api-data.sh" "${BACKUPS_DIR}" "$@"
        ;;
    pre-migration)
        hr
        echo "🛡️  Executando snapshot de segurança pré-migration..."
        hr
        "${BACKUP_SCRIPTS_DIR}/backup-database.sh" "${BACKUPS_DIR}" -e "${ENV_FILE}" "$@"
        echo ""
        echo "✅ Snapshot do banco concluído. Seguro para aplicar migrations!"
        ;;
    list|ls)
        cmd_list
        ;;
    restore)
        if [ "$RESTORE_TYPE" = "db" ]; then
            "${BACKUP_SCRIPTS_DIR}/restore-database.sh" "${BACKUPS_DIR}" -e "${ENV_FILE}" "$@"
        elif [ "$RESTORE_TYPE" = "data" ]; then
            "${BACKUP_SCRIPTS_DIR}/restore-api-data.sh" "${BACKUPS_DIR}" "$@"
        else
            echo "Uso: $0 restore [db|data] [opções]"
            exit 1
        fi
        ;;
    prune)
        "${BACKUP_SCRIPTS_DIR}/prune-legacy-backups.sh" "${BACKUPS_DIR}" "$@"
        ;;
    schedule)
        cmd_schedule
        ;;
    help|-h|--help)
        show_help
        ;;
    *)
        echo "❌ Comando desconhecido: '$CMD'"
        echo ""
        show_help
        exit 1
        ;;
esac
