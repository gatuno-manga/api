-- Migration: Add searchTerms support for books
-- Enables adding custom synonyms like "hxh" for "Hunter x Hunter"

-- 1. Add the new column (idempotent)
SET @s = (SELECT IF(
    (SELECT COUNT(*)
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_name = 'books'
     AND column_name = 'searchTerms'
     AND table_schema = DATABASE()
    ) = 0,
    'ALTER TABLE books ADD COLUMN searchTerms JSON DEFAULT NULL',
    'SELECT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Update triggers to merge both alternativeTitle and searchTerms into the searchable text
-- We use a helper function logic to clean and concatenate both fields
DROP TRIGGER IF EXISTS trg_books_alt_titles_insert;
DELIMITER //
CREATE TRIGGER trg_books_alt_titles_insert BEFORE INSERT ON books
FOR EACH ROW
BEGIN
    DECLARE combined_text TEXT DEFAULT '';
    
    IF NEW.alternativeTitle IS NOT NULL THEN
        SET combined_text = REPLACE(REPLACE(REPLACE(JSON_UNQUOTE(NEW.alternativeTitle), '[', ''), ']', ''), '"', '');
    END IF;
    
    IF NEW.searchTerms IS NOT NULL THEN
        IF combined_text != '' THEN
            SET combined_text = CONCAT(combined_text, ', ');
        END IF;
        SET combined_text = CONCAT(combined_text, REPLACE(REPLACE(REPLACE(JSON_UNQUOTE(NEW.searchTerms), '[', ''), ']', ''), '"', ''));
    END IF;
    
    IF combined_text != '' THEN
        SET NEW.alternative_titles_text = combined_text;
    ELSE
        SET NEW.alternative_titles_text = NULL;
    END IF;
END; //
DELIMITER ;

DROP TRIGGER IF EXISTS trg_books_alt_titles_update;
DELIMITER //
CREATE TRIGGER trg_books_alt_titles_update BEFORE UPDATE ON books
FOR EACH ROW
BEGIN
    DECLARE combined_text TEXT DEFAULT '';
    
    IF NEW.alternativeTitle IS NOT NULL THEN
        SET combined_text = REPLACE(REPLACE(REPLACE(JSON_UNQUOTE(NEW.alternativeTitle), '[', ''), ']', ''), '"', '');
    END IF;
    
    IF NEW.searchTerms IS NOT NULL THEN
        IF combined_text != '' THEN
            SET combined_text = CONCAT(combined_text, ', ');
        END IF;
        SET combined_text = CONCAT(combined_text, REPLACE(REPLACE(REPLACE(JSON_UNQUOTE(NEW.searchTerms), '[', ''), ']', ''), '"', ''));
    END IF;
    
    IF combined_text != '' THEN
        SET NEW.alternative_titles_text = combined_text;
    ELSE
        SET NEW.alternative_titles_text = NULL;
    END IF;
END; //
DELIMITER ;

-- 3. Initial population of the new logic
UPDATE books 
SET alternative_titles_text = TRIM(BOTH ', ' FROM CONCAT(
    IFNULL(REPLACE(REPLACE(REPLACE(JSON_UNQUOTE(alternativeTitle), '[', ''), ']', ''), '"', ''), ''),
    ', ',
    IFNULL(REPLACE(REPLACE(REPLACE(JSON_UNQUOTE(searchTerms), '[', ''), ']', ''), '"', ''), '')
))
WHERE alternativeTitle IS NOT NULL OR searchTerms IS NOT NULL;

-- 4. Update the search view for Meilisearch
CREATE OR REPLACE VIEW books_search_view AS
SELECT 
    b.id,
    b.title,
    b.alternativeTitle,
    b.searchTerms,
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
