#!/bin/bash
# Aplica migrations SQL no container MySQL master.
#
# Uso:
#   ./scripts/database/apply-migrations.sh                     (aplica todas as migrations)
#   ./scripts/database/apply-migrations.sh --backup            (faz backup antes de aplicar)
#   ./scripts/database/apply-migrations.sh <arquivo.sql>       (aplica uma migration específica)
#   ./scripts/database/apply-migrations.sh <arquivo.sql> -b    (com backup)

set -euo pipefail

SCRIPT_DIR="$(dirname "$(realpath "$0")")"
INFRA_DIR="$(cd "${SCRIPT_DIR}/../.." 2>/dev/null || cd "${SCRIPT_DIR}/.." && pwd)"
MIGRATIONS_DIR="${INFRA_DIR}/database/migrations"
CONTAINER="gatuno-database"
DB_NAME="gatuno"

DO_BACKUP=false
SPECIFIC_FILE=""

for arg in "$@"; do
    case "$arg" in
        --backup|-b)
            DO_BACKUP=true
            ;;
        --no-backup)
            DO_BACKUP=false
            ;;
        *)
            if [ -z "$SPECIFIC_FILE" ]; then
                SPECIFIC_FILE="$arg"
            fi
            ;;
    esac
done

# Snapshot de segurança pré-migration
if [ "$DO_BACKUP" = true ]; then
    echo "🛡️  Executando snapshot do banco de dados antes de aplicar migrations..."
    BACKUP_CLI="${INFRA_DIR}/scripts/backup.sh"
    if [ -f "$BACKUP_CLI" ]; then
        bash "$BACKUP_CLI" pre-migration -q
        echo "✅ Snapshot concluído com sucesso."
        echo ""
    fi
fi

if [ -n "$SPECIFIC_FILE" ]; then
    if [ -f "$MIGRATIONS_DIR/$SPECIFIC_FILE" ]; then
        files=("$MIGRATIONS_DIR/$SPECIFIC_FILE")
    elif [ -f "$SPECIFIC_FILE" ]; then
        files=("$SPECIFIC_FILE")
    else
        echo "❌ Arquivo não encontrado: $SPECIFIC_FILE"
        exit 1
    fi
else
    files=("$MIGRATIONS_DIR"/*.sql)
fi

echo ">>> Aplicando migrations no container '$CONTAINER'..."

for file in "${files[@]}"; do
    name="$(basename "$file")"

    if [ ! -f "$file" ]; then
        echo "❌ [ERRO] Arquivo não encontrado: $file"
        exit 1
    fi

    echo -n "  → $name ... "

    if docker exec -i "$CONTAINER" \
        sh -c "mysql -u root -p\"\$MYSQL_ROOT_PASSWORD\" $DB_NAME 2>/dev/null" < "$file"; then
        echo "OK"
    else
        echo "FALHOU"
        exit 1
    fi
done

echo ">>> Concluído com sucesso."
