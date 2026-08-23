# Scripts de Backup e Restauração

Esté diretório contém todos os scripts relacionados a backup e restauração de dados.

## Arquivos

| Script | Descrição |
|---|---|
| `_tools-check.sh` | Biblioteca compartilhada: detecta package manager, instala ferramentas, resolve os arquivos `docker-compose*.yml` e usa Docker Alpine como fallback. **Não executar diretamente** — é `source`ado pelos outros scripts. |
| `backup-all.sh` | **Ponto de entrada principal.** Executa backup de binários + banco de dados em paralelo com relatório unificado. |
| `backup-api-data.sh` | Backup dos binários do RustFS via hardlinks (deduplicado). Manifesto de checksums incremental. |
| `backup-database.sh` | Backup do MySQL (`mysqldump --single-transaction`) + Redis (`BGSAVE`), comprimidos com zstd. |
| `restore-api-data.sh` | Restaura um backup de binários para o volume `gatuno_rustfs_data`. |
| `restore-database.sh` | Restaura um backup de banco (`db-backup-*`): MySQL via pipe direto e Redis via substituição do RDB. |
| `migrate-backups.sh` | Migra backups antigos no formato `.tar.zst` para o novo formato de diretórios deduplicados. |
| `prune-legacy-backups.sh` | Remove os `.tar.zst` legados com segurança, só depois de validar um backup no novo formato. Dry-run por padrão. |
| `gatuno-backup.service` / `.timer` | Unit systemd para agendar `backup-all.sh` (alternativa a cron — ver abaixo). |

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

# Restaurar backup de banco de dados
./scripts/backup/restore-database.sh ./backups/db-backup-20260717_120000

# Migrar backups antigos (.tar.zst) para o novo formato
./scripts/backup/migrate-backups.sh ./backups -d  # dry-run
./scripts/backup/migrate-backups.sh ./backups      # executar

# Limpar .tar.zst legados depois de validar o novo formato
./scripts/backup/prune-legacy-backups.sh ./backups          # dry-run
./scripts/backup/prune-legacy-backups.sh ./backups --apply  # executar
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

## Docker Compose

O projeto não tem `docker-compose.yml` na raiz (só `docker-compose.common.yml` +
overrides), então `docker compose stop/start` sem `-f` não funciona fora do
diretório certo. Os scripts resolvem isso via `GATUNO_COMPOSE_FILES` — uma
lista de arquivos separados por `:`, relativa à raiz do projeto:

```bash
export GATUNO_COMPOSE_FILES="docker-compose.common.yml:docker-compose.prod.yml"
./scripts/backup/backup-all.sh -s   # agora -s consegue parar/reiniciar os containers
```

Sem essa variável, os scripts assumem `docker-compose.common.yml` +
`docker-compose.dev.yml` (padrão de desenvolvimento).

## Alertas de falha

Defina `BACKUP_ALERT_CMD` no `.env` para receber um alerta quando
`backup-all.sh` terminar com falha. O resumo da falha é enviado via stdin ao
comando configurado — pode ser qualquer coisa que leia da entrada padrão:

```bash
# .env
BACKUP_ALERT_CMD="curl -s -X POST -d @- https://hooks.exemplo.com/backup-falhou"
# ou, por exemplo:
BACKUP_ALERT_CMD="mail -s 'Backup gatuno falhou' ops@exemplo.com"
```

O comando é executado com `eval`, então tem acesso a pipes/redirecionamentos —
trate-o com o mesmo cuidado que outras credenciais do `.env`.

## Agendamento Automático

Você pode escolher a melhor opção de acordo com o seu ambiente de produção:

### Opção 1: Container Docker `backup-cron` (Recomendado / 100% Portátil / Alpine)
O serviço `backup-cron` já vem integrado no `docker-compose.yml` e roda de forma isolada em um container Alpine com crond:

```bash
# Iniciar o container de backup
docker compose up -d backup-cron

# Acompanhar logs do cron e das execuções
docker logs -f gatuno-backup-cron
```

Variáveis de ambiente suportadas no `.env`:
- `BACKUP_CRON_SCHEDULE="0 3 * * *"` (Horário de execução, padrão diário às 03:00)
- `BACKUP_RETENTION="5"` (Número de backups mantidos por tipo)
- `TZ="America/Sao_Paulo"` (Fuso horário do cron)

### Opção 2: Crontab nativo do Host
```cron
0 3 * * * cd /opt/gatuno/infra && ./scripts/backup.sh all /backups -q >> /backups/cron.log 2>&1
```

### Opção 3: Systemd Timer (Hosts Debian/Ubuntu)
```bash
sudo cp scripts/backup/gatuno-backup.service scripts/backup/gatuno-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gatuno-backup.timer
journalctl -u gatuno-backup.service -f
```

## Primeira limpeza dos backups legados em produção

Se o diretório de backups ainda tem `.tar.zst` legados (formato antigo, sem
deduplicação — arquivos grandes tipo `rustfs-data-backup-*.tar.zst`), a
ordem segura é:

1. Rodar `backup-all.sh` para gerar o primeiro backup no formato novo (`rustfs-backup-*/`).
2. `./scripts/backup/prune-legacy-backups.sh ./backups` (dry-run) — o script já verifica sozinho o
   manifesto do backup novo antes de listar o que apagaria; conferir a lista.
3. `./scripts/backup/prune-legacy-backups.sh ./backups --apply`.

(`restore-api-data.sh -v` também verifica o manifesto, mas restaura de verdade em
seguida — não é uma checagem isolada. Para só validar, use `prune-legacy-backups.sh`
em dry-run, que faz a verificação sem tocar em nada, ou rode `sha256sum -c manifest.sha256`
manualmente a partir de `<backup>/data/`.)

## Sobre o manifesto incremental (binários)

`backup-api-data.sh` não recalcula o SHA256 de todo o volume a cada execução.
Arquivos que o `rsync --link-dest` não precisou transferir (por já serem
idênticos ao backup anterior) reaproveitam o hash do manifesto anterior; só
os arquivos novos/alterados são relidos do disco. Se por qualquer motivo o
manifesto incremental sair incompleto, o script detecta e recalcula tudo
automaticamente (mais lento, porém sempre correto).
