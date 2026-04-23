-- Migration para remover o prefixo /data/ dos caminhos de arquivos restantes (usuários e capítulos)

SET FOREIGN_KEY_CHECKS = 0;

-- Atualiza caminhos de imagem de perfil e banner dos usuários
UPDATE users 
SET profileImagePath = REPLACE(profileImagePath, '/data/', '')
WHERE profileImagePath LIKE '/data/%';

UPDATE users 
SET profileBannerPath = REPLACE(profileBannerPath, '/data/', '')
WHERE profileBannerPath LIKE '/data/%';

-- Atualiza caminhos de documentos dos capítulos
UPDATE chapters
SET documentPath = REPLACE(documentPath, '/data/', '')
WHERE documentPath LIKE '/data/%';

SET FOREIGN_KEY_CHECKS = 1;
