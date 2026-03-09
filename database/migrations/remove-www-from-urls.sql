-- Migration: Remove www. from all URLs in database
-- This migration removes 'www.' subdomain from URLs in all relevant tables
-- to maintain consistency and avoid duplicate entries

-- Remove www. from websites table
UPDATE websites
SET url = REPLACE(url, '://www.', '://')
WHERE url LIKE '%://www.%';

-- Remove www. from covers table (both url and originalUrl fields)
UPDATE covers
SET url = REPLACE(url, '://www.', '://'),
    originalUrl = REPLACE(originalUrl, '://www.', '://')
WHERE url LIKE '%://www.%' OR originalUrl LIKE '%://www.%';

-- Remove www. from chapters table
UPDATE chapters
SET originalUrl = REPLACE(originalUrl, '://www.', '://')
WHERE originalUrl LIKE '%://www.%';

-- Remove www. from books table (originalUrl is a JSON array)
-- This handles each URL in the JSON array
UPDATE books
SET originalUrl = JSON_REPLACE(
    originalUrl,
    '$',
    JSON_ARRAY(
        REPLACE(JSON_UNQUOTE(JSON_EXTRACT(originalUrl, '$[0]')), '://www.', '://'),
        REPLACE(JSON_UNQUOTE(JSON_EXTRACT(originalUrl, '$[1]')), '://www.', '://'),
        REPLACE(JSON_UNQUOTE(JSON_EXTRACT(originalUrl, '$[2]')), '://www.', '://'),
        REPLACE(JSON_UNQUOTE(JSON_EXTRACT(originalUrl, '$[3]')), '://www.', '://'),
        REPLACE(JSON_UNQUOTE(JSON_EXTRACT(originalUrl, '$[4]')), '://www.', '://')
    )
)
WHERE JSON_SEARCH(originalUrl, 'one', '%://www.%') IS NOT NULL
  AND JSON_LENGTH(originalUrl) <= 5;

-- For books with more than 5 URLs, we need a different approach
-- This is a fallback that replaces the entire JSON array
UPDATE books
SET originalUrl = REPLACE(CAST(originalUrl AS CHAR), '://www.', '://')
WHERE JSON_SEARCH(originalUrl, 'one', '%://www.%') IS NOT NULL
  AND JSON_LENGTH(originalUrl) > 5;
