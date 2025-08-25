set -e

mysql -v --username=root --password="${MYSQL_ROOT_PASSWORD}" <<-EOSQL
    CREATE USER '${MYSQL_USER}'@'%' IDENTIFIED WITH 'mysql_native_password' BY '${MYSQL_ROOT_PASSWORD}';
    GRANT REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO '${MYSQL_USER}'@'%';
    FLUSH PRIVILEGES;
EOSQL
