#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

# Carrega variaveis do .env da raiz do projeto (um nivel acima de scripts)
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

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
SET GLOBAL read_only = ON;
SET GLOBAL super_read_only = ON;
SQL

  docker exec "$container" mysql -uroot -p"$ROOT_PASS" -e "SHOW REPLICA STATUS\\G" | grep -E "Replica_IO_Running:|Replica_SQL_Running:|Seconds_Behind_Source:|Last_IO_Error:|Last_SQL_Error:" || true
}

repair_slave gatuno-database-slave-1
repair_slave gatuno-database-slave-2

echo "==> Reparo concluido"
