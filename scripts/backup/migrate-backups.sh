#!/bin/bash

# Migra backups antigos (.tar.zst) para o novo formato com deduplicação via hardlinks.
#
# Uso: ./migrate-backups.sh [diretório-de-backups] [opções]
#
# Opções:
#   -d      Dry-run: mostra o que seria feito sem alterar nada
#   -k      Manter os arquivos .tar.zst originais após migração (não deleta)
#   -h      Mostrar ajuda
#
# O que este script faz:
#   1. Encontra todos os rustfs-data-backup-*.tar.zst no diretório
#   2. Extrai cada um em ordem cronológica
#   3. Recria como diretório rustfs-backup-* com hardlinks entre backups
#   4. Remove os .tar.zst originais (liberando espaço imediatamente)

set -euo pipefail

# Carregar utilitário de verificação/instalação de ferramentas
# shellcheck source=_tools-check.sh
source "$(dirname "$(realpath "$0")")/_tools-check.sh"

# ============================================
# Configurações
# ============================================
BACKUP_DIR="./backups"
DRY_RUN=false
KEEP_ORIGINALS=false

# ============================================
# Funções utilitárias
# ============================================

show_help() {
    echo "Uso: $0 [diretório-de-backups] [opções]"
    echo ""
    echo "Opções:"
    echo "  -d      Dry-run (não altera nada, só mostra o que faria)"
    echo "  -k      Manter os .tar.zst originais após migração"
    echo "  -h      Mostrar esta ajuda"
    echo ""
    echo "Exemplo:"
    echo "  $0 ./backups        # Migra todos os .tar.zst em ./backups"
    echo "  $0 ./backups -d     # Simula sem alterar nada"
    echo "  $0 ./backups -k     # Migra mas mantém os .tar.zst"
}

log() { echo "$1"; }
log_dry() { echo "  [dry-run] $1"; }

hr() { echo "────────────────────────────────────────────────────"; }

bytes_to_human() {
    local bytes=$1
    if [ "$bytes" -ge $((1024 * 1024 * 1024)) ]; then
        echo "$((bytes / 1024 / 1024 / 1024))GB"
    elif [ "$bytes" -ge $((1024 * 1024)) ]; then
        echo "$((bytes / 1024 / 1024))MB"
    else
        echo "$((bytes / 1024))KB"
    fi
}

# ============================================
# Parse de argumentos
# ============================================

if [ $# -gt 0 ] && [[ ! "${1:-}" =~ ^- ]]; then
    BACKUP_DIR="$1"
    shift
fi

while getopts "dkh" opt; do
    case $opt in
        d) DRY_RUN=true ;;
        k) KEEP_ORIGINALS=true ;;
        h) show_help; exit 0 ;;
        *) show_help; exit 1 ;;
    esac
done

# ============================================
# Validações
# ============================================

if [ ! -d "${BACKUP_DIR}" ]; then
    log "❌ Diretório não encontrado: ${BACKUP_DIR}"
    exit 1
fi

# Verificar e instalar ferramentas necessárias
# rsync e zstd têm fallback via Docker Alpine se não puderem ser instalados
ensure_tools rsync zstd tar sha256sum

# ============================================
# Limpar backups .inprogress órfãos de migrações interrompidas
# ============================================

