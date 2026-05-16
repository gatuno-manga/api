-- Migration: Add Soft Delete Support to Reading Progress
-- Description: Adiciona coluna deletedAt na tabela reading_progress

ALTER TABLE reading_progress ADD COLUMN deletedAt TIMESTAMP(6) NULL DEFAULT NULL;
CREATE INDEX idx_reading_progress_deletedAt ON reading_progress(deletedAt);
