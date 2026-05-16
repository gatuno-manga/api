-- Migration: Refactor collections and add collaborators
-- Date: 2026-04-27

-- 1. Rename existing collection table
RENAME TABLE collection_book TO collections;

-- 2. Add visibility column and migrate isPublic
ALTER TABLE collections ADD COLUMN visibility ENUM('PRIVATE', 'PUBLIC', 'SHARED') NOT NULL DEFAULT 'PRIVATE';
UPDATE collections SET visibility = 'PUBLIC' WHERE isPublic = 1;
UPDATE collections SET visibility = 'PRIVATE' WHERE isPublic = 0;
ALTER TABLE collections DROP COLUMN isPublic;

-- 3. Create collaborators table
CREATE TABLE IF NOT EXISTS collection_collaborators (
    collectionId VARCHAR(36) NOT NULL,
    userId VARCHAR(36) NOT NULL,
    PRIMARY KEY (collectionId, userId),
    CONSTRAINT fk_collaboration_collection FOREIGN KEY (collectionId) REFERENCES collections(id) ON DELETE CASCADE,
    CONSTRAINT fk_collaboration_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Rename join table for books if it follows old pattern
-- Current table is collection_book_books
RENAME TABLE collection_book_books TO collection_books_relation;

-- 5. Fix column names in join table if needed
-- Existing columns: collectionId, bookId
