-- Migration: Add URL filtering columns to websites table
-- Date: 2025-12-03
-- Description: Adds blacklist/whitelist terms and network interception flag

ALTER TABLE `websites`
ADD COLUMN `blacklistTerms` JSON DEFAULT NULL COMMENT 'Terms that will cause URLs to be ignored' AFTER `concurrencyLimit`,
ADD COLUMN `whitelistTerms` JSON DEFAULT NULL COMMENT 'Terms that URLs must contain to be accepted' AFTER `blacklistTerms`,
ADD COLUMN `useNetworkInterception` BOOLEAN DEFAULT TRUE COMMENT 'Enable network traffic interception for caching' AFTER `whitelistTerms`;

-- Example usage:
-- UPDATE websites SET
--   blacklistTerms = '["logo", "icon", "avatar", "ads", "banner", ".gif", "sprite"]',
--   whitelistTerms = '["cdn.example.com", "uploads/chapters"]',
--   useNetworkInterception = true
-- WHERE url = 'example.com';
