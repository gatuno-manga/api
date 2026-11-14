#!/bin/bash
# Testa o repasse de argumentos do scripts/backup.sh para os scripts de
# scripts/backup/. Roda contra uma cópia do CLI com stubs que só ecoam o que
# receberam, então não toca em Docker nem em backups reais.
#
# Uso: bash scripts/backup/tests/backup-cli.test.sh

set -euo pipefail

CLI_SOURCE="$(cd "$(dirname "$(realpath "$0")")/../.." && pwd)/backup.sh"
SANDBOX="$(mktemp -d)"
trap 'rm -rf "${SANDBOX}"' EXIT

mkdir -p "${SANDBOX}/scripts/backup" "${SANDBOX}/backups"
cp "${CLI_SOURCE}" "${SANDBOX}/scripts/backup.sh"
touch "${SANDBOX}/.env"

for stub in backup-all backup-database backup-api-data restore-database restore-api-data prune-legacy-backups; do
    printf '#!/bin/bash\necho "%s $*"\n' "${stub}" > "${SANDBOX}/scripts/backup/${stub}.sh"
    chmod +x "${SANDBOX}/scripts/backup/${stub}.sh"
done

DEFAULT_DIR="${SANDBOX}/backups"
ENV_FILE="${SANDBOX}/.env"
FAILURES=0

# expect_forwarded <descrição> <linha esperada do stub> <args do backup.sh...>
expect_forwarded() {
    local description="$1" expected="$2"
    shift 2
    local actual
    actual="$(bash "${SANDBOX}/scripts/backup.sh" "$@" 2>&1 | grep -E '^(backup|restore|prune)-' || true)"
    if [ "${actual}" = "${expected}" ]; then
        echo "ok   - ${description}"
    else
        echo "FAIL - ${description}"
        echo "       esperado: ${expected}"
        echo "       recebido: ${actual}"
        FAILURES=$((FAILURES + 1))
    fi
}

expect_forwarded "all sem argumentos usa o diretório padrão" \
    "backup-all ${DEFAULT_DIR} -e ${ENV_FILE}" \
    all

expect_forwarded "all repassa flags depois do diretório padrão" \
    "backup-all ${DEFAULT_DIR} -e ${ENV_FILE} -q" \
    all -q

expect_forwarded "all com diretório posicional substitui o padrão e mantém as flags" \
    "backup-all /custom -e ${ENV_FILE} -q" \
    all /custom -q

expect_forwarded "db com diretório posicional substitui o padrão e mantém as flags" \
    "backup-database /custom -e ${ENV_FILE} -r 3" \
    db /custom -r 3

expect_forwarded "data com diretório posicional substitui o padrão e mantém as flags" \
    "backup-api-data /custom -s" \
    data /custom -s

expect_forwarded "pre-migration com diretório posicional substitui o padrão" \
    "backup-database /custom -e ${ENV_FILE} -q" \
    pre-migration /custom -q

expect_forwarded "restore db com caminho posicional substitui o padrão e mantém as flags" \
    "restore-database /custom/db-backup-1 -e ${ENV_FILE} -f" \
    restore db /custom/db-backup-1 -f

expect_forwarded "restore data com caminho posicional substitui o padrão e mantém as flags" \
    "restore-api-data /custom/rustfs-backup-1 -f" \
    restore data /custom/rustfs-backup-1 -f

expect_forwarded "prune com diretório posicional substitui o padrão e mantém as flags" \
    "prune-legacy-backups /custom --apply" \
    prune /custom --apply

if [ "${FAILURES}" -gt 0 ]; then
    echo ""
    echo "${FAILURES} teste(s) falharam."
    exit 1
fi
echo ""
echo "Todos os testes passaram."
