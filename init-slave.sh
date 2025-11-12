#!/bin/sh
# Script de configuração de replicação MySQL Master-Slave
# Compatível com Alpine Linux (ash/sh) e sistemas POSIX
set -e

# Carregar variáveis de ambiente do arquivo .env (compatível com Alpine/ash)
if [ -f .env ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env | xargs -0)
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

# Suprimir warnings "Using a password on the command line interface can be insecure"
# usando MYSQL_PWD (variável de ambiente do MySQL para senhas)
# Nota: MYSQL_PWD é considerado menos seguro que .my.cnf, mas adequado para scripts
export MYSQL_PWD="${DB_PASS}"

until docker exec -e MYSQL_PWD="${DB_PASS}" gatuno-database mysql -u root -e "SELECT 1" 2>/dev/null; do
    sleep 5
done
echo "Mestre está pronto."

echo "Configurando a replicação nos slaves..."

echo "Obtendo status do mestre..."
MASTER_STATUS=$(docker exec -e MYSQL_PWD="${DB_PASS}" gatuno-database mysql -u root -e "SHOW MASTER STATUS\G")
LOG_FILE=$(echo "$MASTER_STATUS" | grep "File:" | awk '{print $2}')
LOG_POS=$(echo "$MASTER_STATUS" | grep "Position:" | awk '{print $2}')

echo "--> Mestre Status: File='${LOG_FILE}' Position='${LOG_POS}'"

# Usar variáveis de ambiente para credenciais de replicação
REPLICATION_USER="${DB_USER}"
REPLICATION_PASSWORD="${DB_PASS}"

# Nome do host do mestre (deve corresponder ao nome do serviço no docker-compose.yml)
MASTER_HOST="database-master"

echo "Criando usuário de replicação no mestre..."
# Remover -it para compatibilidade com scripts não-interativos e Alpine
docker exec -e MYSQL_PWD="${DB_PASS}" gatuno-database mysql -u root -e "CREATE USER IF NOT EXISTS '${REPLICATION_USER}'@'%' IDENTIFIED BY '${REPLICATION_PASSWORD}'; GRANT REPLICATION SLAVE ON *.* TO '${REPLICATION_USER}'@'%'; FLUSH PRIVILEGES;"

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
# Usar --source-data ao invés de --master-data (deprecated)
docker exec -e MYSQL_PWD="${DB_PASS}" gatuno-database mysqldump -u root --all-databases --source-data --set-gtid-purged=OFF > dump.sql

# Verificar se existem slaves em execução (compatível com Alpine)
SLAVE_COUNT=$(docker ps --format '{{.Names}}' | grep "gatuno-database-slave-" | wc -l)
SLAVE_COUNT=$(echo "$SLAVE_COUNT" | tr -d ' ')
if [ "$SLAVE_COUNT" = "0" ] || [ -z "$SLAVE_COUNT" ]; then
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
    docker exec -e MYSQL_PWD="${DB_PASS}" "${SLAVE_NAME}" mysql -u root -e "STOP REPLICA; RESET SLAVE ALL; RESET MASTER;"

    echo "Copiando dump para ${SLAVE_NAME}..."
    docker cp dump.sql "${SLAVE_NAME}":/tmp/dump.sql

    echo "Importando dump em ${SLAVE_NAME}..."
    docker exec -e MYSQL_PWD="${DB_PASS}" "${SLAVE_NAME}" sh -c "mysql -u root < /tmp/dump.sql"

    echo "Configurando replicação no ${SLAVE_NAME}..."
    docker exec -e MYSQL_PWD="${DB_PASS}" "${SLAVE_NAME}" mysql -u root -e "${SQL_CONFIGURE_SLAVE}"

    echo "Verificando status do ${SLAVE_NAME}:"
    docker exec -e MYSQL_PWD="${DB_PASS}" "${SLAVE_NAME}" mysql -u root -e "SHOW SLAVE STATUS\G"

    i=$((i+1))
done

echo "Configuração da replicação concluída com sucesso!"

rm -f dump.sql
