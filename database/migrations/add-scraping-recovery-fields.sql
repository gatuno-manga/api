-- Migration: Add fields for scraping recovery to chapters and covers
-- Description: Adds createdAt, updatedAt to chapters; adds createdAt, updatedAt, scrapingStatus, and retries to covers.

-- Update chapters table
ALTER TABLE chapters 
ADD COLUMN createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
ADD COLUMN updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL;

-- Update covers table
ALTER TABLE covers
ADD COLUMN scrapingStatus ENUM('process', 'ready', 'error') DEFAULT NULL,
ADD COLUMN retries INT DEFAULT 0 NOT NULL,
ADD COLUMN createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
ADD COLUMN updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL;

-- Create index for recovery queries
CREATE INDEX idx_chapters_scraping_status_updated ON chapters(scrapingStatus, updatedAt);
CREATE INDEX idx_covers_scraping_status_updated ON covers(scrapingStatus, updatedAt);
