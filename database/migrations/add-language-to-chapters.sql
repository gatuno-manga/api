-- Migration: Add languageCode to chapters and update unique constraint
-- Description: Adds the languageCode column with a default of pt-BR and modifies the unique index to allow same chapter index across different languages.

-- 1. Add languageCode column if not exists
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'chapters' 
      AND COLUMN_NAME = 'languageCode'
);
SET @s = IF(@col_exists = 0, 'ALTER TABLE chapters ADD COLUMN languageCode VARCHAR(10) NOT NULL DEFAULT "pt-BR"', 'SELECT "languageCode already exists"');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Drop the old unique index (index, bookId) if exists.
-- It must be a unique index covering exactly those two columns: the new index
-- from step 3 also contains both, and matching it would drop and rebuild it on
-- every run.
SET @constraint_name = (
    SELECT INDEX_NAME
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'chapters' 
      AND NON_UNIQUE = 0
    GROUP BY INDEX_NAME
    HAVING COUNT(*) = 2
       AND SUM(COLUMN_NAME IN ('index', 'bookId')) = 2
    LIMIT 1
);

SET @s = IF(@constraint_name IS NOT NULL, CONCAT('ALTER TABLE chapters DROP INDEX `', @constraint_name, '`'), 'SELECT "Index not found, skipping drop"');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Create the new unique index if not exists
SET @idx_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'chapters' 
      AND INDEX_NAME = 'idx_chapter_book_index_lang'
);
SET @s = IF(@idx_exists = 0, 'CREATE UNIQUE INDEX idx_chapter_book_index_lang ON chapters(bookId, `index`, languageCode)', 'SELECT "idx_chapter_book_index_lang already exists"');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
