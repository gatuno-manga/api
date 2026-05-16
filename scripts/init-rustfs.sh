#!/bin/sh
# Inicializa o RustFS criando os buckets necessários e aplicando as políticas de acesso.

set -e

echo ">>> Aguardando o RustFS iniciar..."
sleep 5

echo ">>> Configurando alias para o RustFS..."
mc alias set myrustfs http://rustfs:9000 "${RUSTFS_ACCESS_KEY:-rustfsadmin}" "${RUSTFS_SECRET_KEY:-rustfsadmin}"

# Lista de buckets vinda do ambiente ou padrão seguro
BUCKETS="${RUSTFS_BUCKETS_LIST:-books users processing system}"

# Constrói as URLs baseadas nos novos componentes de ambiente
APP_URL="${APP_SCHEME:-http}://${APP_HOST:-localhost:4200}"
API_URL="${API_SCHEME:-http}://${API_HOST:-localhost:3000}"

# Processa referers extras globais (separados por vírgula) para o formato JSON
EXTRA_REFERERS_JSON=""
if [ -n "$RUSTFS_EXTRA_REFERERS" ]; then
  for url in $(echo "$RUSTFS_EXTRA_REFERERS" | tr ',' ' '); do
    EXTRA_REFERERS_JSON="$EXTRA_REFERERS_JSON, \"$url/*\""
  done
fi

for BUCKET in $BUCKETS; do
  echo ">>> Configurando bucket: $BUCKET"
  
  # Cria o bucket se não existir
  mc mb myrustfs/"$BUCKET" || true

  # Verifica se o bucket deve ser público
  # Se RUSTFS_PUBLIC_BUCKETS contiver o nome do bucket, aplicamos a política
  IS_PUBLIC=false
  for PUB_BUCKET in $RUSTFS_PUBLIC_BUCKETS; do
    if [ "$PUB_BUCKET" = "$BUCKET" ]; then
      IS_PUBLIC=true
      break
    fi
  done

  if [ "$IS_PUBLIC" = "true" ]; then
    echo "    -> Definindo como PÚBLICO com restrição de Referer"
    
    # Tenta encontrar referers específicos para este bucket (ex: RUSTFS_REFERERS_BOOKS)
    # Converte nome do bucket para maiúsculo e substitui hífens por underscores
    UPPER_BUCKET=$(echo "$BUCKET" | tr '[:lower:]' '[:upper:]' | tr '-' '_')
    VAR_NAME="RUSTFS_REFERERS_$UPPER_BUCKET"
    BUCKET_SPECIFIC_REFERERS=$(eval echo "\$$VAR_NAME")
    
    CURRENT_REFERERS_JSON=""
    
    if [ -n "$BUCKET_SPECIFIC_REFERERS" ]; then
      echo "    -> Usando referers específicos para $BUCKET"
      for url in $(echo "$BUCKET_SPECIFIC_REFERERS" | tr ',' ' '); do
        if [ -z "$CURRENT_REFERERS_JSON" ]; then
          CURRENT_REFERERS_JSON="\"$url/*\""
        else
          CURRENT_REFERERS_JSON="$CURRENT_REFERERS_JSON, \"$url/*\""
        fi
      done
    else
      echo "    -> Usando referers padrão"
      CURRENT_REFERERS_JSON="\"${APP_URL}/*\", \"${API_URL}/*\" ${EXTRA_REFERERS_JSON}"
    fi

    # Cria o arquivo de política temporário
    cat <<EOF > /tmp/policy.json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::$BUCKET/*"],
      "Condition": {
        "StringLike": {
          "aws:Referer": [
            ${CURRENT_REFERERS_JSON}
          ]
        }
      }
    }
  ]
}
EOF
    # Aplica a política ao bucket
    mc anonymous set-json /tmp/policy.json myrustfs/"$BUCKET"
  else
    echo "    -> Definindo como PRIVADO"
    # Remove qualquer política de acesso anônimo
    mc anonymous set none myrustfs/"$BUCKET" || true
  fi
done

echo ">>> Inicialização do RustFS concluída."
