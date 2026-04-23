-- Migration para remover o prefixo /data/ dos caminhos de arquivos
-- facilitando a integração com S3/RustFS e preparando para o microserviço.

SET FOREIGN_KEY_CHECKS = 0;

-- Atualiza a tabela de páginas
UPDATE pages
SET path = REPLACE(path, '/data/', '')
WHERE path LIKE '/data/%';

-- Atualiza a tabela de capas
UPDATE covers
SET url = REPLACE(url, '/data/', '')
WHERE url LIKE '/data/%';

SET FOREIGN_KEY_CHECKS = 1;
