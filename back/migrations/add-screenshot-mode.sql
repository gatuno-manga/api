-- Migration: Add screenshot mode column to websites table
-- Date: 2025-12-03
-- Description: Adds screenshot mode option for canvas/protected image capture
-- Note: Always captures in PNG (lossless) for maximum quality

ALTER TABLE `websites`
ADD COLUMN `useScreenshotMode` BOOLEAN DEFAULT FALSE COMMENT 'Use PNG screenshot capture instead of downloading images' AFTER `useNetworkInterception`;

-- Example usage:
-- UPDATE websites SET useScreenshotMode = true WHERE url = 'site-with-canvas.com';

-- Sites that typically need screenshot mode:
-- - Sites using canvas to render manga pages
-- - Sites with download protection (right-click disabled, etc.)
-- - Sites using WebGL for image display
-- - Sites with heavy DRM protection
