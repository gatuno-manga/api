#!/bin/bash
# Aplica todas as migrations SQL no container master.
# As migrations ficam em database/migrations/ e são montadas em /migrations no container.
#
# Uso:
#   ./scripts/apply-migrations.sh
#   ./scripts/apply-migrations.sh add-fulltext-search.sql   (uma migration específica)

set -euo pipefail

CONTAINER="gatuno-database"
MIGRATIONS_DIR="$(cd "$(dirname "$0")/../database/migrations" && pwd)"
DB_NAME="gatuno"

if [ $# -eq 1 ]; then
	files=("$MIGRATIONS_DIR/$1")
else
	files=("$MIGRATIONS_DIR"/*.sql)
fi

echo ">>> Aplicando migrations no container '$CONTAINER'..."

for file in "${files[@]}"; do
	name="$(basename "$file")"

	if [ ! -f "$file" ]; then
		echo "[ERRO] Arquivo não encontrado: $file"
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

echo ">>> Concluído."
