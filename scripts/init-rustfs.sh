#!/bin/sh
# Inicializa o RustFS criando os buckets necessários e aplicando as políticas de acesso.

set -e

echo ">>> Aguardando o RustFS iniciar..."
sleep 5

echo ">>> Configurando alias para o RustFS..."
mc alias set myrustfs http://rustfs:9000 "${RUSTFS_ACCESS_KEY:-rustfsadmin}" "${RUSTFS_SECRET_KEY:-rustfsadmin}"

# Lista de buckets vinda do ambiente ou padrão seguro
BUCKETS="${RUSTFS_BUCKETS_LIST:-books users processing system gatuno-files}"

for BUCKET in $BUCKETS; do
  echo ">>> Configurando bucket: $BUCKET"
  
  # Cria o bucket se não existir
  mc mb myrustfs/"$BUCKET" || true
  
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
            "${APP_URL}/*",
            "${API_URL}/*",
            "${ALLOWED_URL}/*"
          ]
        }
      }
    }
  ]
}
EOF

  # Aplica a política ao bucket
  mc anonymous set-json /tmp/policy.json myrustfs/"$BUCKET"
done

echo ">>> Inicialização do RustFS concluída."
