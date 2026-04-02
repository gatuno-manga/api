-- Migration: Add profile image path to users
-- Description: Stores relative file path for user avatar

ALTER TABLE users
ADD COLUMN IF NOT EXISTS profileImagePath VARCHAR(255) NULL;
