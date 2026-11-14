#!/bin/bash

# Remove os backups legados no formato .tar.zst (cópias completas, sem
# deduplicação) depois que já existe pelo menos um backup verificado no
# formato deduplicado (rustfs-backup-*/). Também limpa .inprogress órfãos
# de execuções interrompidas e arquivos .tar.zst corrompidos/vazios.
#
# Por segurança:
#   - Roda em modo dry-run por padrão. Só apaga de verdade com --apply.
#   - Só remove os .tar.zst "bons" (grandes) se existir pelo menos um
#     rustfs-backup-* completo cujo manifest.sha256 bate 100% — nunca apaga
#     a única cópia de segurança dos dados só porque um diretório existe.
#   - Sempre mantém os N .tar.zst mais recentes como rede de segurança
#     adicional (padrão: 1).
#
# Uso: ./prune-legacy-backups.sh [diretório-de-backups] [opções]
#
# Opções:
#   --apply         Executa de verdade (padrão: dry-run)
#   --keep-legacy N Quantos .tar.zst recentes manter mesmo após validar o
#                   novo formato (padrão: 1)
#   --keep-logs N   Quantos logs de cada tipo manter (padrão: 10)
#   -q              Modo silencioso
#   -h              Mostrar ajuda

set -euo pipefail

# shellcheck source=./_tools-check.sh
source "$(dirname "$(realpath "$0")")/_tools-check.sh"

BACKUP_DIR="./backups"
APPLY=false
KEEP_LEGACY=1
KEEP_LOGS=10
QUIET=false

show_help() {
    cat <<EOF
Uso: $0 [diretório-de-backups] [opções]

Opções:
  --apply         Executa de verdade (padrão: dry-run, não apaga nada)
  --keep-legacy N Quantos .tar.zst recentes manter (padrão: 1)
  --keep-logs N   Quantos logs de cada tipo manter (padrão: 10)
  -q              Modo silencioso
  -h              Mostrar esta ajuda

Exemplos:
  $0 ./backups                    # dry-run — só mostra o que faria
  $0 ./backups --apply            # executa a limpeza
  $0 ./backups --keep-legacy 2 --apply
EOF
}

log() { [ "$QUIET" = false ] && echo "$1" || true; }
hr() { log "────────────────────────────────────────────────────"; }

bytes_of() { stat -c%s "$1" 2>/dev/null || echo 0; }
human_of() { du -sh "$1" 2>/dev/null | cut -f1 || echo "?"; }

# ============================================
# Parse de argumentos
# ============================================

if [ $# -gt 0 ] && [[ ! "${1:-}" =~ ^- ]]; then
    BACKUP_DIR="$1"
    shift
fi

while [ $# -gt 0 ]; do
    case "$1" in
        --apply) APPLY=true; shift ;;
        --keep-legacy) KEEP_LEGACY="$2"; shift 2 ;;
        --keep-logs) KEEP_LOGS="$2"; shift 2 ;;
        -q) QUIET=true; shift ;;
        -h) show_help; exit 0 ;;
        *) echo "Opção desconhecida: $1"; show_help; exit 1 ;;
    esac
done

if [ ! -d "${BACKUP_DIR}" ]; then
    echo "❌ Diretório não encontrado: ${BACKUP_DIR}"
    exit 1
fi

ensure_tools sha256sum

do_rm() {
    # do_rm <descrição> <caminho...>
    local desc="$1"; shift
    if [ "$APPLY" = true ]; then
        log "   🗑️  ${desc}"
        rm -rf "$@"
    else
        log "   [dry-run] removeria: ${desc}"
    fi
}

hr
log "🧹 LIMPEZA DE BACKUPS LEGADOS — $(date '+%Y-%m-%d %H:%M:%S')"
hr
log "📁 Diretório: ${BACKUP_DIR}"
log "$([ "$APPLY" = true ] && echo "⚠️  Modo: APLICANDO ALTERAÇÕES" || echo "👀 Modo: dry-run (nada será apagado)")"
log ""

FREED_BYTES=0

# ============================================
# 1. Remover .inprogress órfãos
# ============================================

