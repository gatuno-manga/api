-- Migration: Create chapter_comments table
-- Description: Stores comments by chapter with multi-level threaded replies

CREATE TABLE IF NOT EXISTS chapter_comments (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    chapter_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    parent_id VARCHAR(36) NULL,
    content TEXT NOT NULL,
    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,

    CONSTRAINT fk_chapter_comments_chapter
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
    CONSTRAINT fk_chapter_comments_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_chapter_comments_parent
        FOREIGN KEY (parent_id) REFERENCES chapter_comments(id) ON DELETE CASCADE
);

-- Indexes for chapter feed and reply-tree traversal
CREATE INDEX idx_chapter_comments_chapter ON chapter_comments(chapter_id);
CREATE INDEX idx_chapter_comments_parent ON chapter_comments(parent_id);
CREATE INDEX idx_chapter_comments_created_at ON chapter_comments(created_at);
CREATE INDEX idx_chapter_comments_chapter_parent_created
    ON chapter_comments(chapter_id, parent_id, created_at);
