set -e
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fiw
echo "Aguardando o mestre (gatuno-database) iniciar completamente..."

until docker exec gatuno-database mysql -u root -p"${DB_PASS}" -e "SELECT 1"; do
    sleep 5
done
echo "Mestre está pronto."

echo "Configurando a replicação nos slaves..."

echo "Obtendo status do mestre..."
MASTER_STATUS=$(docker exec gatuno-database mysql -u root -p"${DB_PASS}" -e "SHOW MASTER STATUS\G")
LOG_FILE=$(echo "$MASTER_STATUS" | grep "File:" | awk '{print $2}')
LOG_POS=$(echo "$MASTER_STATUS" | grep "Position:" | awk '{print $2}')

echo "--> Mestre Status: File='${LOG_FILE}' Position='${LOG_POS}'"

docker exec -it gatuno-database mysql -u root -p"${DB_PASS}" -e "CREATE USER IF NOT EXISTS 'poker'@'%' IDENTIFIED BY 'storm'; GRANT REPLICATION SLAVE ON *.* TO 'poker'@'%'; FLUSH PRIVILEGES;"

SQL_CONFIGURE_SLAVE="
STOP REPLICA;
CHANGE MASTER TO
  MASTER_HOST='database-master',
  MASTER_USER='${DB_USER}',
  MASTER_PASSWORD='${DB_PASS}',
  MASTER_LOG_FILE='${LOG_FILE}',
  MASTER_LOG_POS=${LOG_POS};
START REPLICA;"

DUMP_PATH="/tmp/dump.sql"

echo "Gerando dump do banco mestre (sem GTID)..."
docker exec gatuno-database mysqldump -u root -p"${DB_PASS}" --all-databases --master-data --set-gtid-purged=OFF > dump.sql

for SLAVE in gatuno-database-slave-1 gatuno-database-slave-2; do
  echo "Resetando GTID e dados em $SLAVE..."
  docker exec $SLAVE mysql -u root -p"${DB_PASS}" -e "STOP REPLICA; RESET SLAVE ALL; RESET MASTER;"
  echo "Copiando dump para $SLAVE..."
  docker cp dump.sql $SLAVE:/tmp/dump.sql
  echo "Importando dump em $SLAVE..."
  docker exec $SLAVE sh -c "mysql -u root -p\"${DB_PASS}\" < /tmp/dump.sql"
done

i=1
while docker ps --format '{{.Names}}' | grep -q "gatuno-database-slave-${i}"; do
    SLAVE_NAME="gatuno-database-slave-${i}"
    echo "Configurando ${SLAVE_NAME}..."
    docker exec "${SLAVE_NAME}" mysql -u root -p"${DB_PASS}" -e "${SQL_CONFIGURE_SLAVE}"

    echo "Verificando status do ${SLAVE_NAME}:"
    docker exec "${SLAVE_NAME}" mysql -u root -p"${DB_PASS}" -e "SHOW SLAVE STATUS\G"
    i=$((i+1))
done

echo "Configuração da replicação concluída com sucesso!"

rm -f dump.sql
