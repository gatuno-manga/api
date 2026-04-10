-- Migration: Add book relationships support
-- Date: 2026-04-06

CREATE TABLE IF NOT EXISTS book_relationships (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    sourceBookId CHAR(36) NOT NULL,
    targetBookId CHAR(36) NOT NULL,
    relationType ENUM(
        'sequence',
        'spin-off',
        'doujinshi',
        'same-franchise',
        'related',
        'adaptation',
        'crossover'
    ) NOT NULL,
    isBidirectional BOOLEAN NOT NULL DEFAULT FALSE,
    `order` INT NULL,
    metadata JSON NULL,
    createdAt TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updatedAt TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deletedAt TIMESTAMP(6) NULL DEFAULT NULL,

    CONSTRAINT FK_book_relationships_source
        FOREIGN KEY (sourceBookId)
        REFERENCES books(id)
        ON DELETE CASCADE,
    CONSTRAINT FK_book_relationships_target
        FOREIGN KEY (targetBookId)
        REFERENCES books(id)
        ON DELETE CASCADE,
    CONSTRAINT UQ_book_relationships_unique
        UNIQUE (sourceBookId, targetBookId, relationType),
    CONSTRAINT CHK_book_relationships_different_books
        CHECK (sourceBookId <> targetBookId)
);

CREATE INDEX IDX_book_relationships_sourceBookId
    ON book_relationships(sourceBookId);
CREATE INDEX IDX_book_relationships_targetBookId
    ON book_relationships(targetBookId);
CREATE INDEX IDX_book_relationships_relationType
    ON book_relationships(relationType);
CREATE INDEX IDX_book_relationships_deletedAt
    ON book_relationships(deletedAt);
