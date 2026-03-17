#!/bin/bash
set -e

echo ">>> Aguardando o Master ($DB_MASTER_HOST) ficar pronto..."

until mysql -h "$DB_MASTER_HOST" -u "$DB_REPL_USER" -p"$DB_REPL_PASS" -e "SELECT 1"; do
  >&2 echo "Master indisponível - aguardando 5 segundos..."
  sleep 5
done

echo ">>> Master detectado! Configurando Replicação..."

mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<-EOSQL
  STOP REPLICA;
  RESET REPLICA ALL;

    CHANGE REPLICATION SOURCE TO
        SOURCE_HOST='$DB_MASTER_HOST',
        SOURCE_USER='$DB_REPL_USER',
        SOURCE_PASSWORD='$DB_REPL_PASS',
        SOURCE_AUTO_POSITION=1,
    SOURCE_CONNECT_RETRY=10,
    SOURCE_RETRY_COUNT=8640,
        GET_SOURCE_PUBLIC_KEY=1;

    START REPLICA;
EOSQL

mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SHOW REPLICA STATUS\\G" || true

echo ">>> Replicação configurada e iniciada!"
