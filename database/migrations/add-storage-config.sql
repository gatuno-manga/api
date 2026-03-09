-- Add storage configuration columns to websites table
-- These columns allow configuring cookies, localStorage, and sessionStorage for each website

ALTER TABLE `websites`
ADD COLUMN `cookies` JSON DEFAULT NULL COMMENT 'Cookies to inject before navigation (array of cookie objects)',
ADD COLUMN `localStorage` JSON DEFAULT NULL COMMENT 'localStorage items to inject after page load (key-value pairs)',
ADD COLUMN `sessionStorage` JSON DEFAULT NULL COMMENT 'sessionStorage items to inject after page load (key-value pairs)',
ADD COLUMN `reloadAfterStorageInjection` BOOLEAN DEFAULT FALSE COMMENT 'Whether to reload the page after injecting storage';

-- Example usage:
-- UPDATE websites SET cookies = '[{"name": "lang", "value": "en"}, {"name": "gdpr_accepted", "value": "true"}]' WHERE url = 'manga-site.com';
-- UPDATE websites SET localStorage = '{"reader_mode": "vertical", "image_fit": "width"}' WHERE url = 'manga-site.com';
