-- Migration: Add visibility flag to collections
-- Description: Enables public/private collections per user

ALTER TABLE collection_book
ADD COLUMN IF NOT EXISTS isPublic BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_collection_book_user_public
ON collection_book (userId, isPublic);
