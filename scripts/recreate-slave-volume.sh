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

COMPOSE_ARGS=(
  -f "$ROOT_DIR/docker-compose.common.yml"
  -f "$ROOT_DIR/docker-compose.dev.yml"
)

if [[ -n "${GATUNO_COMPOSE_FILES:-}" ]]; then
  COMPOSE_ARGS=()
  IFS=':' read -r -a compose_files <<<"$GATUNO_COMPOSE_FILES"
  for f in "${compose_files[@]}"; do
    COMPOSE_ARGS+=( -f "$ROOT_DIR/$f" )
  done
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Erro: docker nao encontrado no PATH."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Erro: docker compose nao esta disponivel."
  exit 1
fi

MASTER_HOST="${DB_MASTER_HOST:-database-master}"
ROOT_PASS="${DB_PASS:-}"
REPL_USER="${DB_REPL_USER:-}"
REPL_PASS="${DB_REPL_PASS:-}"
DB_NAME_VALUE="${DB_NAME:-}"

usage() {
  cat <<'USAGE'
Uso:
  ./scripts/recreate-slave-volume.sh [slave-1|slave-2|both] [--yes]

Exemplos:
  ./scripts/recreate-slave-volume.sh slave-1 --yes
  ./scripts/recreate-slave-volume.sh both --yes

Opcoes:
  --yes    Nao pede confirmacao interativa.

Ambiente opcional:
  GATUNO_COMPOSE_FILES   Lista de arquivos compose separados por ':'
                         Exemplo: docker-compose.common.yml:docker-compose.prod.yml
  DB_PASS                Senha root do MySQL (obrigatoria para reseed).
USAGE
}

target="${1:-}"
confirm="${2:-}"

if [[ -z "$target" || "$target" == "-h" || "$target" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "$confirm" != "--yes" ]]; then
  echo "Aviso: esta operacao apaga os dados do(s) volume(s) do(s) slave(s)."
  read -r -p "Continuar? (yes/no): " answer
  if [[ "$answer" != "yes" ]]; then
    echo "Abortado."
    exit 1
  fi
fi

compose() {
  docker compose "${COMPOSE_ARGS[@]}" "$@"
}

require_vars() {
  if [[ -z "$ROOT_PASS" || -z "$REPL_USER" || -z "$REPL_PASS" || -z "$DB_NAME_VALUE" ]]; then
    echo "Erro: defina DB_PASS, DB_REPL_USER, DB_REPL_PASS e DB_NAME no .env."
    exit 1
  fi
}

service_container_id() {
  local service="$1"
  compose ps -q "$service"
}

volume_name() {
  case "$1" in
    database-slave-1) echo "database-slave-1-data" ;;
    database-slave-2) echo "database-slave-2-data" ;;
    *)
      echo ""
      ;;
  esac
}

wait_mysql_ready() {
  local container="$1"
  local attempts=60
  local sleep_seconds=2

  for ((i=1; i<=attempts; i++)); do
    if docker exec "$container" mysqladmin -uroot -p"$ROOT_PASS" ping --silent >/dev/null 2>&1; then
      return 0
    fi
    sleep "$sleep_seconds"
  done

  echo "Erro: MySQL do container ${container} nao ficou pronto a tempo."
  return 1
}

wait_replica_ok() {
  local container="$1"
  local attempts=60
  local sleep_seconds=2
  local status=""

  for ((i=1; i<=attempts; i++)); do
    status="$(docker exec "$container" mysql -uroot -p"$ROOT_PASS" -e "SHOW REPLICA STATUS\\G" 2>/dev/null || true)"

    if echo "$status" | grep -q "Replica_IO_Running: Yes" && \
       echo "$status" | grep -q "Replica_SQL_Running: Yes"; then
      echo "[ok] Replicacao ativa em ${container}."
      echo "$status" | grep -E "Replica_IO_Running:|Replica_SQL_Running:|Seconds_Behind_Source:|Last_IO_Error:|Last_SQL_Error:" || true
      return 0
    fi

    sleep "$sleep_seconds"
  done

  echo "[warn] Replicacao ainda nao ficou OK em ${container}."
  docker exec "$container" mysql -uroot -p"$ROOT_PASS" -e "SHOW REPLICA STATUS\\G" || true
  return 1
}

reseed_slave() {
  local service="$1"
  local slave_container="$2"
  local master_container

  master_container="$(service_container_id "database-master")"
  if [[ -z "$master_container" ]]; then
    echo "Erro: nao foi possivel localizar o container do servico database-master."
    exit 1
  fi

  echo "==> Reseed do ${service} a partir do master"

  wait_mysql_ready "$master_container"
  wait_mysql_ready "$slave_container"

  docker exec -i "$slave_container" mysql -uroot -p"$ROOT_PASS" <<SQL
STOP REPLICA;
RESET REPLICA ALL;
RESET BINARY LOGS AND GTIDS;
SQL

  docker exec "$master_container" sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers --events --set-gtid-purged=ON --databases "$MYSQL_DATABASE"' \
    | docker exec -i "$slave_container" sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD"'

  docker exec -i "$slave_container" mysql -uroot -p"$ROOT_PASS" <<SQL
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
}

recreate_one() {
  local service="$1"
  local volume
  local container

  volume="$(volume_name "$service")"
  if [[ -z "$volume" ]]; then
    echo "Erro: servico invalido: ${service}"
    exit 1
  fi

  echo "==> Recriando ${service}"

  compose stop "$service" || true

  container="$(service_container_id "$service")"
  if [[ -n "$container" ]]; then
    docker rm -f "$container" >/dev/null 2>&1 || true
  fi

  # Volume com prefixo do projeto (name: gatuno) e fallback sem prefixo.
  docker volume rm "gatuno_${volume}" >/dev/null 2>&1 || docker volume rm "$volume" >/dev/null 2>&1 || true

  compose up -d "$service"

  container="$(service_container_id "$service")"
  if [[ -z "$container" ]]; then
    echo "Erro: nao foi possivel localizar o container do servico ${service}."
    exit 1
  fi

  reseed_slave "$service" "$container"
  wait_replica_ok "$container"
}

require_vars

case "$target" in
  slave-1)
    recreate_one "database-slave-1"
    ;;
  slave-2)
    recreate_one "database-slave-2"
    ;;
  both)
    recreate_one "database-slave-1"
    recreate_one "database-slave-2"
    ;;
  *)
    echo "Erro: alvo invalido '${target}'."
    usage
    exit 1
    ;;
esac

echo "==> Concluido."
