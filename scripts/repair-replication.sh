#!/usr/bin/env bash
set -euo pipefail

MASTER_HOST="${DB_MASTER_HOST:-database-master}"
REPL_USER="${DB_REPL_USER:-}"
REPL_PASS="${DB_REPL_PASS:-}"
ROOT_PASS="${DB_PASS:-}"

if [[ -z "$REPL_USER" || -z "$REPL_PASS" || -z "$ROOT_PASS" ]]; then
  echo "Erro: defina DB_REPL_USER, DB_REPL_PASS e DB_PASS no ambiente (.env)."
  exit 1
fi

repair_slave() {
  local container="$1"
  echo "==> Reparando replicacao em ${container}"

  docker exec "$container" mysql -uroot -p"$ROOT_PASS" <<SQL
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
SQL

  docker exec "$container" mysql -uroot -p"$ROOT_PASS" -e "SHOW REPLICA STATUS\\G" | grep -E "Replica_IO_Running:|Replica_SQL_Running:|Seconds_Behind_Source:|Last_IO_Error:|Last_SQL_Error:" || true
}

repair_slave gatuno-database-slave-1
repair_slave gatuno-database-slave-2

echo "==> Reparo concluido"
