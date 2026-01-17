-- Add index column to covers table
ALTER TABLE `covers` ADD COLUMN `index` INT NOT NULL DEFAULT 0;

-- Update existing covers index based on "Volume N" pattern
-- Prioritizes "Volume N" titles and sorts them numerically
-- Other titles are placed at the end
WITH CTE AS (
    SELECT 
        id, 
        ROW_NUMBER() OVER (
            PARTITION BY bookId 
            ORDER BY 
                CASE 
                    WHEN title REGEXP '^Volume [0-9]+$' THEN 0 
                    ELSE 1 
                END ASC,
                CASE 
                    WHEN title REGEXP '^Volume [0-9]+$' THEN CAST(SUBSTRING_INDEX(title, ' ', -1) AS UNSIGNED)
                    ELSE 999999
                END ASC,
                title ASC
        ) - 1 as computed_index
    FROM `covers`
)
UPDATE `covers` 
JOIN CTE ON `covers`.id = CTE.id
SET `covers`.`index` = CTE.computed_index;

-- Fix multiple selected covers: Keep only the one with the highest index selected
-- If a book has multiple covers marked as 'selected', this unselects all except the one with the highest index
WITH RankedSelected AS (
    SELECT 
        id, 
        ROW_NUMBER() OVER (
            PARTITION BY bookId 
            ORDER BY `index` DESC
        ) as rn
    FROM `covers`
    WHERE selected = TRUE
)
UPDATE `covers` 
JOIN RankedSelected ON `covers`.id = RankedSelected.id
SET `covers`.selected = FALSE
WHERE RankedSelected.rn > 1;