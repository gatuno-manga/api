#!/bin/bash
# Script para migrar dados do volume api-data para BUCKETS REAIS no RustFS
# Uso: ./scripts/migrate-rustfs-buckets.sh

set -euo pipefail

# Configurações do S3/RustFS (Padrões baseados no docker-compose.common.yml)
RUSTFS_URL="http://rustfs:9000"
ACCESS_KEY="rustfsadmin"
SECRET_KEY="rustfsadmin"
NETWORK="gatuno_gatuno-net"
VOLUME="gatuno_api-data"

echo "════════════════════════════════════════════"
echo "🚀 Iniciando Migração S3: Disco -> Buckets Reais"
echo "════════════════════════════════════════════"

# 1. Configurar Alias no MC
echo "🔧 Configurando cliente MC..."
docker run --rm --network "$NETWORK" minio/mc alias set myrustfs "$RUSTFS_URL" "$ACCESS_KEY" "$SECRET_KEY" --api s3v4

# 2. Criar Buckets se não existirem
echo "📦 Garantindo existência de buckets..."
for b in books users processing system; do
    docker run --rm --network "$NETWORK" minio/mc mb "myrustfs/$b" 2>/dev/null || true
done

# 3. Sincronizar dados (Volume -> S3)
echo "📤 Sincronizando dados dos livros..."
docker run --rm --network "$NETWORK" -v "$VOLUME":/old_data:ro minio/mc mirror --overwrite /old_data/books/ "myrustfs/books/"

echo "📤 Sincronizando dados dos usuários..."
docker run --rm --network "$NETWORK" -v "$VOLUME":/old_data:ro minio/mc mirror --overwrite /old_data/users/ "myrustfs/users/"

echo "════════════════════════════════════════════"
echo "🎉 MIGRAÇÃO S3 CONCLUÍDA!"
echo "════════════════════════════════════════════"
echo "⚠️  IMPORTANTE: Agora você deve rodar:"
echo "   docker compose -f docker-compose.common.yml -f docker-compose.dev.yml up -d rustfs-init"
echo "   Para aplicar as políticas de acesso aos novos buckets."
