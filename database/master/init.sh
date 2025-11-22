#!/bin/bash
set -e

mysql -v --user=root --password="${MYSQL_ROOT_PASSWORD}" <<-EOSQL
    CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'%' IDENTIFIED BY '${MYSQL_PASSWORD}';
    GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER ON \`${MYSQL_DATABASE}\`.* TO '${MYSQL_USER}'@'%';
    FLUSH PRIVILEGES;
EOSQL

mysql -v --user=root --password="${MYSQL_ROOT_PASSWORD}" <<-EOSQL
    CREATE USER IF NOT EXISTS '${DB_REPL_USER}'@'%' IDENTIFIED BY '${DB_REPL_PASS}';
    GRANT REPLICATION SLAVE ON *.* TO '${DB_REPL_USER}'@'%';
    FLUSH PRIVILEGES;
EOSQL

echo ">>> Inicialização do Master concluída. Usuários criados."
