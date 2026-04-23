-- Migration para adicionar prefixos de buckets (users/, books/) aos caminhos de mídia
-- Isso deve ser executado APÓS a migração física dos arquivos.

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Usuários (Bucket: users)
-- Profile Image
UPDATE users 
SET profileImagePath = CONCAT('users/', profileImagePath)
WHERE profileImagePath IS NOT NULL 
  AND profileImagePath != ''
  AND profileImagePath NOT LIKE 'users/%'
  AND profileImagePath NOT LIKE 'http%';

-- Profile Banner
UPDATE users 
SET profileBannerPath = CONCAT('users/', profileBannerPath)
WHERE profileBannerPath IS NOT NULL 
  AND profileBannerPath != ''
  AND profileBannerPath NOT LIKE 'users/%'
  AND profileBannerPath NOT LIKE 'http%';

-- 2. Livros (Bucket: books)
-- Capas
UPDATE covers
SET url = CONCAT('books/', url)
WHERE url IS NOT NULL 
  AND url != ''
  AND url NOT LIKE 'books/%'
  AND url NOT LIKE 'http%';

-- Páginas
UPDATE pages
SET path = CONCAT('books/', path)
WHERE path IS NOT NULL 
  AND path != ''
  AND path NOT LIKE 'books/%'
  AND path NOT LIKE 'http%';

-- Documentos de Capítulos
UPDATE chapters
SET documentPath = CONCAT('books/', documentPath)
WHERE documentPath IS NOT NULL 
  AND documentPath != ''
  AND documentPath NOT LIKE 'books/%'
  AND documentPath NOT LIKE 'http%';

SET FOREIGN_KEY_CHECKS = 1;
