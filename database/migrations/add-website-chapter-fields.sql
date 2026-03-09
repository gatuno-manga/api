-- Migration: Add chapter list scraping fields to websites table
-- Description: Adds fields to support automatic chapter list scraping for book updates

ALTER TABLE websites
ADD COLUMN chapter_list_selector TEXT NULL COMMENT 'CSS selector for chapter list on book page',
ADD COLUMN chapter_extract_script TEXT NULL COMMENT 'JavaScript code to extract chapter info from page';
