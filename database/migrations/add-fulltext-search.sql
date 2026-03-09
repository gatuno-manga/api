-- Migration: Adiciona índice FULLTEXT nos campos de texto pesquisáveis da tabela books.
-- Necessário para uso de MATCH() ... AGAINST() no MySQL 8.4 (SearchFilterStrategy).
-- Campos indexados: title, description
-- Nota: alternativeTitle é do tipo JSON e não suporta índice FULLTEXT; é coberto por LIKE.

ALTER TABLE books
  ADD FULLTEXT INDEX idx_books_fulltext_search (title, description);
