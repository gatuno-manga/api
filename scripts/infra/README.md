# Scripts de Infraestrutura

Scripts de setup e inicialização de serviços de infraestrutura.

## Arquivos

| Script | Descrição |
|---|---|
| `init-rustfs.sh` | Inicializa o RustFS: cria buckets (`books`, `users`, `processing`, `system`) e aplica políticas de acesso S3. Executado automaticamente pelo container `rustfs-init` no docker-compose. |

> **Nota:** `init-rustfs.sh` é referenciado como volume bind-mount no `docker-compose.common.yml`.
> Não renomeie ou mova sem atualizar o compose.
