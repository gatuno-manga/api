#!/bin/bash

# Script para restaurar o backup do volume api-data
# Uso: ./restore-api-data.sh <arquivo-de-backup> [opções]
#
# Opções:
#   -s      Parar container da API antes do restore
#   -f      Forçar (sem confirmação)
#   -v      Verificar hash SHA256 antes de restaurar
#   -q      Modo silencioso
#   -h      Mostrar ajuda

set -e

# ============================================
# Configurações
# ============================================
VOLUME_NAME="gatuno_api-data"
STOP_CONTAINER=false
FORCE=false
VERIFY_HASH=false
QUIET=false
BACKUP_FILE=""
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE=""

# ============================================
# Funções utilitárias
# ============================================

show_help() {
    echo "Uso: $0 <arquivo-de-backup> [opções]"
    echo ""
    echo "Opções:"
    echo "  -s      Parar container da API antes do restore"
    echo "  -f      Forçar restauração (sem confirmação)"
    echo "  -v      Verificar hash SHA256 antes de restaurar"
    echo "  -q      Modo silencioso"
    echo "  -h      Mostrar esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  $0 ./backups/api-data-backup-20260103.tar.gz"
    echo "  $0 ./backups/api-data-backup-20260103.tar.gz -s -v"
    echo ""
    echo "Backups disponíveis:"
    ls -lh ./backups/api-data-backup-*.tar.gz 2>/dev/null | awk '{print "  " $5 "  " $9}' || echo "  Nenhum backup encontrado"
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

cleanup() {
    # Reiniciar container se foi parado
    if [ "$STOP_CONTAINER" = true ] && [ "$CONTAINER_STOPPED" = true ]; then
        log ""
        log "🔄 Reiniciando container da API..."
        docker-compose -f docker-compose.dev.yml start api 2>/dev/null || true
    fi
}

# ============================================
# Parse de argumentos
# ============================================

# Primeiro argumento é o arquivo de backup
if [ -n "$1" ] && [[ ! "$1" =~ ^- ]]; then
    BACKUP_FILE="$1"
    shift
fi

# Parse das opções
while getopts "sfvqh" opt; do
    case $opt in
        s) STOP_CONTAINER=true ;;
        f) FORCE=true ;;
        v) VERIFY_HASH=true ;;
        q) QUIET=true ;;
        h) show_help; exit 0 ;;
        *) show_help; exit 1 ;;
    esac
done

# ============================================
# Validações prévias
# ============================================

# Verificar se foi fornecido um arquivo de backup
if [ -z "$BACKUP_FILE" ]; then
    echo "❌ Erro: Nenhum arquivo de backup especificado"
    echo ""
    show_help
    exit 1
fi

# Verificar se o arquivo existe
if [ ! -f "${BACKUP_FILE}" ]; then
    echo "❌ Erro: Arquivo de backup não encontrado: ${BACKUP_FILE}"
    echo ""
    echo "Backups disponíveis:"
    ls -lh ./backups/api-data-backup-*.tar.gz 2>/dev/null | awk '{print "  " $5 "  " $9}' || echo "  Nenhum backup encontrado"
    exit 1
fi

# Configurar arquivo de log
BACKUP_DIR=$(dirname "${BACKUP_FILE}")
LOG_FILE="${BACKUP_DIR}/restore-${TIMESTAMP}.log"

log "🔍 Verificando pré-requisitos..."

# Verificar se Docker está rodando
if ! docker info >/dev/null 2>&1; then
    log "❌ Erro: Docker não está rodando ou sem permissão"
    exit 1
fi

# Verificar se o volume existe
if ! docker volume inspect "${VOLUME_NAME}" >/dev/null 2>&1; then
    log "❌ Erro: Volume ${VOLUME_NAME} não existe"
    log "   Criando volume..."
    docker volume create "${VOLUME_NAME}"
fi

log "✅ Pré-requisitos OK"
log "📝 Log: ${LOG_FILE}"
log ""

# ============================================
# Verificar integridade do backup
# ============================================

log "🔍 Verificando integridade do backup..."

if ! tar tzf "${BACKUP_FILE}" >/dev/null 2>&1; then
    log "❌ Erro: Arquivo de backup corrompido!"
    exit 1
fi

BACKUP_ITEMS=$(tar tzf "${BACKUP_FILE}" 2>/dev/null | wc -l)
log "   ✅ Arquivo íntegro (${BACKUP_ITEMS} itens)"

# Verificar hash SHA256 se solicitado
if [ "$VERIFY_HASH" = true ]; then
    HASH_FILE="${BACKUP_FILE}.sha256"

    if [ ! -f "$HASH_FILE" ]; then
        log "   ⚠️  Arquivo de hash não encontrado: ${HASH_FILE}"
        log "   Continuando sem verificação de hash..."
    else
        log "🔐 Verificando hash SHA256..."

        EXPECTED_HASH=$(cat "$HASH_FILE" | cut -d' ' -f1)
        ACTUAL_HASH=$(sha256sum "${BACKUP_FILE}" | cut -d' ' -f1)

        if [ "$EXPECTED_HASH" != "$ACTUAL_HASH" ]; then
            log "❌ Erro: Hash SHA256 não confere!"
            log "   Esperado: ${EXPECTED_HASH:0:16}..."
            log "   Atual:    ${ACTUAL_HASH:0:16}..."
            exit 1
        fi

        log "   ✅ Hash válido: ${ACTUAL_HASH:0:16}..."
    fi
