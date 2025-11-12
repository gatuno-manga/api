#!/bin/bash
set -e

# Carregar variáveis de ambiente do arquivo .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo "Erro: Arquivo .env não encontrado!"
  exit 1
fi

# Validar variáveis obrigatórias
if [ -z "${DB_USER}" ] || [ -z "${DB_PASS}" ]; then
  echo "Erro: Variáveis DB_USER e DB_PASS devem estar definidas no arquivo .env"
  exit 1
fi

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

# Usar variáveis de ambiente para credenciais de replicação
REPLICATION_USER="${DB_USER}"
REPLICATION_PASSWORD="${DB_PASS}"

# Nome do host do mestre (deve corresponder ao nome do serviço no docker-compose.yml)
MASTER_HOST="database-master"

echo "Criando usuário de replicação no mestre..."
docker exec -it gatuno-database mysql -u root -p"${DB_PASS}" -e "CREATE USER IF NOT EXISTS '${REPLICATION_USER}'@'%' IDENTIFIED BY '${REPLICATION_PASSWORD}'; GRANT REPLICATION SLAVE ON *.* TO '${REPLICATION_USER}'@'%'; FLUSH PRIVILEGES;"

SQL_CONFIGURE_SLAVE="
STOP REPLICA;
CHANGE MASTER TO
  MASTER_HOST='${MASTER_HOST}',
  MASTER_USER='${REPLICATION_USER}',
  MASTER_PASSWORD='${REPLICATION_PASSWORD}',
  MASTER_LOG_FILE='${LOG_FILE}',
  MASTER_LOG_POS=${LOG_POS};
START REPLICA;"

DUMP_PATH="/tmp/dump.sql"

echo "Gerando dump do banco mestre (sem GTID)..."
docker exec gatuno-database mysqldump -u root -p"${DB_PASS}" --all-databases --master-data --set-gtid-purged=OFF > dump.sql

# Verificar se existem slaves em execução
SLAVE_COUNT=$(docker ps --format '{{.Names}}' | grep -c "gatuno-database-slave-" || echo "0")
if [ "$SLAVE_COUNT" -eq 0 ]; then
  echo "Aviso: Nenhum slave encontrado em execução!"
  rm -f dump.sql
  exit 0
fi

echo "Encontrados ${SLAVE_COUNT} slave(s) para configurar."

# Loop dinâmico para todos os slaves
i=1
while docker ps --format '{{.Names}}' | grep -q "gatuno-database-slave-${i}"; do
    SLAVE_NAME="gatuno-database-slave-${i}"

    echo "Resetando GTID e dados em ${SLAVE_NAME}..."
    docker exec "${SLAVE_NAME}" mysql -u root -p"${DB_PASS}" -e "STOP REPLICA; RESET SLAVE ALL; RESET MASTER;"

    echo "Copiando dump para ${SLAVE_NAME}..."
    docker cp dump.sql "${SLAVE_NAME}":/tmp/dump.sql

    echo "Importando dump em ${SLAVE_NAME}..."
    docker exec "${SLAVE_NAME}" sh -c "mysql -u root -p\"${DB_PASS}\" < /tmp/dump.sql"

    echo "Configurando replicação no ${SLAVE_NAME}..."
    docker exec "${SLAVE_NAME}" mysql -u root -p"${DB_PASS}" -e "${SQL_CONFIGURE_SLAVE}"

    echo "Verificando status do ${SLAVE_NAME}:"
    docker exec "${SLAVE_NAME}" mysql -u root -p"${DB_PASS}" -e "SHOW SLAVE STATUS\G"

    i=$((i+1))
done

echo "Configuração da replicação concluída com sucesso!"

rm -f dump.sql
