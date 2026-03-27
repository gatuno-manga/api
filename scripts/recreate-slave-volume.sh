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
  DB_PASS                Senha root para validar SHOW REPLICA STATUS ao final.
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

volume_name() {
  case "$1" in
    database-slave-1) echo "database-slave-1-data" ;;
    database-slave-2) echo "database-slave-2-data" ;;
    *)
      echo ""
      ;;
  esac
}

container_name() {
  case "$1" in
    database-slave-1) echo "gatuno-database-slave-1" ;;
    database-slave-2) echo "gatuno-database-slave-2" ;;
    *)
      echo ""
      ;;
  esac
}

wait_replica_ok() {
  local container="$1"
  local attempts=45
  local sleep_seconds=2

  if [[ -z "${DB_PASS:-}" ]]; then
    echo "[info] DB_PASS nao definido; pulando validacao SQL detalhada para ${container}."
    return 0
  fi

  for ((i=1; i<=attempts; i++)); do
    status="$(docker exec "$container" mysql -uroot -p"$DB_PASS" -e "SHOW REPLICA STATUS\\G" 2>/dev/null || true)"

    if echo "$status" | grep -q "Replica_IO_Running: Yes" && \
       echo "$status" | grep -q "Replica_SQL_Running: Yes"; then
      echo "[ok] Replicacao ativa em ${container}."
      echo "$status" | grep -E "Replica_IO_Running:|Replica_SQL_Running:|Seconds_Behind_Source:|Last_SQL_Error:" || true
      return 0
    fi

    sleep "$sleep_seconds"
  done

  echo "[warn] Replicacao ainda nao ficou OK em ${container}."
  docker exec "$container" mysql -uroot -p"$DB_PASS" -e "SHOW REPLICA STATUS\\G" || true
  return 1
}

recreate_one() {
  local service="$1"
  local volume
  local container

  volume="$(volume_name "$service")"
  container="$(container_name "$service")"

  if [[ -z "$volume" || -z "$container" ]]; then
    echo "Erro: servico invalido: ${service}"
    exit 1
  fi

  echo "==> Recriando ${service}"

  compose stop "$service" || true
  docker rm -f "$container" >/dev/null 2>&1 || true

  # Volume com prefixo do projeto (name: gatuno) e fallback sem prefixo.
  docker volume rm "gatuno_${volume}" >/dev/null 2>&1 || docker volume rm "$volume" >/dev/null 2>&1 || true

  compose up -d "$service"
  wait_replica_ok "$container"
}

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
