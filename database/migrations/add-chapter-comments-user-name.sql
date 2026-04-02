-- Migration: Persist username snapshot in chapter comments
-- Description: Adds user_name to chapter_comments and backfills from users

ALTER TABLE chapter_comments
ADD COLUMN IF NOT EXISTS user_name VARCHAR(255) NULL AFTER user_id;

SET @has_user_name := (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.COLUMNS
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'users'
	  AND COLUMN_NAME = 'user_name'
);

SET @has_userName := (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.COLUMNS
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'users'
	  AND COLUMN_NAME = 'userName'
);

SET @backfill_sql := IF(
	@has_user_name > 0,
	'UPDATE chapter_comments cc LEFT JOIN users u ON u.id = cc.user_id SET cc.user_name = COALESCE(NULLIF(TRIM(u.user_name), ''''), cc.user_id) WHERE cc.user_name IS NULL OR TRIM(cc.user_name) = ''''',
	IF(
		@has_userName > 0,
		'UPDATE chapter_comments cc LEFT JOIN users u ON u.id = cc.user_id SET cc.user_name = COALESCE(NULLIF(TRIM(u.userName), ''''), cc.user_id) WHERE cc.user_name IS NULL OR TRIM(cc.user_name) = ''''',
		'UPDATE chapter_comments SET user_name = user_id WHERE user_name IS NULL OR TRIM(user_name) = '''''
	)
);

PREPARE stmt_backfill FROM @backfill_sql;
EXECUTE stmt_backfill;
DEALLOCATE PREPARE stmt_backfill;

ALTER TABLE chapter_comments
MODIFY COLUMN user_name VARCHAR(255) NOT NULL;
