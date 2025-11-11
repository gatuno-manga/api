#!/bin/bash

# Script para fazer backup do volume api-data
# Uso: ./backup-api-data.sh [diretório-de-destino]

set -e

# Configurações
VOLUME_NAME="gatuno_api-data"
BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="api-data-backup-${TIMESTAMP}.tar.gz"

# Criar diretório de backup se não existir
mkdir -p "${BACKUP_DIR}"

echo "🔄 Iniciando backup do volume ${VOLUME_NAME}..."
echo "📁 Arquivo de backup: ${BACKUP_DIR}/${BACKUP_FILE}"
echo ""

# Analisar volume antes do backup
echo "📊 Analisando volume..."
VOLUME_INFO=$(docker run --rm -v ${VOLUME_NAME}:/data alpine sh -c "
  TOTAL_FILES=\$(find /data -type f 2>/dev/null | wc -l)
  TOTAL_DIRS=\$(find /data -type d 2>/dev/null | wc -l)
  TOTAL_SIZE=\$(du -sh /data 2>/dev/null | cut -f1)
  echo \"\$TOTAL_FILES|\$TOTAL_DIRS|\$TOTAL_SIZE\"
")

TOTAL_FILES=$(echo "$VOLUME_INFO" | cut -d'|' -f1)
TOTAL_DIRS=$(echo "$VOLUME_INFO" | cut -d'|' -f2)
TOTAL_SIZE=$(echo "$VOLUME_INFO" | cut -d'|' -f3)

echo "📊 Informações do volume:"
echo "   📁 Arquivos: ${TOTAL_FILES}"
echo "   📂 Diretórios: ${TOTAL_DIRS}"
echo "   💾 Tamanho total: ${TOTAL_SIZE}"
echo ""

# Criar backup usando um container temporário com indicador de progresso
echo "💾 Criando backup (isso pode levar alguns minutos)..."
echo ""

# Usar tar compatível com BusyBox Alpine
docker run --rm \
  -v ${VOLUME_NAME}:/data \
  -v "$(pwd)/${BACKUP_DIR}:/backup" \
  alpine \
  sh -c "
    cd /data

    # Criar backup com indicador simples de progresso
    echo '📦 Compactando arquivos...'
    (
      while kill -0 \$\$ 2>/dev/null; do
        if [ -f /backup/${BACKUP_FILE} ]; then
          SIZE=\$(du -h /backup/${BACKUP_FILE} 2>/dev/null | cut -f1)
          echo -ne \"\r📦 Tamanho atual: \$SIZE\"
        fi
        sleep 1
      done
    ) &
    PROGRESS_PID=\$!

    # Criar arquivo tar (BusyBox tar não suporta --checkpoint)
    tar czf /backup/${BACKUP_FILE} . 2>/dev/null
    EXIT_CODE=\$?

    # Parar indicador de progresso
    kill \$PROGRESS_PID 2>/dev/null || true
    wait \$PROGRESS_PID 2>/dev/null || true

    echo -ne '\r✓ Arquivos compactados                    \n'
    exit \$EXIT_CODE
  "

echo ""
echo "✅ Backup concluído com sucesso!"
echo "📦 Arquivo salvo em: ${BACKUP_DIR}/${BACKUP_FILE}"
echo "📊 Tamanho do arquivo:"
ls -lh "${BACKUP_DIR}/${BACKUP_FILE}" | awk '{print $5, $9}'
