#!/bin/sh
set -eu

status="$(mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SHOW REPLICA STATUS\\G" 2>/dev/null || true)"

# Sem canal de replica configurado
if [ -z "$status" ]; then
  exit 1
fi

echo "$status" | grep -q "Replica_IO_Running: Yes"
echo "$status" | grep -q "Replica_SQL_Running: Yes"
