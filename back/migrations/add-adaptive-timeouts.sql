-- Migration: Add adaptive timeout fields to websites table
-- Description: Adds enableAdaptiveTimeouts and timeoutMultipliers fields for adaptive page loading

-- Add enableAdaptiveTimeouts column (default true)
ALTER TABLE websites
ADD COLUMN IF NOT EXISTS enableAdaptiveTimeouts BOOLEAN NOT NULL DEFAULT true;

-- Add timeoutMultipliers column (JSON, nullable)
ALTER TABLE websites
ADD COLUMN IF NOT EXISTS timeoutMultipliers JSON DEFAULT NULL;

-- Add comments for documentation
ALTER TABLE websites MODIFY COLUMN enableAdaptiveTimeouts BOOLEAN NOT NULL DEFAULT true
COMMENT 'Enable adaptive timeouts based on page size. Longer pages get larger timeouts automatically.';

ALTER TABLE websites MODIFY COLUMN timeoutMultipliers JSON DEFAULT NULL
COMMENT 'Custom timeout multipliers by page size (small, medium, large, huge). Example: {"small": 1.0, "medium": 1.5, "large": 2.0, "huge": 3.0}';
