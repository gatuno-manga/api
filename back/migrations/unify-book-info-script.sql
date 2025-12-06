-- Migration: Unify book info extraction script
-- Adds isFinal column to chapters and bookInfoExtractScript to websites
-- Adds imageHash and originalUrl columns to covers for deduplication
-- Removes deprecated columns: chapterExtractScript, coverSelector, coverExtractScript

-- Add isFinal column to chapters
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS isFinal BOOLEAN DEFAULT FALSE;

-- Add imageHash column to covers for deduplication
ALTER TABLE covers ADD COLUMN IF NOT EXISTS imageHash VARCHAR(64) NULL;

-- Add originalUrl column to covers to track the source URL
ALTER TABLE covers ADD COLUMN IF NOT EXISTS originalUrl TEXT NULL;

-- Create index for faster hash lookups
CREATE INDEX IF NOT EXISTS idx_covers_image_hash ON covers (imageHash);

-- Add bookInfoExtractScript to websites
ALTER TABLE websites ADD COLUMN IF NOT EXISTS bookInfoExtractScript TEXT NULL;

-- Migrate existing chapterExtractScript data to bookInfoExtractScript format
-- This wraps the old script to return the new format { covers: [], chapters: [...] }
UPDATE websites
SET bookInfoExtractScript = CONCAT(
    '(() => { const chapters = ',
    chapterExtractScript,
    '; return { covers: [], chapters }; })()'
)
WHERE chapterExtractScript IS NOT NULL
  AND bookInfoExtractScript IS NULL;

-- Remove deprecated columns (uncomment when ready)
-- ALTER TABLE websites DROP COLUMN IF EXISTS chapterExtractScript;
-- ALTER TABLE websites DROP COLUMN IF EXISTS coverSelector;
-- ALTER TABLE websites DROP COLUMN IF EXISTS coverExtractScript;
