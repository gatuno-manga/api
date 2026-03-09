-- Migration: Add description field to collection_book and create proper join table
-- Date: 2024-12-03

-- Add description column to collection_book table
ALTER TABLE collection_book
ADD COLUMN IF NOT EXISTS description TEXT NULL;

-- Create join table for ManyToMany relationship between collections and books
-- This replaces the incorrect inline @ManyToMany without @JoinTable
CREATE TABLE IF NOT EXISTS collection_book_books (
    collectionId CHAR(36) NOT NULL,
    bookId CHAR(36) NOT NULL,
    PRIMARY KEY (collectionId, bookId),
    CONSTRAINT FK_collection_book_books_collection
        FOREIGN KEY (collectionId)
        REFERENCES collection_book(id)
        ON DELETE CASCADE,
    CONSTRAINT FK_collection_book_books_book
        FOREIGN KEY (bookId)
        REFERENCES books(id)
        ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS IDX_collection_book_books_collectionId
    ON collection_book_books(collectionId);
CREATE INDEX IF NOT EXISTS IDX_collection_book_books_bookId
    ON collection_book_books(bookId);
