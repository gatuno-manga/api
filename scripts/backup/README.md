# Scripts de Backup e Restauração

Esté diretório contém todos os scripts relacionados a backup e restauração de dados.

## Arquivos

| Script | Descrição |
|---|---|
| `_tools-check.sh` | Biblioteca compartilhada: detecta package manager, instala ferramentas e usa Docker Alpine como fallback. **Não executar diretamente** — é `source`ado pelos outros scripts. |
| `backup-all.sh` | **Ponto de entrada principal.** Executa backup de binários + banco de dados em paralelo com relatório unificado. |
| `backup-api-data.sh` | Backup dos binários do RustFS via hardlinks (deduplicado). |
| `backup-database.sh` | Backup do MySQL (`mysqldump --single-transaction`) + Redis (`BGSAVE`), comprimidos com zstd. |
| `migrate-backups.sh` | Migra backups antigos no formato `.tar.zst` para o novo formato de diretórios deduplicados. |
| `restore-api-data.sh` | Restaura um backup de binários para o volume `gatuno_rustfs_data`. |

## Uso rápido

```bash
# Backup completo (binários + banco)
./scripts/backup/backup-all.sh

# Backup apenas do banco de dados
./scripts/backup/backup-database.sh

# Backup apenas dos binários RustFS
./scripts/backup/backup-api-data.sh

# Restaurar backup de binários
./scripts/backup/restore-api-data.sh ./backups/rustfs-backup-20260717_120000

# Migrar backups antigos (.tar.zst) para o novo formato
./scripts/backup/migrate-backups.sh ./backups -d  # dry-run
./scripts/backup/migrate-backups.sh ./backups      # executar
```

## Estrutura dos backups

```
backups/
  rustfs-backup-TIMESTAMP/        ← backup de binários
    data/                         ← espelho do volume (hardlinks)
    manifest.sha256
    info.txt
  db-backup-TIMESTAMP/            ← backup do banco
    mysql-<DB_NAME>-TIMESTAMP.sql.zst
    redis-TIMESTAMP.rdb.zst
    manifest.sha256
    info.txt
```
