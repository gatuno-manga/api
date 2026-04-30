-- Migration: Create books_search_view for Meilisearch indexing
-- This view flattens the book relationships (authors, tags, covers) into a single row
-- to simplify the synchronization process.

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
        WHERE c.bookId = b.id 
        LIMIT 1
    ) as cover
FROM books b
WHERE b.deletedAt IS NULL;
