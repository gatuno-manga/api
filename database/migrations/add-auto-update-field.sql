-- Migration: Add autoUpdate field to books table
-- Description: Adds boolean column to control automatic updates for books
-- Default: false (books must opt-in to automatic updates)
-- Date: 2026-01-05

ALTER TABLE books
ADD COLUMN autoUpdate BOOLEAN DEFAULT false NOT NULL;

-- Create index for faster queries filtering by autoUpdate
CREATE INDEX idx_books_auto_update ON books(autoUpdate) WHERE deletedAt IS NULL;

-- Optionally: Enable autoUpdate for existing books with originalUrl
-- Uncomment the following line if you want existing books to have autoUpdate enabled
-- UPDATE books SET autoUpdate = true WHERE originalUrl IS NOT NULL AND deletedAt IS NULL;
