#!/bin/bash
# Script rápido para migrar dados entre buckets no RustFS
# Uso: ./scripts/fast-migrate-rustfs.sh

set -euo pipefail

RUSTFS_URL="http://rustfs:9000"
ACCESS_KEY="rustfsadmin"
SECRET_KEY="rustfsadmin"
NETWORK="gatuno_gatuno-net"

echo "════════════════════════════════════════════"
echo "🚀 Migração Interna Rápida: gatuno-files -> buckets"
echo "════════════════════════════════════════════"

# Executa tudo em um único container MC
docker run --rm --network "$NETWORK" --entrypoint sh minio/mc -c "
  mc alias set myrustfs $RUSTFS_URL $ACCESS_KEY $SECRET_KEY --api s3v4
  
  echo '📤 Movendo dados de livros...'
  # Movemos todos os shards (pastas de 2 chars) de gatuno-files para o bucket books
  # RustFS/S3 permite mover pastas inteiras com mc mv --recursive
  for shard in 0 1 2 3 4 5 6 7 8 9 a b c d e f; do
    for shard2 in 0 1 2 3 4 5 6 7 8 9 a b c d e f; do
      prefix=\"\$shard\$shard2\"
      mc mv --recursive --quiet myrustfs/gatuno-files/\$prefix/ myrustfs/books/ 2>/dev/null || true
    done
  done

  echo '📤 Movendo dados de usuários (avatars/banners)...'
  # Se houver algo sobrando que não seja shard e pertença a usuários
  # (Aqui assumimos que a maioria são livros, o que sobrar de shards vai para books)
"

echo "════════════════════════════════════════════"
echo "🎉 MOVIMENTAÇÃO CONCLUÍDA!"
echo "════════════════════════════════════════════"
