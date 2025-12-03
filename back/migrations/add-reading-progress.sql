-- Migration: Create reading_progress table
-- Description: Stores user reading progress for chapters with sync support

CREATE TABLE IF NOT EXISTS reading_progress (
    id VARCHAR(36) PRIMARY KEY,
    userId VARCHAR(36) NOT NULL,
    chapterId VARCHAR(36) NOT NULL,
    bookId VARCHAR(36) NOT NULL,
    pageIndex INT DEFAULT 0,
    totalPages INT DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Foreign key constraint
    CONSTRAINT fk_reading_progress_user
        FOREIGN KEY (userId)
        REFERENCES users(id)
        ON DELETE CASCADE,

    -- Unique constraint for user + chapter combination
    CONSTRAINT uq_user_chapter UNIQUE (userId, chapterId),

    -- Indexes for common queries
    INDEX idx_reading_progress_user (userId),
    INDEX idx_reading_progress_book (bookId),
    INDEX idx_reading_progress_chapter (chapterId),
    INDEX idx_reading_progress_updated (updatedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
