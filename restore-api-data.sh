#!/bin/bash

# Script para restaurar o backup do volume api-data
# Uso: ./restore-api-data.sh <arquivo-de-backup>

set -e

# Configurações
VOLUME_NAME="gatuno_api-data"

# Verificar se foi fornecido um arquivo de backup
if [ -z "$1" ]; then
    echo "❌ Erro: Nenhum arquivo de backup especificado"
    echo "Uso: $0 <arquivo-de-backup>"
    echo ""
    echo "Backups disponíveis:"
    ls -lh ./backups/api-data-backup-*.tar.gz 2>/dev/null || echo "Nenhum backup encontrado"
    exit 1
fi

BACKUP_FILE="$1"

# Verificar se o arquivo existe
if [ ! -f "${BACKUP_FILE}" ]; then
    echo "❌ Erro: Arquivo de backup não encontrado: ${BACKUP_FILE}"
    exit 1
fi

echo "⚠️  ATENÇÃO: Esta operação irá sobrescrever o conteúdo atual do volume ${VOLUME_NAME}"
read -p "Deseja continuar? (s/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "Operação cancelada."
    exit 0
fi

echo "🔄 Iniciando restauração do volume ${VOLUME_NAME}..."
echo "📁 Arquivo de backup: ${BACKUP_FILE}"
echo ""

# Analisar backup antes da restauração
echo "📊 Analisando arquivo de backup..."
BACKUP_SIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')
BACKUP_INFO=$(tar tzf "${BACKUP_FILE}" 2>/dev/null | wc -l)

echo "📊 Informações do backup:"
echo "   📦 Tamanho do arquivo: ${BACKUP_SIZE}"
echo "   📁 Total de itens: ${BACKUP_INFO}"
echo ""

# Analisar volume atual
echo "📊 Volume atual:"
CURRENT_INFO=$(docker run --rm -v ${VOLUME_NAME}:/data alpine sh -c "
  TOTAL_FILES=\$(find /data -type f 2>/dev/null | wc -l)
  TOTAL_SIZE=\$(du -sh /data 2>/dev/null | cut -f1)
  echo \"\$TOTAL_FILES|\$TOTAL_SIZE\"
")
CURRENT_FILES=$(echo "$CURRENT_INFO" | cut -d'|' -f1)
CURRENT_SIZE=$(echo "$CURRENT_INFO" | cut -d'|' -f2)

echo "   📁 Arquivos atuais: ${CURRENT_FILES}"
echo "   💾 Tamanho atual: ${CURRENT_SIZE}"
echo ""

echo "💾 Restaurando backup (isso pode levar alguns minutos)..."
echo ""

# Restaurar backup usando um container temporário com progresso
docker run --rm \
  -v ${VOLUME_NAME}:/data \
  -v "$(pwd):/backup" \
  alpine \
  sh -c "
    echo '🗑️  Limpando volume...'
    rm -rf /data/* /data/..?* /data/.[!.]* 2>/dev/null || true

    echo '📦 Extraindo arquivos...'
    (
      while kill -0 \$\$ 2>/dev/null; do
        COUNT=\$(find /data -type f 2>/dev/null | wc -l)
        echo -ne \"\r📦 Arquivos extraídos: \$COUNT\"
        sleep 1
      done
    ) &
    PROGRESS_PID=\$!

    # Extrair arquivo tar
    tar xzf /backup/${BACKUP_FILE} -C /data 2>/dev/null
    EXIT_CODE=\$?

    # Parar indicador de progresso
    kill \$PROGRESS_PID 2>/dev/null || true
    wait \$PROGRESS_PID 2>/dev/null || true

    FINAL_COUNT=\$(find /data -type f 2>/dev/null | wc -l)
    echo -ne \"\r✓ Arquivos extraídos: \$FINAL_COUNT                    \n\"
    exit \$EXIT_CODE
  "

echo ""
echo "✅ Restauração concluída com sucesso!"
echo "🔄 Reinicie o container da API para aplicar as mudanças:"
echo "   docker-compose -f docker-compose.dev.yml restart api"