fi

log ""

# ============================================
# Análise do backup e volume atual
# ============================================

BACKUP_SIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')

log "📊 Informações do backup:"
log "   📦 Arquivo: $(basename "${BACKUP_FILE}")"
log "   💾 Tamanho: ${BACKUP_SIZE}"
log "   📁 Itens: ${BACKUP_ITEMS}"
log ""

log "📊 Volume atual:"
CURRENT_INFO=$(docker run --rm -v ${VOLUME_NAME}:/data alpine sh -c "
  TOTAL_FILES=\$(find /data -type f 2>/dev/null | wc -l)
  TOTAL_SIZE=\$(du -sh /data 2>/dev/null | cut -f1)
  echo \"\$TOTAL_FILES|\$TOTAL_SIZE\"
")
CURRENT_FILES=$(echo "$CURRENT_INFO" | cut -d'|' -f1)
CURRENT_SIZE=$(echo "$CURRENT_INFO" | cut -d'|' -f2)

log "   📁 Arquivos atuais: ${CURRENT_FILES}"
log "   💾 Tamanho atual: ${CURRENT_SIZE}"
log ""

# ============================================
# Confirmação do usuário
# ============================================

if [ "$FORCE" = false ]; then
    echo "⚠️  ATENÇÃO: Esta operação irá sobrescrever o conteúdo atual do volume ${VOLUME_NAME}"
    echo ""
    echo "   Volume atual:  ${CURRENT_FILES} arquivos (${CURRENT_SIZE})"
    echo "   Backup:        ${BACKUP_ITEMS} itens (${BACKUP_SIZE})"
    echo ""
    read -p "Deseja continuar? (s/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        log "Operação cancelada pelo usuário."
        exit 0
    fi
    echo ""
fi

log "🔄 Iniciando restauração..."
log ""

# ============================================
# Parar container (se solicitado)
# ============================================

CONTAINER_STOPPED=false
trap cleanup EXIT

if [ "$STOP_CONTAINER" = true ]; then
    log "⏸️  Parando container da API..."
    if docker-compose -f docker-compose.dev.yml stop api 2>/dev/null; then
        CONTAINER_STOPPED=true
        log "   Container parado com sucesso"
    else
        log "   ⚠️  Aviso: Não foi possível parar o container"
    fi
    log ""
fi

# ============================================
# Restaurar backup com barra de progresso
# ============================================

log "💾 Restaurando backup..."

# Obter caminho absoluto do arquivo de backup
BACKUP_FULLPATH=$(cd "$(dirname "${BACKUP_FILE}")" && pwd)/$(basename "${BACKUP_FILE}")

docker run --rm \
  -v ${VOLUME_NAME}:/data \
  -v "${BACKUP_FULLPATH}:/backup.tar.gz:ro" \
  -e BACKUP_ITEMS="${BACKUP_ITEMS}" \
  -e QUIET="${QUIET}" \
  alpine \
  sh -c '
    echo "🗑️  Limpando volume..."
    rm -rf /data/* /data/..?* /data/.[!.]* 2>/dev/null || true
    echo "   ✅ Volume limpo"
    echo ""

    echo "📦 Extraindo arquivos (isso pode levar vários minutos)..."
    echo "   Total esperado: $BACKUP_ITEMS itens"
    echo ""

    # Monitorar progresso em background (apenas visual, não interfere no tar)
    if [ "$QUIET" != "true" ]; then
        (
            prev_count=0

            # Loop infinito - será morto quando tar terminar
            while true; do
                current=$(find /data -type f 2>/dev/null | wc -l)

                if [ "$BACKUP_ITEMS" -gt 0 ]; then
                    # Calcular progresso baseado em arquivos (itens incluem diretórios)
                    # Estimativa: 60-70% dos itens são arquivos
                    estimated_files=$((BACKUP_ITEMS * 65 / 100))
                    if [ $estimated_files -eq 0 ]; then estimated_files=1; fi

                    percent=$((current * 100 / estimated_files))
                    if [ $percent -gt 100 ]; then percent=99; fi

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

                    printf "\r   [%s] %3d%% (%d arquivos)" "$bar" "$percent" "$current"
                fi

                prev_count=$current
                sleep 1
            done
        ) &
        PROGRESS_PID=$!
    fi

    # Extrair arquivo tar - NÃO suprimir erros!
    tar xzf /backup.tar.gz -C /data
    EXIT_CODE=$?

    # Parar monitor de progresso imediatamente
    if [ "$QUIET" != "true" ] && [ -n "$PROGRESS_PID" ]; then
        kill $PROGRESS_PID 2>/dev/null || true
        wait $PROGRESS_PID 2>/dev/null || true
    fi

    # Contar resultado final
    FINAL_COUNT=$(find /data -type f 2>/dev/null | wc -l)
    FINAL_DIRS=$(find /data -type d 2>/dev/null | wc -l)
    FINAL_TOTAL=$((FINAL_COUNT + FINAL_DIRS))
    FINAL_SIZE=$(du -sh /data 2>/dev/null | cut -f1)

    printf "\r   [██████████████████████████████] 100%%                    \n"
    echo ""
    echo "📊 Volume restaurado:"
    echo "   📁 Arquivos: $FINAL_COUNT"
    echo "   📂 Diretórios: $FINAL_DIRS"
    echo "   📦 Total de itens: $FINAL_TOTAL (esperado: $BACKUP_ITEMS)"
    echo "   💾 Tamanho: $FINAL_SIZE"

    # Verificar se a extração foi completa
    if [ $EXIT_CODE -ne 0 ]; then
        echo ""
        echo "❌ ERRO: tar retornou código $EXIT_CODE"
        exit $EXIT_CODE
    fi

    # Verificar se o número de itens está próximo do esperado (tolerância de 5%)
    TOLERANCE=$((BACKUP_ITEMS * 5 / 100))
    DIFF=$((BACKUP_ITEMS - FINAL_TOTAL))
    if [ $DIFF -lt 0 ]; then DIFF=$((-DIFF)); fi

    if [ $DIFF -gt $TOLERANCE ]; then
        echo ""
        echo "⚠️  AVISO: Diferença significativa no número de itens!"
        echo "   Esperado: $BACKUP_ITEMS"
        echo "   Extraído: $FINAL_TOTAL"
        echo "   Diferença: $DIFF itens"
        echo ""
        echo "   Isso pode indicar problemas durante a extração."
        echo "   Verifique o espaço em disco e permissões."
    else
        echo ""
        echo "   ✅ Verificação de integridade OK"
    fi

    exit 0
  '

RESTORE_EXIT_CODE=$?

# ============================================
# Verificação pós-restore no host
# ============================================

if [ $RESTORE_EXIT_CODE -ne 0 ]; then
    log ""
    log "❌ ERRO: Restauração falhou com código $RESTORE_EXIT_CODE"
    exit $RESTORE_EXIT_CODE
fi

log ""
log "🔍 Verificação final no host..."

FINAL_CHECK=$(docker run --rm -v ${VOLUME_NAME}:/data alpine sh -c "
  FILES=\$(find /data -type f 2>/dev/null | wc -l)
  DIRS=\$(find /data -type d 2>/dev/null | wc -l)
  TOTAL=\$((FILES + DIRS))
  SIZE=\$(du -sh /data 2>/dev/null | cut -f1)
  echo \"\$FILES|\$DIRS|\$TOTAL|\$SIZE\"
")

FINAL_FILES=$(echo "$FINAL_CHECK" | cut -d'|' -f1)
FINAL_DIRS=$(echo "$FINAL_CHECK" | cut -d'|' -f2)
FINAL_TOTAL=$(echo "$FINAL_CHECK" | cut -d'|' -f3)
FINAL_SIZE=$(echo "$FINAL_CHECK" | cut -d'|' -f4)

log "   📁 Arquivos: ${FINAL_FILES}"
log "   📂 Diretórios: ${FINAL_DIRS}"
log "   📦 Total: ${FINAL_TOTAL} (backup: ${BACKUP_ITEMS})"
log "   💾 Tamanho: ${FINAL_SIZE}"

# Calcular diferença
DIFF=$((BACKUP_ITEMS - FINAL_TOTAL))
if [ $DIFF -lt 0 ]; then DIFF=$((-DIFF)); fi
TOLERANCE=$((BACKUP_ITEMS * 2 / 100))  # 2% tolerância

if [ $DIFF -gt $TOLERANCE ]; then
    log ""
    log "⚠️  AVISO: Diferença significativa detectada!"
    log "   Diferença: ${DIFF} itens ($((DIFF * 100 / BACKUP_ITEMS))%)"
    log ""
    log "   Possíveis causas:"
    log "   - Espaço em disco insuficiente"
    log "   - Container API escrevendo durante restore"
    log "   - Permissões de arquivo"
    log ""
    log "   Recomendação: Execute novamente com -s (parar API)"
    INTEGRITY_OK=false
else
    log "   ✅ Integridade OK (diferença: ${DIFF} itens)"
    INTEGRITY_OK=true
fi

log ""

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
log "📦 Backup: $(basename "${BACKUP_FILE}")"
log "📁 Arquivos restaurados: ${FINAL_FILES}"
log "📝 Log: ${LOG_FILE}"

if [ "$CONTAINER_STOPPED" = true ]; then
    log ""
    log "🔄 Container será reiniciado automaticamente..."
else
    log ""
    log "💡 Reinicie o container para aplicar as mudanças:"
    log "   docker-compose -f docker-compose.dev.yml restart api"
fi

log "════════════════════════════════════════════"

# Retornar código de erro se houve problema de integridade
if [ "$INTEGRITY_OK" = false ]; then
    exit 2
fi
