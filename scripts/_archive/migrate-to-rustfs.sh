#!/bin/bash
# Script para migrar dados do volume local (api-data) para o RustFS (S3-Compatible)
# Uso: ./scripts/migrate-to-rustfs.sh

set -euo pipefail

# ============================================
# Configurações e Carregamento de Env
# ============================================
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1091
    source "$ENV_FILE"
fi

OLD_VOLUME="gatuno_api-data"
RUSTFS_CONTAINER="gatuno-rustfs"
ACCESS_KEY=${RUSTFS_ACCESS_KEY:-rustfsadmin}
SECRET_KEY=${RUSTFS_SECRET_KEY:-rustfsadmin}
BUCKET=${RUSTFS_BUCKET:-gatuno-files}
# Usamos o nome do serviço no docker-compose para comunicação interna
ENDPOINT="http://${RUSTFS_CONTAINER}:9000"

echo "════════════════════════════════════════════"
echo "🚀 Iniciando Migração de Dados: Disco -> RustFS"
echo "════════════════════════════════════════════"

# 1. Verificar se o Docker está rodando
if ! docker info >/dev/null 2>&1; then
    echo "❌ Erro: Docker não está rodando."
    exit 1
fi

# 2. Verificar se o volume de origem existe
if ! docker volume inspect "${OLD_VOLUME}" >/dev/null 2>&1; then
    echo "❌ Erro: Volume de origem '${OLD_VOLUME}' não encontrado."
    exit 1
fi

# 3. Verificar se o RustFS está rodando
if ! docker ps --format '{{.Names}}' | grep -q "^${RUSTFS_CONTAINER}$"; then
    echo "⚠️  Aviso: Container '${RUSTFS_CONTAINER}' não encontrado."
    echo "   Tentando subir a infraestrutura necessária..."
    docker compose -f docker-compose.common.yml -f docker-compose.dev.yml up -d rustfs rustfs-init
    
    echo "⏳ Aguardando inicialização do RustFS..."
    sleep 5
fi

# 4. Detectar o nome da rede (docker-compose geralmente adiciona prefixo)
NETWORK_NAME=$(docker network ls --format '{{.Name}}' | grep -E '^gatuno_gatuno-net$|^gatuno-net$' | head -n 1)

if [[ -z "$NETWORK_NAME" ]]; then
    echo "❌ Erro: Rede do Gatuno não encontrada. Certifique-se de que os containers estão rodando."
    exit 1
fi

echo "📦 Sincronizando arquivos usando a rede '$NETWORK_NAME'..."

# Configurar o alias
docker run --rm \
    --network "$NETWORK_NAME" \
    -v "${OLD_VOLUME}:/old_data:ro" \
    minio/mc \
    alias set myrustfs "${ENDPOINT}" "${ACCESS_KEY}" "${SECRET_KEY}" --api s3v4

# Garantir que o bucket existe
docker run --rm \
    --network "$NETWORK_NAME" \
    minio/mc \
    mb myrustfs/"${BUCKET}" 2>/dev/null || true

# Sincronizar
docker run --rm \
    --network "$NETWORK_NAME" \
    -v "${OLD_VOLUME}:/old_data:ro" \
    minio/mc \
    mirror --overwrite /old_data myrustfs/"${BUCKET}"

echo "════════════════════════════════════════════"
echo "🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!"
echo "════════════════════════════════════════════"
