-- Migration: Create saved_pages table
-- Description: Allows users to save/bookmark pages with optional comments

CREATE TABLE IF NOT EXISTS saved_pages (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    comment TEXT,
    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    user_id VARCHAR(36) NOT NULL,
    page_id INT NOT NULL,
    chapter_id VARCHAR(36) NOT NULL,
    book_id VARCHAR(36) NOT NULL,

    CONSTRAINT fk_saved_pages_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_saved_pages_page
        FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
    CONSTRAINT fk_saved_pages_chapter
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
    CONSTRAINT fk_saved_pages_book
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,

    -- Unique constraint: A user can only save a page once
    CONSTRAINT uq_user_page UNIQUE (user_id, page_id)
);

-- Indexes for common queries
CREATE INDEX idx_saved_pages_user ON saved_pages(user_id);
CREATE INDEX idx_saved_pages_book ON saved_pages(book_id);
CREATE INDEX idx_saved_pages_chapter ON saved_pages(chapter_id);
CREATE INDEX idx_saved_pages_user_book ON saved_pages(user_id, book_id);