mapfile -t ORPHANED < <(find "${BACKUP_DIR}" -maxdepth 1 -type d -name 'rustfs-backup-*.inprogress' 2>/dev/null || true)
if [ ${#ORPHANED[@]} -gt 0 ]; then
    log "🧹 Removendo ${#ORPHANED[@]} backup(s) .inprogress órfão(s) de migrações interrompidas anteriormente..."
    for orphan in "${ORPHANED[@]}"; do
        if [ "$DRY_RUN" = true ]; then
            log_dry "remover órfão: $(basename "${orphan}")"
        else
            log "   $(basename "${orphan}")"
            rm -rf "${orphan}"
        fi
    done
    log ""
fi

# ============================================
# Descobrir backups antigos
# ============================================

# O script de backup já teve dois nomes ao longo do tempo (api-data-backup-*
# e rustfs-data-backup-*) — cobrir os dois evita deixar backups antigos de
# fora da migração. Ordenar por mtime (não por nome): os dois prefixos
# colidem alfabeticamente sem refletir a ordem cronológica real, e a ordem
# aqui importa — o loop encadeia cada migração via --link-dest na anterior.
mapfile -t OLD_BACKUPS < <(
    find "${BACKUP_DIR}" -maxdepth 1 -type f \
        \( -name 'rustfs-data-backup-*.tar.zst' -o -name 'api-data-backup-*.tar.zst' \) \
        -printf '%T@\t%p\n' 2>/dev/null | sort -n | cut -f2-
)

if [ ${#OLD_BACKUPS[@]} -eq 0 ]; then
    log "✅ Nenhum backup antigo (.tar.zst) encontrado em: ${BACKUP_DIR}"
    log ""
    log "Backups no novo formato já existentes:"
    ls -1d "${BACKUP_DIR}"/rustfs-backup-* 2>/dev/null | while read -r b; do
        SIZE=$(du -sh "$b" 2>/dev/null | cut -f1)
        log "   ${SIZE}  $(basename "$b")"
    done || log "   (nenhum)"
    exit 0
fi

# ============================================
# Relatório inicial
# ============================================

log ""
log "════════════════════════════════════════════════════"
log "🔄 MIGRAÇÃO DE BACKUPS: .tar.zst → formato deduplicado"
log "════════════════════════════════════════════════════"
log ""
log "📁 Diretório: ${BACKUP_DIR}"
log "📦 Backups antigos encontrados: ${#OLD_BACKUPS[@]}"
log ""

TOTAL_OLD_BYTES=0
for backup in "${OLD_BACKUPS[@]}"; do
    SIZE_BYTES=$(stat -c%s "$backup" 2>/dev/null || echo 0)
    SIZE_HUMAN=$(du -sh "$backup" 2>/dev/null | cut -f1)
    TOTAL_OLD_BYTES=$((TOTAL_OLD_BYTES + SIZE_BYTES))
    # Extrair timestamp do nome do arquivo
    FNAME=$(basename "$backup")
    log "   📄 ${FNAME}  (${SIZE_HUMAN})"
done

log ""
log "   📐 Espaço total ocupado: $(bytes_to_human $TOTAL_OLD_BYTES)"
log "   💡 Após migração: apenas arquivos únicos entre backups"
log "      (estimativa de economia: 40-80% para volumes de imagens)"
log ""

if [ "$DRY_RUN" = true ]; then
    log "⚠️  MODO DRY-RUN ATIVO — nenhum arquivo será alterado"
    log ""
fi

# Confirmação interativa (apenas se não for dry-run)
if [ "$DRY_RUN" = false ] && [ -t 0 ]; then
    read -rp "Prosseguir com a migração? [s/N] " CONFIRM
    if [[ ! "${CONFIRM}" =~ ^[sS]$ ]]; then
        log "Cancelado."
        exit 0
    fi
    log ""
fi

# ============================================
# Migração
# ============================================

EXTRACT_BASE="${BACKUP_DIR}/.migration-staging"
MIGRATED=()
FAILED=()
PREV_DATA_DIR=""
CURRENT_INPROGRESS=""

cleanup_migration() {
    if [ -d "${EXTRACT_BASE}" ]; then
        log ""
        log "🧹 Limpando staging temporário..."
        rm -rf "${EXTRACT_BASE}"
    fi
    # Remove o backup .inprogress da iteração corrente se a migração foi
    # interrompida no meio (o loop, por não rodar dentro de um subshell,
    # nunca chegava a limpar isso antes — deixava diretórios órfãos).
    if [ -n "${CURRENT_INPROGRESS}" ] && [ -d "${CURRENT_INPROGRESS}" ]; then
        log "🧹 Removendo backup incompleto: $(basename "${CURRENT_INPROGRESS}")"
        rm -rf "${CURRENT_INPROGRESS}"
    fi
}
trap cleanup_migration EXIT INT TERM

for backup in "${OLD_BACKUPS[@]}"; do
    FNAME=$(basename "$backup")
    hr

    # Extrair o timestamp do nome: rustfs-data-backup-YYYYMMDD_HHMMSS.tar.zst
    TS=$(echo "$FNAME" | grep -oP '\d{8}_\d{6}' || echo "$(date +%Y%m%d_%H%M%S)")
    NEW_NAME="rustfs-backup-${TS}"
    NEW_PATH="${BACKUP_DIR}/${NEW_NAME}"
    INPROGRESS_PATH="${NEW_PATH}.inprogress"
    CURRENT_INPROGRESS="${INPROGRESS_PATH}"

    log "🔄 Migrando: ${FNAME}"
    log "   → Destino: ${NEW_NAME}/"

    # Verificar se já foi migrado
    if [ -d "${NEW_PATH}" ]; then
        log "   ⏭️  Já migrado, pulando."
        PREV_DATA_DIR="${NEW_PATH}/data"
        MIGRATED+=("${NEW_NAME}")
        continue
    fi

    if [ "$DRY_RUN" = true ]; then
        log_dry "extrair ${FNAME} → .migration-staging/${TS}/"
        if [ -n "${PREV_DATA_DIR}" ]; then
            log_dry "rsync --link-dest=${PREV_DATA_DIR} → ${NEW_NAME}/data/"
        else
            log_dry "rsync (primeiro backup, sem link-dest) → ${NEW_NAME}/data/"
        fi
        log_dry "gerar manifest.sha256"
        if [ "$KEEP_ORIGINALS" = false ]; then
            log_dry "remover ${FNAME} e ${FNAME}.sha256"
        fi
        PREV_DATA_DIR="${NEW_PATH}/data"
        continue
    fi

    # --- Extração ---
    EXTRACT_DIR="${EXTRACT_BASE}/${TS}"
    mkdir -p "${EXTRACT_DIR}"

    log "   📤 Extraindo..."
    if ! extract_zst_with_fallback "$backup" "${EXTRACT_DIR}"; then
        log "   ❌ Falha na extração de ${FNAME}"
        FAILED+=("${FNAME}")
        rm -rf "${EXTRACT_DIR}"
        continue
    fi

    EXTRACTED_FILES=$(find "${EXTRACT_DIR}" -type f | wc -l)
    log "   ✓ Extraídos: ${EXTRACTED_FILES} arquivos"

    # --- Rsync com hardlinks ---
    mkdir -p "${INPROGRESS_PATH}/data"

    LINK_DEST_ARG=""
    if [ -n "${PREV_DATA_DIR}" ] && [ -d "${PREV_DATA_DIR}" ]; then
        LINK_DEST_ARG="--link-dest=${PREV_DATA_DIR}"
        log "   🔗 Deduplicando contra: $(basename "$(dirname "${PREV_DATA_DIR}")")"
    else
        log "   🔗 Primeiro backup (sem deduplicação)"
    fi

    # Usar rsync do host ou fallback Docker (hardlinks funcionam via bind mount)
    if [ -n "${LINK_DEST_ARG}" ]; then
        rsync_with_fallback -a --no-owner --no-group \
            "${LINK_DEST_ARG}" \
            "${EXTRACT_DIR}/" \
            "${INPROGRESS_PATH}/data/"
    else
        rsync_with_fallback -a --no-owner --no-group \
            "${EXTRACT_DIR}/" \
            "${INPROGRESS_PATH}/data/"
    fi

    # Limpar staging desta iteração imediatamente (libera espaço)
    rm -rf "${EXTRACT_DIR}"

    # --- Manifesto ---
    log "   🔐 Gerando manifest.sha256..."
    find "${INPROGRESS_PATH}/data" -type f -printf '%P\n' | LC_ALL=C sort > "${INPROGRESS_PATH}/.filelist.tmp"
    hash_filelist "${INPROGRESS_PATH}/.filelist.tmp" "${INPROGRESS_PATH}/data" "${INPROGRESS_PATH}/manifest.sha256"
    TOTAL_FILES=$(wc -l < "${INPROGRESS_PATH}/.filelist.tmp")
    rm -f "${INPROGRESS_PATH}/.filelist.tmp"

    # --- Info ---
    APPARENT=$(du -sh --apparent-size "${INPROGRESS_PATH}/data" 2>/dev/null | cut -f1)
    DISK=$(du -sh "${INPROGRESS_PATH}/data" 2>/dev/null | cut -f1)

    cat > "${INPROGRESS_PATH}/info.txt" << EOF
backup_name:      ${NEW_NAME}
source:           ${FNAME}  [migrado]
timestamp:        ${TS}
migrated_at:      $(date -Iseconds)
total_files:      ${TOTAL_FILES}
apparent_size:    ${APPARENT}
disk_size:        ${DISK}
link_dest:        ${PREV_DATA_DIR:-none}
EOF

    # --- Finalizar ---
    mv "${INPROGRESS_PATH}" "${NEW_PATH}"
    CURRENT_INPROGRESS=""  # limpar para não deletar no cleanup_migration
    PREV_DATA_DIR="${NEW_PATH}/data"
    MIGRATED+=("${NEW_NAME}")

    FINAL_DISK=$(du -sh "${NEW_PATH}/data" 2>/dev/null | cut -f1)
    log "   ✅ Migrado: ${APPARENT} aparente, ${FINAL_DISK} em disco"

    # --- Remover original ---
    if [ "$KEEP_ORIGINALS" = false ]; then
        log "   🗑️  Removendo original: ${FNAME}"
        rm -f "$backup"
        # O sidecar de checksum é "<nome>.tar.zst.sha256" (sufixo anexado ao
        # nome completo, não uma troca de extensão) — ver scripts antigos de
        # backup, que geravam `sha256sum > ${BACKUP_FILE}.sha256`.
        rm -f "${backup}.sha256" 2>/dev/null || true
    fi
done

# ============================================
# Relatório final
# ============================================

hr
log ""
log "════════════════════════════════════════════════════"

if [ "$DRY_RUN" = true ]; then
    log "📋 DRY-RUN CONCLUÍDO — execute sem -d para migrar de verdade"
    log "════════════════════════════════════════════════════"
    exit 0
fi

log "✅ MIGRAÇÃO CONCLUÍDA"
log "════════════════════════════════════════════════════"

if [ ${#MIGRATED[@]} -gt 0 ]; then
    log ""
    log "✅ Migrados com sucesso (${#MIGRATED[@]}):"
    for name in "${MIGRATED[@]}"; do
        if [ -d "${BACKUP_DIR}/${name}" ]; then
            DISK=$(du -sh "${BACKUP_DIR}/${name}/data" 2>/dev/null | cut -f1)
            log "   ${name}/  (${DISK} em disco)"
        else
            log "   ${name}  (já existia)"
        fi
    done
fi

if [ ${#FAILED[@]} -gt 0 ]; then
    log ""
    log "❌ Falhas (${#FAILED[@]}) — .tar.zst originais mantidos:"
    for name in "${FAILED[@]}"; do
        log "   ${name}"
    done
fi

# Espaço liberado
REMAINING_OLD=$(du -sh "${BACKUP_DIR}"/*.tar.zst 2>/dev/null | awk '{sum += $1} END {print sum}' || true)
NEW_TOTAL=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1)

log ""
log "💾 Uso total atual do diretório de backups: ${NEW_TOTAL}"
log "   (antes era: $(bytes_to_human $TOTAL_OLD_BYTES) só nos .tar.zst)"
log "════════════════════════════════════════════════════"
