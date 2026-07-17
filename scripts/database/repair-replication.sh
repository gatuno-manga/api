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

COMPOSE_ARGS=()
if [[ -n "${GATUNO_COMPOSE_FILES:-}" ]]; then
  IFS=':' read -r -a compose_files <<<"$GATUNO_COMPOSE_FILES"
  for f in "${compose_files[@]}"; do
    COMPOSE_ARGS+=( -f "$ROOT_DIR/$f" )
  done
elif [[ -f "$ROOT_DIR/docker-compose.common.yml" && -f "$ROOT_DIR/docker-compose.dev.yml" ]]; then
  COMPOSE_ARGS=( -f "$ROOT_DIR/docker-compose.common.yml" -f "$ROOT_DIR/docker-compose.dev.yml" )
fi

compose() {
  docker compose "${COMPOSE_ARGS[@]}" "$@"
}

if ! command -v docker >/dev/null 2>&1; then
  echo "Erro: docker nao encontrado no PATH."
  exit 1
fi

master_container="$(compose ps -q database-master 2>/dev/null || true)"
if [[ -z "$master_container" ]]; then
  echo "Aviso: Nao foi possivel localizar o container database-master via compose."
  echo "Tentando usar fallback pelo nome gatuno-database-master..."
  master_container="gatuno-database-master"
fi

echo "==> Garantindo permissoes do usuario '${REPL_USER}' no master..."
docker exec -e MYSQL_PWD="${ROOT_PASS}" "$master_container" mysql -uroot -e "
CREATE USER IF NOT EXISTS '${REPL_USER}'@'%' IDENTIFIED BY '${REPL_PASS}';
ALTER USER '${REPL_USER}'@'%' IDENTIFIED BY '${REPL_PASS}';
GRANT REPLICATION SLAVE ON *.* TO '${REPL_USER}'@'%';
FLUSH PRIVILEGES;
"

wait_replica_ok() {
  local container="$1"
  local attempts=30
  local sleep_seconds=2
  local status=""

  for ((i=1; i<=attempts; i++)); do
    status="$(docker exec -e MYSQL_PWD="${ROOT_PASS}" "$container" mysql -uroot -e "SHOW REPLICA STATUS\\G" 2>/dev/null || true)"

    if echo "$status" | grep -q "Replica_IO_Running: Yes" && \
       echo "$status" | grep -q "Replica_SQL_Running: Yes"; then
      echo "[ok] Replicacao ativa em ${container}."
      echo "$status" | grep -E "Replica_IO_Running:|Replica_SQL_Running:|Seconds_Behind_Source:|Last_IO_Error:|Last_SQL_Error:" || true
      return 0
    fi
    sleep "$sleep_seconds"
  done
  echo "[warn] Replicacao ainda nao ficou OK em ${container}."
  docker exec -e MYSQL_PWD="${ROOT_PASS}" "$container" mysql -uroot -e "SHOW REPLICA STATUS\\G" || true
  return 1
}

repair_slave() {
  local service="$1"
  local container="$(compose ps -q "$service" 2>/dev/null || true)"
  
  if [[ -z "$container" ]]; then
    echo "Aviso: Container do servico ${service} nao encontrado via compose. Usando fallback gatuno-${service}..."
    container="gatuno-${service}"
  fi

  echo "==> Reparando replicacao em ${container}"

  docker exec -i -e MYSQL_PWD="${ROOT_PASS}" "$container" mysql -uroot <<SQL
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

  wait_replica_ok "$container"
}

repair_slave "database-slave-1"
repair_slave "database-slave-2"

echo "==> Reparo concluido"
