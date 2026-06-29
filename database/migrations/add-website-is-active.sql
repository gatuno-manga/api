-- Migration: Add isActive to websites
-- Description: Adds a flag to disable scraping for specific websites

ALTER TABLE websites
ADD COLUMN IF NOT EXISTS isActive BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE websites MODIFY COLUMN isActive BOOLEAN NOT NULL DEFAULT true
COMMENT 'Se false, o scraper irá ignorar este website.';
