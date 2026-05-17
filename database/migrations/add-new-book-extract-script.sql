-- Add newBookExtractScript column to websites table
ALTER TABLE `websites` ADD COLUMN `newBookExtractScript` TEXT NULL AFTER `bookInfoExtractScript`;
