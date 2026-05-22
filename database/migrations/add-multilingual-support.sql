-- Migration: Add multilingual support
-- Adds originalLanguageCode to books, preferredLanguage to users, and normalizes alternative titles into a relational table.

-- 1. Add originalLanguageCode to books (idempotent)
SET @s = (SELECT IF(
    (SELECT COUNT(*)
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_name = 'books'
     AND column_name = 'originalLanguageCode'
     AND table_schema = DATABASE()
    ) = 0,
    'ALTER TABLE books ADD COLUMN originalLanguageCode VARCHAR(10) DEFAULT NULL',
    'SELECT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Add preferredLanguage to users (idempotent)
SET @s = (SELECT IF(
    (SELECT COUNT(*)
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_name = 'users'
     AND column_name = 'preferredLanguage'
     AND table_schema = DATABASE()
    ) = 0,
    'ALTER TABLE users ADD COLUMN preferredLanguage VARCHAR(10) DEFAULT "pt-BR"',
    'SELECT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Create alternative_titles table (idempotent)
CREATE TABLE IF NOT EXISTS alternative_titles (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    languageCode VARCHAR(10) DEFAULT NULL,
    bookId VARCHAR(36) NOT NULL,
    CONSTRAINT fk_alternative_titles_book FOREIGN KEY (bookId) REFERENCES books(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Migrate data from JSON column to relational table
-- We use JSON_TABLE to extract elements from the array
INSERT INTO alternative_titles (id, title, languageCode, bookId)
SELECT 
    LOWER(CONCAT(HEX(RANDOM_BYTES(4)), '-', HEX(RANDOM_BYTES(2)), '-4', SUBSTR(HEX(RANDOM_BYTES(2)), 2, 3), '-', HEX(RANDOM_BYTES(2)), '-', HEX(RANDOM_BYTES(6)))) as id, 
    jt.alt_title, 
    NULL, 
    b.id
FROM books b,
JSON_TABLE(b.alternativeTitle, '$[*]' COLUMNS (alt_title VARCHAR(500) PATH '$')) AS jt
WHERE b.alternativeTitle IS NOT NULL AND JSON_LENGTH(b.alternativeTitle) > 0
AND NOT EXISTS (
    SELECT 1 FROM alternative_titles at WHERE at.bookId = b.id AND at.title = jt.alt_title
);

-- 5. Drop old triggers that managed alternative_titles_text
-- The application will now handle this field manually in the repository
DROP TRIGGER IF EXISTS trg_books_alt_titles_insert;
DROP TRIGGER IF EXISTS trg_books_alt_titles_update;

-- 6. Drop old alternativeTitle JSON column (idempotent)
SET @s = (SELECT IF(
    (SELECT COUNT(*)
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_name = 'books'
     AND column_name = 'alternativeTitle'
     AND table_schema = DATABASE()
    ) > 0,
    'ALTER TABLE books DROP COLUMN alternativeTitle',
    'SELECT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 7. Update books_search_view for Meilisearch
CREATE OR REPLACE VIEW books_search_view AS
SELECT 
    b.id,
    b.title,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT('title', at.title, 'languageCode', at.languageCode))
        FROM alternative_titles at
        WHERE at.bookId = b.id
    ) as alternativeTitles,
    b.searchTerms,
    b.description,
    b.type,
    b.scrapingStatus,
    b.publication,
    b.originalLanguageCode,
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
