#!/bin/bash
set -e

echo ">>> Aguardando o Master ($DB_MASTER_HOST) ficar pronto..."

until mysql -h "$DB_MASTER_HOST" -u root -p"$MYSQL_ROOT_PASSWORD" -e "SELECT 1"; do
  >&2 echo "Master indisponível - aguardando 5 segundos..."
  sleep 5
done

echo ">>> Master detectado! Configurando Replicação..."

mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<-EOSQL
    CHANGE REPLICATION SOURCE TO
        SOURCE_HOST='$DB_MASTER_HOST',
        SOURCE_USER='$DB_REPL_USER',
        SOURCE_PASSWORD='$DB_REPL_PASS',
        SOURCE_AUTO_POSITION=1,
        GET_SOURCE_PUBLIC_KEY=1;

    START REPLICA;
EOSQL

echo ">>> Replicação configurada e iniciada!"
