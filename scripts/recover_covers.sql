UPDATE covers 
SET 
  scrapingStatus = 'error', 
  retries = 0, 
  url = COALESCE(originalUrl, ''), 
  metadata = NULL 
WHERE 
  scrapingStatus = 'process' 
  OR (
    scrapingStatus = 'ready' 
    AND (
      url LIKE 'processing/%' 
      OR JSON_EXTRACT(metadata, '$.width') IS NULL
    )
  );
