# _archive — Scripts Defasados

> [!WARNING]
> Os scripts neste diretório **não devem ser executados**. Eles foram preservados apenas como
> registro histórico da evolução da arquitetura de armazenamento do projeto.

## Histórico de migrações

Esses scripts documentam a trajetória completa do armazenamento:

```
Disco plano (api-data/)  →  Sharding  →  Buckets locais  →  RustFS (S3)
```

## Arquivos

| Script | Fase | Por que defasado |
|---|---|---|
| `migrate-to-sharding.sh` | Fase 1 | Organizava arquivos da raiz de `api-data/` em pastas de 2 chars hex. Volume `api-data` não existe mais. |
| `migrate-buckets.sh` | Fase 2 | Movia dirs (`avatars`, `banners`...) para subpastas de bucket. Volume `api-data` não existe mais. |
| `migrate-to-buckets-sharded.ts` | Fase 2 | Migração profunda: dados do disco para estrutura sharded + update no banco. Já executado. |
| `migrate-to-real-buckets.ts` | Fase 3 | Criava diretórios de bucket no `data/` e atualizava paths no banco. Já executado. |
| `migrate-to-rustfs.sh` | Fase 4 | Migrava `api-data` para o RustFS usando `mc mirror`. Já executado. |
| `migrate-rustfs-buckets.sh` | Fase 4 | Mirror de `api-data/books` e `api-data/users` para buckets S3. Já executado. |
| `migrate-rustfs-internal.ts` | Fase 4 | Movia arquivos de `gatuno-files` para buckets corretos via TypeScript. Já executado. |
| `fast-migrate-rustfs.sh` | Fase 4 | Migração rápida de `gatuno-files` → bucket `books` via `mc mv`. Já executado. |
