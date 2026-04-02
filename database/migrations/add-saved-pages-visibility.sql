-- Migration: Add visibility flag to saved pages
-- Description: Enables public/private saved pages per user

ALTER TABLE saved_pages
ADD COLUMN IF NOT EXISTS isPublic BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_saved_pages_user_public
ON saved_pages (user_id, isPublic);
