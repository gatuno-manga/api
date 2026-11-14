#!/bin/bash
# Testa a migration database/migrations/add-language-to-chapters.sql contra um
# MySQL descartável (mesma imagem do docker-compose): o índice único antigo
# precisa ser trocado pelo novo na primeira execução, e uma segunda execução
# não pode mexer em nada.
#
# Uso: bash scripts/database/tests/add-language-to-chapters.test.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$(realpath "$0")")/../../.." && pwd)"
MIGRATION="${ROOT_DIR}/database/migrations/add-language-to-chapters.sql"
IMAGE="mysql:8.4"
CONTAINER="gatuno-migration-test-$$"
FAILURES=0

cleanup() { docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# run_sql <database> — via TCP: o servidor temporário que a imagem sobe durante
# a inicialização só escuta no socket, então só o definitivo responde aqui.
run_sql() { docker exec -i "${CONTAINER}" mysql -h127.0.0.1 -uroot -ptest -N -B "$1" 2>/dev/null; }

check() {
    local description="$1" expected="$2" actual="$3"
    if [ "${actual}" = "${expected}" ]; then
        echo "ok   - ${description}"
    else
        echo "FAIL - ${description}"
        echo "       esperado: ${expected}"
        echo "       recebido: ${actual}"
        FAILURES=$((FAILURES + 1))
    fi
}

# unique_indexes <database>
unique_indexes() {
    echo "SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX)
          FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chapters' AND NON_UNIQUE = 0
            AND INDEX_NAME != 'PRIMARY'
          GROUP BY INDEX_NAME ORDER BY INDEX_NAME;" | run_sql "$1" | tr '\t' ' '
}

docker run -d --name "${CONTAINER}" -e MYSQL_ROOT_PASSWORD=test "${IMAGE}" >/dev/null

echo "Aguardando o MySQL iniciar..."
ready=false
for _ in $(seq 1 90); do
    if echo "SELECT 1;" | run_sql mysql >/dev/null 2>&1; then
        ready=true
        break
    fi
    sleep 1
done
if [ "${ready}" = false ]; then
    echo "❌ O MySQL não ficou pronto em 90s."
    exit 1
fi

echo "CREATE DATABASE legacy; CREATE DATABASE composite_fk;" | run_sql mysql

# Cenário 1 — schema anterior à migration: índice único só em (index, bookId).
echo "CREATE TABLE chapters (
          id INT PRIMARY KEY AUTO_INCREMENT,
          \`index\` DECIMAL(10,2) NOT NULL,
          bookId VARCHAR(36) NOT NULL,
          UNIQUE KEY IDX_old_unique (\`index\`, bookId)
      );" | run_sql legacy

run_sql legacy < "${MIGRATION}" >/dev/null
check "primeira execução troca o índice antigo pelo novo" \
    "idx_chapter_book_index_lang bookId,index,languageCode" \
    "$(unique_indexes legacy)"

second_run="$(run_sql legacy < "${MIGRATION}")"
check "segunda execução não derruba nenhum índice" \
    "Index not found, skipping drop" \
    "$(echo "${second_run}" | grep -E 'skipping drop' || echo "(índice derrubado de novo)")"
check "segunda execução mantém o índice novo" \
    "idx_chapter_book_index_lang bookId,index,languageCode" \
    "$(unique_indexes legacy)"

# Cenário 2 — uma FK composta nas mesmas duas colunas não é o índice único
# antigo: tentar derrubá-la como índice faria a migration falhar.
echo "CREATE TABLE chapter_slots (
          \`index\` DECIMAL(10,2) NOT NULL,
          bookId VARCHAR(36) NOT NULL,
          PRIMARY KEY (\`index\`, bookId)
      );
      CREATE TABLE chapters (
          id INT PRIMARY KEY AUTO_INCREMENT,
          \`index\` DECIMAL(10,2) NOT NULL,
          bookId VARCHAR(36) NOT NULL,
          CONSTRAINT FK_chapter_slot FOREIGN KEY (\`index\`, bookId)
              REFERENCES chapter_slots (\`index\`, bookId)
      );" | run_sql composite_fk

if run_sql composite_fk < "${MIGRATION}" >/dev/null; then
    migration_status="aplicada"
else
    migration_status="falhou"
fi
check "FK composta em (index, bookId) não é confundida com o índice único antigo" \
    "aplicada" "${migration_status}"
check "com FK composta, o índice novo é criado" \
    "idx_chapter_book_index_lang bookId,index,languageCode" \
    "$(unique_indexes composite_fk)"

if [ "${FAILURES}" -gt 0 ]; then
    echo ""
    echo "${FAILURES} teste(s) falharam."
    exit 1
fi
echo ""
echo "Todos os testes passaram."
