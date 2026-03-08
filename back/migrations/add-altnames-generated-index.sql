-- Migration: add-altnames-generated-index
-- Adiciona multi-valued indexes (MySQL 8.0.17+) nas colunas JSON altNames
-- das tabelas tags e sensitive_content.
--
-- Contexto: JSON_CONTAINS() em colunas JSON sem índice causa full table scan.
-- O multi-valued index é a solução nativa do MySQL 8 para indexar arrays JSON:
-- o otimizador o utiliza automaticamente em queries com JSON_CONTAINS().
--
-- Embora o código atualmente faça match em memória (1 query + Map lookup),
-- estes índices servem como camada de segurança caso queries com JSON_CONTAINS
-- sejam necessárias no futuro.

-- ============================================================
-- Tabela: tags
-- ============================================================

ALTER TABLE `tags`
    ADD INDEX `idx_tags_altnames_mv` ((CAST(`altNames` AS CHAR(255) ARRAY)));

-- ============================================================
-- Tabela: sensitive_content
-- ============================================================

ALTER TABLE `sensitive_content`
    ADD INDEX `idx_sensitive_content_altnames_mv` ((CAST(`altNames` AS CHAR(255) ARRAY)));
