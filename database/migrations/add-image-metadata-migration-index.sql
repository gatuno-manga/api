-- Migration: Add missing metadata indexes
-- Date: 2026-04-25

-- For pages table
ALTER TABLE pages
ADD COLUMN has_metadata BOOLEAN GENERATED ALWAYS AS (metadata IS NOT NULL) VIRTUAL,
ADD INDEX idx_pages_missing_metadata (has_metadata);

-- For covers table
ALTER TABLE covers
ADD COLUMN has_metadata BOOLEAN GENERATED ALWAYS AS (metadata IS NOT NULL) VIRTUAL,
ADD INDEX idx_covers_missing_metadata (has_metadata);

-- For user_images table
ALTER TABLE user_images
ADD COLUMN has_metadata BOOLEAN GENERATED ALWAYS AS (metadata IS NOT NULL) VIRTUAL,
ADD INDEX idx_user_images_missing_metadata (has_metadata);
