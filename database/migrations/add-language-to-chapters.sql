-- Migration: Add languageCode to chapters and update unique constraint
-- Description: Adds the languageCode column with a default of pt-BR and modifies the unique index to allow same chapter index across different languages.

-- 1. Add languageCode column
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS languageCode VARCHAR(10) NOT NULL DEFAULT 'pt-BR';

-- 2. Drop the old unique index (index, bookId).
-- Note: Since TypeORM generates a random name for the unique constraint (e.g., IDX_...), 
-- we use a dynamic SQL approach to find and drop it, ensuring this runs flawlessly on any environment.
SET @constraint_name = (
    SELECT CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'chapters' 
      AND COLUMN_NAME IN ('index', 'bookId')
    GROUP BY CONSTRAINT_NAME
    HAVING COUNT(COLUMN_NAME) = 2
    LIMIT 1
);

SET @s = IF(@constraint_name IS NOT NULL, CONCAT('ALTER TABLE chapters DROP INDEX ', @constraint_name), 'SELECT "Index not found, skipping drop"');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Create the new unique index
CREATE UNIQUE INDEX idx_chapter_book_index_lang ON chapters(bookId, `index`, languageCode);
