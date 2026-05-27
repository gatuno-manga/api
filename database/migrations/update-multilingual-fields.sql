-- Migration: Multi-language Support Phase 2
-- Adds rank to alternative_titles, creates book_descriptions and author_biographies tables, and migrates existing data.

-- 1. Add rank to alternative_titles (idempotent)
SET @s = (SELECT IF(
    (SELECT COUNT(*)
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_name = 'alternative_titles'
     AND column_name = 'rank'
     AND table_schema = DATABASE()
    ) = 0,
    'ALTER TABLE alternative_titles ADD COLUMN rank INT DEFAULT 0',
    'SELECT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Create book_descriptions table (idempotent)
CREATE TABLE IF NOT EXISTS book_descriptions (
    id VARCHAR(36) PRIMARY KEY,
    description TEXT NOT NULL,
    languageCode VARCHAR(10) NOT NULL,
    rank INT DEFAULT 0,
    bookId VARCHAR(36) NOT NULL,
    CONSTRAINT fk_book_descriptions_book FOREIGN KEY (bookId) REFERENCES books(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create author_biographies table (idempotent)
CREATE TABLE IF NOT EXISTS author_biographies (
    id VARCHAR(36) PRIMARY KEY,
    biography TEXT NOT NULL,
    languageCode VARCHAR(10) NOT NULL,
    rank INT DEFAULT 0,
    authorId VARCHAR(36) NOT NULL,
    CONSTRAINT fk_author_biographies_author FOREIGN KEY (authorId) REFERENCES authors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Migrate existing book descriptions (idempotent migration)
-- Uses originalLanguageCode as default or 'pt-BR' if null
INSERT INTO book_descriptions (id, description, languageCode, rank, bookId)
SELECT 
    LOWER(CONCAT(HEX(RANDOM_BYTES(4)), '-', HEX(RANDOM_BYTES(2)), '-4', SUBSTR(HEX(RANDOM_BYTES(2)), 2, 3), '-', HEX(RANDOM_BYTES(2)), '-', HEX(RANDOM_BYTES(6)))) as id,
    b.description,
    COALESCE(b.originalLanguageCode, 'pt-BR') as languageCode,
    0 as rank,
    b.id
FROM books b
WHERE b.description IS NOT NULL AND b.description != ''
AND NOT EXISTS (
    SELECT 1 FROM book_descriptions bd WHERE bd.bookId = b.id
);

-- 5. Migrate existing author biographies (idempotent migration)
-- Since authors don't have originalLanguageCode, we default to 'pt-BR'
INSERT INTO author_biographies (id, biography, languageCode, rank, authorId)
SELECT 
    LOWER(CONCAT(HEX(RANDOM_BYTES(4)), '-', HEX(RANDOM_BYTES(2)), '-4', SUBSTR(HEX(RANDOM_BYTES(2)), 2, 3), '-', HEX(RANDOM_BYTES(2)), '-', HEX(RANDOM_BYTES(6)))) as id,
    a.biography,
    'pt-BR' as languageCode,
    0 as rank,
    a.id
FROM authors a
WHERE a.biography IS NOT NULL AND a.biography != ''
AND NOT EXISTS (
    SELECT 1 FROM author_biographies ab WHERE ab.authorId = a.id
);

-- 6. Update books_search_view for Meilisearch (to include localized data)
CREATE OR REPLACE VIEW books_search_view AS
SELECT 
    b.id,
    b.title,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT('title', at.title, 'languageCode', at.languageCode, 'rank', at.rank))
        FROM alternative_titles at
        WHERE at.bookId = b.id
    ) as alternativeTitles,
    b.searchTerms,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT('description', bd.description, 'languageCode', bd.languageCode, 'rank', bd.rank))
        FROM book_descriptions bd
        WHERE bd.bookId = b.id
    ) as localizedDescriptions,
    (
        SELECT GROUP_CONCAT(bd.description SEPARATOR ' | ')
        FROM book_descriptions bd
        WHERE bd.bookId = b.id
    ) as description,
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

-- 7. Create authors_search_view for Meilisearch
CREATE OR REPLACE VIEW authors_search_view AS
SELECT 
    a.id,
    a.name,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT('biography', ab.biography, 'languageCode', ab.languageCode, 'rank', ab.rank))
        FROM author_biographies ab
        WHERE ab.authorId = a.id
    ) as localizedBiographies,
    (
        SELECT GROUP_CONCAT(ab.biography SEPARATOR ' | ')
        FROM author_biographies ab
        WHERE ab.authorId = a.id
    ) as biography,
    a.createdAt,
    a.updatedAt
FROM authors a;

-- 8. Drop old scalar columns (ONLY after ensuring data is migrated)
-- ALTER TABLE books DROP COLUMN description;
-- ALTER TABLE authors DROP COLUMN biography;
