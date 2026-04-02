-- Migration: Add visibility flag to chapter comments
-- Description: Enables public/private comments in chapter discussion threads

ALTER TABLE chapter_comments
ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_chapter_comments_public
ON chapter_comments (chapter_id, is_public, created_at);