log "1️⃣  Backups .inprogress órfãos"
mapfile -t ORPHANED < <(find "${BACKUP_DIR}" -maxdepth 1 -type d \( -name 'rustfs-backup-*.inprogress' -o -name 'db-backup-*.inprogress' \) 2>/dev/null || true)
if [ ${#ORPHANED[@]} -eq 0 ]; then
    log "   ✅ Nenhum encontrado."
else
    for orphan in "${ORPHANED[@]}"; do
        SIZE=$(bytes_of "${orphan}")
        FREED_BYTES=$((FREED_BYTES + SIZE))
        do_rm "$(basename "${orphan}") ($(human_of "${orphan}"))" "${orphan}"
    done
fi
log ""

# ============================================
# 2. Remover .tar.zst corrompidos/vazios (< 1MB)
# ============================================

log "2️⃣  Arquivos .tar.zst corrompidos ou vazios (< 1MB)"
TINY_FOUND=false
for f in "${BACKUP_DIR}"/*.tar.zst; do
    [ -e "$f" ] || continue
    SIZE=$(bytes_of "$f")
    if [ "$SIZE" -lt $((1024 * 1024)) ]; then
        TINY_FOUND=true
        FREED_BYTES=$((FREED_BYTES + SIZE))
        do_rm "$(basename "$f") (${SIZE} bytes)" "$f" "${f}.sha256"
    fi
done
[ "$TINY_FOUND" = false ] && log "   ✅ Nenhum encontrado."
log ""

# ============================================
# 3. Remover .tar.zst legados grandes (só se houver backup dedup verificado)
# ============================================

log "3️⃣  Backups .tar.zst legados (formato completo, sem deduplicação)"

# O script de backup já teve dois nomes ao longo do tempo (api-data-backup-*
# e rustfs-data-backup-*) — cobrir os dois evita deixar backups antigos
# "invisíveis" para a limpeza.
mapfile -t LEGACY < <(find "${BACKUP_DIR}" -maxdepth 1 -type f \
    \( -name 'rustfs-data-backup-*.tar.zst' -o -name 'api-data-backup-*.tar.zst' \) \
    -size +1M 2>/dev/null | sort || true)

if [ ${#LEGACY[@]} -eq 0 ]; then
    log "   ✅ Nenhum .tar.zst legado (>1MB) encontrado."
else
    # Procurar pelo menos um rustfs-backup-* completo com manifest verificado
    VALID_DEDUP_BACKUP=""
    while IFS= read -r -d '' candidate; do
        if [ -f "${candidate}/info.txt" ] && [ -f "${candidate}/manifest.sha256" ] && [ -d "${candidate}/data" ]; then
            log "   🔍 Verificando manifesto de $(basename "${candidate}")..."
            if (cd "${candidate}/data" && sha256sum -c ../manifest.sha256 --quiet) >/dev/null 2>&1; then
                VALID_DEDUP_BACKUP="${candidate}"
                break
            else
                log "      ⚠️  Manifesto não bateu — ignorando como candidato"
            fi
        fi
    done < <(find "${BACKUP_DIR}" -maxdepth 1 -type d -name 'rustfs-backup-*' ! -name '*.inprogress' -print0 2>/dev/null | sort -rz)

    if [ -z "${VALID_DEDUP_BACKUP}" ]; then
        log "   ⛔ Nenhum backup no formato deduplicado com manifesto verificado foi encontrado."
        log "      Os .tar.zst legados NÃO serão removidos — rode backup-api-data.sh"
        log "      primeiro para gerar e validar um backup no novo formato."
        for f in "${LEGACY[@]}"; do
            log "      (mantido) $(basename "$f")  ($(human_of "$f"))"
        done
    else
        log "   ✅ Backup deduplicado verificado: $(basename "${VALID_DEDUP_BACKUP}")"

        # Ordenar por mtime decrescente (mais recente primeiro) e manter os N
        # primeiros. Não dá para ordenar pelo nome do arquivo: os dois
        # prefixos legados (api-data-backup-* e rustfs-data-backup-*)
        # colidem alfabeticamente sem refletir a ordem cronológica real.
        mapfile -t LEGACY_DESC < <(
            for f in "${LEGACY[@]}"; do printf '%s\t%s\n' "$(stat -c%Y "$f" 2>/dev/null || echo 0)" "$f"; done \
                | sort -rn | cut -f2-
        )
        TO_KEEP=("${LEGACY_DESC[@]:0:${KEEP_LEGACY}}")
        TO_REMOVE=("${LEGACY_DESC[@]:${KEEP_LEGACY}}")

        for f in "${TO_KEEP[@]}"; do
            log "   🛡️  Mantido (rede de segurança): $(basename "$f")  ($(human_of "$f"))"
        done

        for f in "${TO_REMOVE[@]}"; do
            SIZE=$(bytes_of "$f")
            FREED_BYTES=$((FREED_BYTES + SIZE))
            SHA="${f}.sha256"
            if [ -f "${SHA}" ]; then
                do_rm "$(basename "$f")  ($(human_of "$f"))" "$f" "${SHA}"
            else
                do_rm "$(basename "$f")  ($(human_of "$f"))" "$f"
            fi
        done
    fi
fi
log ""

# ============================================
# 4. Podar logs antigos
# ============================================

log "4️⃣  Logs antigos (mantendo os ${KEEP_LOGS} mais recentes de cada tipo)"
for pattern in 'backup-*.log' 'db-backup-*.log' 'backup-all-*.log' 'restore-*.log'; do
    mapfile -t LOGS < <(find "${BACKUP_DIR}" -maxdepth 1 -type f -name "${pattern}" 2>/dev/null | sort -r || true)
    if [ "${#LOGS[@]}" -gt "$KEEP_LOGS" ]; then
        for old_log in "${LOGS[@]:${KEEP_LOGS}}"; do
            SIZE=$(bytes_of "${old_log}")
            FREED_BYTES=$((FREED_BYTES + SIZE))
            do_rm "$(basename "${old_log}")" "${old_log}"
        done
    fi
done
log ""

# ============================================
# Relatório final
# ============================================

FREED_HUMAN=$((FREED_BYTES / 1024 / 1024 / 1024))
hr
if [ "$APPLY" = true ]; then
    log "✅ LIMPEZA CONCLUÍDA — aproximadamente ${FREED_HUMAN}GB liberados"
else
    log "📋 DRY-RUN CONCLUÍDO — aproximadamente ${FREED_HUMAN}GB seriam liberados"
    log "   Execute novamente com --apply para aplicar de verdade."
fi
hr
