#!/bin/sh
set -eu

MASTER_HOST="${DB_MASTER_HOST:-database-master}"
REPL_USER="${DB_REPL_USER:-}"
REPL_PASS="${DB_REPL_PASS:-}"

status="$(mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SHOW REPLICA STATUS\\G" 2>/dev/null || true)"

# Sem canal de replica configurado
if [ -z "$status" ]; then
  exit 1
fi

last_sql_errno="$(echo "$status" | awk -F': ' '/Last_SQL_Errno:/ {print $2; exit}')"

# Auto-heal para divergencias comuns apos restart (linha nao encontrada ou duplicada)
if [ "$last_sql_errno" = "1032" ] || [ "$last_sql_errno" = "1062" ]; then
  if [ -z "$REPL_USER" ] || [ -z "$REPL_PASS" ]; then
    exit 1
  fi

  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<EOSQL
STOP REPLICA;
RESET REPLICA ALL;
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST='${MASTER_HOST}',
  SOURCE_USER='${REPL_USER}',
  SOURCE_PASSWORD='${REPL_PASS}',
  SOURCE_AUTO_POSITION=1,
  SOURCE_CONNECT_RETRY=10,
  SOURCE_RETRY_COUNT=8640,
  GET_SOURCE_PUBLIC_KEY=1;
START REPLICA;
SET GLOBAL read_only = ON;
SET GLOBAL super_read_only = ON;
EOSQL

  status="$(mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SHOW REPLICA STATUS\\G" 2>/dev/null || true)"
fi

echo "$status" | grep -q "Replica_IO_Running: Yes"
echo "$status" | grep -q "Replica_SQL_Running: Yes"
