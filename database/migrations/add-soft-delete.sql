-- Migration: Add Soft Delete Support
-- Date: 2025-11-05
-- Description: Adiciona colunas deletedAt para suportar soft delete

-- Adicionar coluna deletedAt nas tabelas
ALTER TABLE books ADD COLUMN deletedAt TIMESTAMP(6) NULL DEFAULT NULL;
ALTER TABLE chapters ADD COLUMN deletedAt TIMESTAMP(6) NULL DEFAULT NULL;
ALTER TABLE pages ADD COLUMN deletedAt TIMESTAMP(6) NULL DEFAULT NULL;
ALTER TABLE covers ADD COLUMN deletedAt TIMESTAMP(6) NULL DEFAULT NULL;

-- Criar índices para melhorar performance nas consultas de soft delete
CREATE INDEX idx_books_deletedAt ON books(deletedAt);
CREATE INDEX idx_chapters_deletedAt ON chapters(deletedAt);
CREATE INDEX idx_pages_deletedAt ON pages(deletedAt);
CREATE INDEX idx_covers_deletedAt ON covers(deletedAt);

-- Verificar se as colunas foram criadas corretamente
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_NAME IN ('books', 'chapters', 'pages', 'covers')
-- AND COLUMN_NAME = 'deletedAt';
