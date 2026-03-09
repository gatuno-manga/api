-- Migration: Remove ignoreFiles column
-- This column is redundant with blacklistTerms which provides the same functionality
-- with more flexibility (partial match instead of exact URL match)

ALTER TABLE `websites` DROP COLUMN IF EXISTS `ignoreFiles`;
