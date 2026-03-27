#!/bin/bash

# Script de Migração para Directory Sharding
# Este script organiza arquivos na raiz do volume api-data em subpastas de 2 caracteres
# e gera o SQL necessário para atualizar as referências no banco de dados.

VOLUME_NAME="gatuno_api-data"
CONTAINER_DATA_PATH="/data"
TEMP_SQL_FILE="update_sharding_paths.sql"

echo "===================================================="
echo "Iniciando Migração para Directory Sharding (2 chars)"
echo "===================================================="

# 1. Garantir que temos acesso ao volume via um container temporário
echo "[1/3] Mapeando arquivos e criando estrutura de pastas..."

# Comando para rodar dentro do container:
# - Lista arquivos na raiz (ignora pastas)
# - Cria a pasta de 2 chars
# - Move o arquivo
# - Imprime o comando SQL de update (Plural: pages e covers)
docker run --rm -v ${VOLUME_NAME}:${CONTAINER_DATA_PATH} bash:5.2 bash -c "
    cd ${CONTAINER_DATA_PATH}
    echo 'SET FOREIGN_KEY_CHECKS = 0;' > /tmp/migration.sql
    
    count=0
    for f in *; do
        # Pula se não for arquivo ou se for diretório (como cache)
        [ -f \"\$f\" ] || continue
        
        # Pega os 2 primeiros caracteres do UUID
        shard=\${f:0:2}
        
        # Cria diretório e move
        mkdir -p \"\$shard\"
        mv \"\$f\" \"\$shard/\"
        
        # Gera SQL para as duas tabelas principais (Plural!)
        echo \"UPDATE pages SET path = '/data/\$shard/\$f' WHERE path = '/data/\$f';\" >> /tmp/migration.sql
        echo \"UPDATE covers SET url = '/data/\$shard/\$f' WHERE url = '/data/\$f';\" >> /tmp/migration.sql
        
        count=\$((count + 1))
        if [ \$((count % 500)) -eq 0 ]; then
            echo \"Processados \$count arquivos...\"
        fi
    done
    
    echo 'SET FOREIGN_KEY_CHECKS = 1;' >> /tmp/migration.sql
    cat /tmp/migration.sql
" > ${TEMP_SQL_FILE}

echo "[2/3] Movimentação física concluída."
echo "SQL gerado em: ${TEMP_SQL_FILE}"

# 2. Aplicar as mudanças no banco de dados
echo "[3/3] Aplicando atualizações no banco de dados MySQL..."

# Detecta o container EXATO pelo nome para evitar múltiplos IDs (slaves)
DB_CONTAINER=$(docker ps -q --filter "name=^gatuno-database$")
if [ -z "$DB_CONTAINER" ]; then
    DB_CONTAINER=$(docker ps --format "{{.Names}}" | grep -w "gatuno-database" | head -n 1)
fi

if [ -z "$DB_CONTAINER" ]; then
    echo "ERRO: Container gatuno-database não encontrado ou parado."
    echo "Por favor, execute o SQL manualmente: docker exec -i <db_container> mysql -u <user> -p < ${TEMP_SQL_FILE}"
    exit 1
fi

echo "Usando container: $DB_CONTAINER"

# Tenta carregar credenciais do .env na raiz
if [ -f .env ]; then
    DB_USER=$(grep "^DB_USER=" .env | cut -d '=' -f2)
    DB_PASS=$(grep "^DB_PASS=" .env | cut -d '=' -f2)
    DB_NAME=$(grep "^DB_NAME=" .env | cut -d '=' -f2)
fi

# Fallback para root se .env falhar
DB_USER=${DB_USER:-"root"}
DB_PASS=${DB_PASS:-"root"}
DB_NAME=${DB_NAME:-"gatuno"}

docker exec -i $DB_CONTAINER mysql -u${DB_USER} -p${DB_PASS} ${DB_NAME} < ${TEMP_SQL_FILE}

if [ $? -eq 0 ]; then
    echo "===================================================="
    echo "MIGRAÇÃO CONCLUÍDA COM SUCESSO!"
    echo "Estrutura de pastas organizada e Banco de Dados atualizado."
    echo "===================================================="
    rm ${TEMP_SQL_FILE}
else
    echo "ERRO ao aplicar SQL no banco de dados. Verifique ${TEMP_SQL_FILE}"
fi
