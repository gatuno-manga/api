# Utilitários de Desenvolvimento

Scripts de diagnóstico, auditoria e auxílio ao desenvolvimento.

## Arquivos

| Script | Descrição |
|---|---|
| `file-stats.sh` | Analisa estatísticas do volume RustFS (`gatuno_rustfs_data`): extensões, maiores arquivos, distribuição por pasta. |
| `verify-permissions.ts` | Auditoria de segurança: verifica se todos os endpoints têm `@Permissions()`. Retorna exit 1 se houver rotas desprotegidas. |
| `list-endpoints-by-permission.ts` | Lista todos os endpoints HTTP agrupados pelo decorador `@Permissions()`. |
| `reset-password.ts` | Reseta a senha de um usuário pelo e-mail. |
| `test-mqtt.ts` | Testa conectividade com o broker MQTT/EMQX. |
| `fix-relative-imports.ts` | Converte imports relativos (`../`) para aliases do `tsconfig.json` (`@/`). Script de refactor pontual. |

## Como executar os scripts TypeScript

Os scripts `.ts` requerem o contexto do NestJS e devem ser executados a partir da raiz do projeto:

```bash
# Verificar endpoints desprotegidos
npx tsx scripts/utils/verify-permissions.ts

# Listar endpoints por permissão
npx tsx scripts/utils/list-endpoints-by-permission.ts

# Resetar senha de usuário
npx tsx scripts/utils/reset-password.ts user@exemplo.com nova-senha

# Testar MQTT (requer ambiente Docker rodando)
npx tsx scripts/utils/test-mqtt.ts

# Analisar volume RustFS
./scripts/utils/file-stats.sh
```
