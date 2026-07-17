# Scripts de Banco de Dados

Scripts para manutenção, migração e reparo da camada de dados MySQL (master-slave).

## Arquivos

| Script | Descrição |
|---|---|
| `apply-migrations.sh` | Aplica arquivos `.sql` do diretório `database/migrations/` no container master. |
| `recreate-slave-volume.sh` | Recria o volume de um slave MySQL do zero, fazendo reseed completo a partir do master via `mysqldump`. |
| `repair-replication.sh` | Repara a replicação master→slave sem recriar volumes — usa `STOP/RESET REPLICA` + `CHANGE REPLICATION SOURCE`. |
| `set-ptbr-scraping-language.sql` | SQL avulso: atualiza `allowedScrapingLanguages = 'pt-br'` em todos os livros. |

## Uso rápido

```bash
# Aplicar todas as migrations
./scripts/database/apply-migrations.sh

# Aplicar uma migration específica
./scripts/database/apply-migrations.sh add-fulltext-search.sql

# Reparar replicação (quando slave dessincronizar)
./scripts/database/repair-replication.sh

# Recriar slave-1 do zero (reseed completo)
./scripts/database/recreate-slave-volume.sh slave-1 --yes
./scripts/database/recreate-slave-volume.sh both --yes
```
