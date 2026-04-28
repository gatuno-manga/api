-- Migration: Add user-book interactions (favorites, subscriptions, reviews)
-- Date: 2026-04-27

CREATE TABLE IF NOT EXISTS favorites (
    userId VARCHAR(36) NOT NULL,
    bookId VARCHAR(36) NOT NULL,
    createdAt DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (userId, bookId),
    CONSTRAINT fk_favorites_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_favorites_book FOREIGN KEY (bookId) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscriptions (
    userId VARCHAR(36) NOT NULL,
    bookId VARCHAR(36) NOT NULL,
    createdAt DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (userId, bookId),
    CONSTRAINT fk_subscriptions_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_subscriptions_book FOREIGN KEY (bookId) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
    userId VARCHAR(36) NOT NULL,
    bookId VARCHAR(36) NOT NULL,
    rating TINYINT NOT NULL,
    content TEXT NOT NULL,
    createdAt DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
    updatedAt DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (userId, bookId),
    CONSTRAINT fk_reviews_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_book FOREIGN KEY (bookId) REFERENCES books(id) ON DELETE CASCADE
);
