-- Migration: Add multi-format content support
-- Date: 2026-02-01
-- Description: Adiciona suporte para diferentes tipos de conteúdo:
--   - IMAGE (mangás) - usa tabela pages (comportamento atual)
--   - TEXT (novels) - usa campo content no chapter
--   - DOCUMENT (PDF/EPUB) - usa campo documentPath no chapter

-- =====================================================
-- ALTERAÇÕES NA TABELA chapters
-- =====================================================

-- 1. Adicionar coluna contentType (tipo de conteúdo do capítulo)
-- Default 'image' para manter compatibilidade com dados existentes
ALTER TABLE chapters
ADD COLUMN contentType ENUM('image', 'text', 'document') NOT NULL DEFAULT 'image'
AFTER `index`;

-- 2. Adicionar coluna content (conteúdo textual para novels)
-- LONGTEXT suporta até 4GB de texto
ALTER TABLE chapters
ADD COLUMN content LONGTEXT NULL
AFTER contentType;

-- 3. Adicionar coluna contentFormat (formato do texto: markdown, html, plain)
ALTER TABLE chapters
ADD COLUMN contentFormat ENUM('markdown', 'html', 'plain') NULL
AFTER content;

-- 4. Adicionar coluna documentPath (caminho do arquivo PDF/EPUB)
ALTER TABLE chapters
ADD COLUMN documentPath VARCHAR(500) NULL
AFTER contentFormat;

-- 5. Adicionar coluna documentFormat (formato do documento: pdf, epub)
ALTER TABLE chapters
ADD COLUMN documentFormat ENUM('pdf', 'epub') NULL
AFTER documentPath;

-- 6. Tornar originalUrl nullable (TEXT e DOCUMENT não precisam de URL de origem)
ALTER TABLE chapters
MODIFY COLUMN originalUrl VARCHAR(255) NULL;

-- 7. Tornar scrapingStatus nullable (apenas IMAGE precisa de scraping)
-- Primeiro remove o default, depois permite NULL
ALTER TABLE chapters
MODIFY COLUMN scrapingStatus ENUM('process', 'ready', 'error') NULL DEFAULT NULL;

-- 8. Criar índice para contentType (para queries de scraping)
CREATE INDEX idx_chapters_content_type ON chapters(contentType);

-- 9. Criar índice composto para filtrar capítulos de imagem pendentes
CREATE INDEX idx_chapters_image_scraping ON chapters(contentType, scrapingStatus);

-- =====================================================
-- ALTERAÇÕES NA TABELA books
-- =====================================================

-- 10. Adicionar coluna availableFormats (formatos de export disponíveis)
-- Armazenado como string separada por vírgulas (simple-array do TypeORM)
ALTER TABLE books
ADD COLUMN availableFormats VARCHAR(255) NULL
AFTER autoUpdate;

-- =====================================================
-- MIGRAÇÃO DE DADOS EXISTENTES
-- =====================================================

-- 11. Atualizar todos os capítulos existentes para contentType = 'image'
-- (redundante já que o default é 'image', mas garante consistência)
UPDATE chapters
SET contentType = 'image'
WHERE contentType IS NULL OR contentType = '';

-- 12. Atualizar books existentes com formatos disponíveis
-- Livros que têm capítulos com páginas suportam ZIP e PDF
UPDATE books b
SET availableFormats = 'zip,pdf'
WHERE EXISTS (
    SELECT 1 FROM chapters c
    JOIN pages p ON p.chapterId = c.id
    WHERE c.bookId = b.id
);

-- =====================================================
-- VERIFICAÇÃO (Execute manualmente para validar)
-- =====================================================

-- Verificar estrutura da tabela chapters
-- DESCRIBE chapters;

-- Verificar estrutura da tabela books
-- DESCRIBE books;

-- Contar capítulos por tipo de conteúdo
-- SELECT contentType, COUNT(*) FROM chapters GROUP BY contentType;

-- Verificar books com formatos disponíveis
-- SELECT id, title, availableFormats FROM books WHERE availableFormats IS NOT NULL LIMIT 10;
