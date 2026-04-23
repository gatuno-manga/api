#!/bin/bash
# Script para migrar dados do volume local (api-data) para a nova estrutura de Buckets
# Uso: ./scripts/migrate-buckets.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${ROOT_DIR}/data"

echo "════════════════════════════════════════════"
echo "📂 Migração Física: Organização por Buckets"
echo "════════════════════════════════════════════"

if [[ ! -d "$DATA_DIR" ]]; then
    echo "❌ Erro: Diretório de dados '$DATA_DIR' não encontrado."
    exit 1
fi

cd "$DATA_DIR"

echo "📦 Criando buckets (subdiretórios)..."
mkdir -p users books processing system

# Mover diretórios para os respectivos buckets
function migrate_dir() {
    local src=$1
    local dest=$2
    if [[ -d "$src" ]]; then
        # Proteção: Não mover se o diretório for um bucket ou um shard (2 chars hex)
        if [[ "$src" == "users" || "$src" == "books" || "$src" == "processing" || "$src" == "system" ]]; then
            return
        fi
        
        # Ignorar shards (pastas de 2 caracteres como 0a, f1, etc.)
        if [[ "$src" =~ ^[0-9a-f]{2}$ ]]; then
            echo "   -> Pulando shard '$src' (já migrado ou S3)"
            return
        fi

        echo "   -> Movendo '$src' para '$dest'..."
        # Se o destino já existir, movemos o conteúdo
        if [[ -d "$dest/$src" ]]; then
            mv "$src"/* "$dest/$src/" 2>/dev/null || true
            rmdir "$src" 2>/dev/null || true
        else
            mv "$src" "$dest/"
        fi
    fi
}

# Lista de diretórios conhecidos para migrar
migrate_dir "avatars" "users"
migrate_dir "banners" "users"
migrate_dir "covers" "books"
migrate_dir "pages" "books"
migrate_dir "temp" "processing"
migrate_dir "logos" "system"

echo "════════════════════════════════════════════"
echo "🎉 MIGRAÇÃO FÍSICA CONCLUÍDA!"
echo "════════════════════════════════════════════"
echo "ℹ️  Nota: Pastas de 2 caracteres (shards) foram preservadas para compatibilidade S3."
echo "⚠️  Não esqueça de rodar a migration SQL para atualizar os caminhos no DB!"
