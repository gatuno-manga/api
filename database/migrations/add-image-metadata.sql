-- Migration: Add image metadata and extract user images
-- Date: 2026-04-24

-- 1. Add metadata column to pages table
ALTER TABLE pages
ADD COLUMN metadata JSON NULL;

-- 2. Add metadata column to covers table
ALTER TABLE covers
ADD COLUMN metadata JSON NULL;

-- 3. Create user_images table
CREATE TABLE IF NOT EXISTS user_images (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    path VARCHAR(255) NOT NULL,
    metadata JSON NULL,
    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    temp_userId VARCHAR(36) NULL,
    temp_type VARCHAR(10) NULL
);

-- 4. Add foreign keys to users table
ALTER TABLE users
ADD COLUMN profilePictureId VARCHAR(36) NULL,
ADD COLUMN profileBannerId VARCHAR(36) NULL;

-- 5. Data Migration: extract profile pictures and banners
INSERT INTO user_images (id, path, temp_userId, temp_type)
SELECT UUID(), profileImagePath, id, 'profile' 
FROM users 
WHERE profileImagePath IS NOT NULL AND profileImagePath != '';

INSERT INTO user_images (id, path, temp_userId, temp_type)
SELECT UUID(), profileBannerPath, id, 'banner' 
FROM users 
WHERE profileBannerPath IS NOT NULL AND profileBannerPath != '';

-- Update users table with profilePictureId and profileBannerId
UPDATE users u
JOIN user_images ui ON u.id = ui.temp_userId AND ui.temp_type = 'profile'
SET u.profilePictureId = ui.id;

UPDATE users u
JOIN user_images ui ON u.id = ui.temp_userId AND ui.temp_type = 'banner'
SET u.profileBannerId = ui.id;

-- Add constraints
ALTER TABLE users
ADD CONSTRAINT fk_user_profile_picture FOREIGN KEY (profilePictureId) REFERENCES user_images(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_user_profile_banner FOREIGN KEY (profileBannerId) REFERENCES user_images(id) ON DELETE SET NULL;

-- 6. Cleanup and remove old columns
ALTER TABLE user_images DROP COLUMN temp_userId, DROP COLUMN temp_type;

ALTER TABLE users
DROP COLUMN profileImagePath,
DROP COLUMN profileBannerPath;
