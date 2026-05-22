-- Migration: Optimize books search infrastructure
-- Adds generated column for alternative titles to enable FULLTEXT search in MySQL fallback
-- and updates the search view with security metadata for Meilisearch.

-- 1. Add generated column for alternative titles
-- We use a simple extraction and cleanup to get a searchable text string from the JSON array
ALTER TABLE books
ADD COLUMN alternative_titles_text TEXT GENERATED ALWAYS AS (
    REPLACE(REPLACE(REPLACE(JSON_UNQUOTE(alternativeTitle), '[', ''), ']', ''), '"', '')
) VIRTUAL;

-- 2. Update FULLTEXT index to include the new column
-- We need to drop the old one first
ALTER TABLE books DROP INDEX idx_books_fulltext_search;
ALTER TABLE books ADD FULLTEXT INDEX idx_books_fulltext_search (title, description, alternative_titles_text);

-- 3. Update the search view for Meilisearch
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
