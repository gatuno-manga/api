-- Migration: Add profile banner path to users
-- Description: Stores relative file path for user profile banner

ALTER TABLE users
ADD COLUMN IF NOT EXISTS profileBannerPath VARCHAR(255) NULL;
