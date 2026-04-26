-- Migration: Add FlareSolverr and Proxy support to websites table
ALTER TABLE `websites` 
ADD COLUMN `useFlareSolverr` BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN `proxyUrl` TEXT NULL;
