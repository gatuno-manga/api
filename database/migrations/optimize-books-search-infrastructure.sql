-- Migration: Optimize books search infrastructure
-- Adds generated column for alternative titles to enable FULLTEXT search in MySQL fallback
-- and updates the search view with security metadata for Meilisearch.

-- 1. Idempotent drop of the old index
SET @s = (SELECT IF(
    (SELECT COUNT(*)
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE table_name = 'books'
     AND index_name = 'idx_books_fulltext_search'
     AND table_schema = DATABASE()
    ) > 0,
    'ALTER TABLE books DROP INDEX idx_books_fulltext_search',
    'SELECT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Idempotent drop of the old column
SET @s = (SELECT IF(
    (SELECT COUNT(*)
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_name = 'books'
     AND column_name = 'alternative_titles_text'
     AND table_schema = DATABASE()
    ) > 0,
    'ALTER TABLE books DROP COLUMN alternative_titles_text',
    'SELECT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Add column for alternative titles (Regular column, not generated, to support FULLTEXT)
-- Note: In MySQL 8.4, STORED generated columns cannot refer to JSON columns,
-- and VIRTUAL generated columns cannot be part of a multi-column FULLTEXT index.
ALTER TABLE books ADD COLUMN alternative_titles_text TEXT COLLATE utf8mb4_unicode_ci;

-- 4. Initial population of the new column
UPDATE books SET alternative_titles_text = REPLACE(REPLACE(REPLACE(JSON_UNQUOTE(alternativeTitle), '[', ''), ']', ''), '"', '')
WHERE alternativeTitle IS NOT NULL;

-- 5. Create TRIGGERS to keep the column synchronized
DROP TRIGGER IF EXISTS trg_books_alt_titles_insert;
DELIMITER //
CREATE TRIGGER trg_books_alt_titles_insert BEFORE INSERT ON books
FOR EACH ROW
BEGIN
    IF NEW.alternativeTitle IS NOT NULL THEN
        SET NEW.alternative_titles_text = REPLACE(REPLACE(REPLACE(JSON_UNQUOTE(NEW.alternativeTitle), '[', ''), ']', ''), '"', '');
    END IF;
END; //
DELIMITER ;

DROP TRIGGER IF EXISTS trg_books_alt_titles_update;
DELIMITER //
CREATE TRIGGER trg_books_alt_titles_update BEFORE UPDATE ON books
FOR EACH ROW
BEGIN
    IF NEW.alternativeTitle IS NOT NULL THEN
        SET NEW.alternative_titles_text = REPLACE(REPLACE(REPLACE(JSON_UNQUOTE(NEW.alternativeTitle), '[', ''), ']', ''), '"', '');
    ELSE
        SET NEW.alternative_titles_text = NULL;
    END IF;
END; //
DELIMITER ;

-- 6. Create the unified FULLTEXT index
ALTER TABLE books ADD FULLTEXT INDEX idx_books_fulltext_search (title, description, alternative_titles_text);

-- 7. Update the search view for Meilisearch
CREATE OR REPLACE VIEW books_search_view AS
SELECT 
    b.id,
    b.title,
    b.alternativeTitle,
    b.description,
    b.type,
    b.scrapingStatus,
    b.publication,
    b.createdAt,
    b.updatedAt,
    (
        SELECT JSON_ARRAYAGG(a.name) 
        FROM authors a 
        JOIN books_authors_authors ba ON a.id = ba.authorsId 
        WHERE ba.booksId = b.id
    ) as authors,
    (
        SELECT JSON_ARRAYAGG(t.name) 
        FROM tags t 
        JOIN books_tags_tags bt ON t.id = bt.tagsId 
        WHERE bt.booksId = b.id
    ) as tags,
    (
        SELECT JSON_ARRAYAGG(t.id)
        FROM tags t 
        JOIN books_tags_tags bt ON t.id = bt.tagsId 
        WHERE bt.booksId = b.id
    ) as tagIds,
    (
        SELECT JSON_ARRAYAGG(sc.id)
        FROM sensitive_content sc
        JOIN books_sensitive_content_sensitive_content bsc ON sc.id = bsc.sensitiveContentId
        WHERE bsc.booksId = b.id
    ) as sensitiveContentIds,
    (
        SELECT COALESCE(MAX(sc.weight), 0)
        FROM sensitive_content sc
        JOIN books_sensitive_content_sensitive_content bsc ON sc.id = bsc.sensitiveContentId
        WHERE bsc.booksId = b.id
    ) as maxSensitiveWeight,
    (
        SELECT JSON_ARRAYAGG(jt.site)
        FROM (
            SELECT DISTINCT SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(REPLACE(url_item, 'http://', ''), 'https://', ''), '/', 1), ':', 1) AS site
            FROM JSON_TABLE(b.originalUrl, '$[*]' COLUMNS (url_item TEXT PATH '$')) AS t
            WHERE url_item IS NOT NULL
        ) AS jt
    ) as sites,
    (
        SELECT c.url 
        FROM covers c 
        WHERE c.bookId = b.id AND c.selected = 1
        LIMIT 1
    ) as cover
FROM books b
WHERE b.deletedAt IS NULL;
