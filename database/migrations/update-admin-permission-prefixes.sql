-- Update permission prefixes from 'admin:' to 'internal:', 'system:', and 'mod:'

-- General & System
UPDATE permissions SET name = 'internal:panel' WHERE name = 'admin:panel';
UPDATE permissions SET name = 'system:config:manage' WHERE name = 'admin:system:manage';
UPDATE permissions SET name = 'system:files:manage' WHERE name = 'admin:files:manage';
UPDATE permissions SET name = 'system:auth:migration:view' WHERE name = 'admin:auth:migration:view';

-- Users Management
UPDATE permissions SET name = 'internal:users:view' WHERE name = 'admin:users:view';
UPDATE permissions SET name = 'internal:users:search' WHERE name = 'admin:users:search';
UPDATE permissions SET name = 'internal:users:edit' WHERE name = 'admin:users:edit';
UPDATE permissions SET name = 'internal:users:delete' WHERE name = 'admin:users:delete';
UPDATE permissions SET name = 'internal:users:roles:edit' WHERE name = 'admin:users:roles:edit';
UPDATE permissions SET name = 'internal:users:password:edit' WHERE name = 'admin:users:password:edit';
UPDATE permissions SET name = 'mod:users:manage' WHERE name = 'admin:users:moderation';

-- RBAC & Policies
UPDATE permissions SET name = 'internal:roles:view' WHERE name = 'admin:roles:view';
UPDATE permissions SET name = 'internal:roles:manage' WHERE name = 'admin:roles:manage';
UPDATE permissions SET name = 'internal:groups:view' WHERE name = 'admin:groups:view';
UPDATE permissions SET name = 'internal:groups:manage' WHERE name = 'admin:groups:manage';
UPDATE permissions SET name = 'internal:access-policies:view' WHERE name = 'admin:access-policies:view';
UPDATE permissions SET name = 'internal:access-policies:manage' WHERE name = 'admin:access-policies:manage';

-- Books Management
UPDATE permissions SET name = 'internal:books:view' WHERE name = 'admin:books:view';
UPDATE permissions SET name = 'internal:books:create' WHERE name = 'admin:books:create';
UPDATE permissions SET name = 'internal:books:edit' WHERE name = 'admin:books:edit';
UPDATE permissions SET name = 'internal:books:delete' WHERE name = 'admin:books:delete';
UPDATE permissions SET name = 'internal:books:upload' WHERE name = 'admin:books:upload';
UPDATE permissions SET name = 'internal:books:maintenance' WHERE name = 'admin:books:maintenance';
UPDATE permissions SET name = 'internal:books:update:manual' WHERE name = 'admin:books:update:manual';
UPDATE permissions SET name = 'internal:books:relationships:manage' WHERE name = 'admin:books:relationships:manage';
UPDATE permissions SET name = 'internal:books:dashboard:view' WHERE name = 'admin:books:dashboard:view';

-- Chapter Management
UPDATE permissions SET name = 'internal:chapters:view' WHERE name = 'admin:chapters:view';
UPDATE permissions SET name = 'internal:chapters:manage' WHERE name = 'admin:chapters:manage';

-- Book Requests
UPDATE permissions SET name = 'internal:book-requests:view' WHERE name = 'admin:book-requests:view';
UPDATE permissions SET name = 'internal:book-requests:manage' WHERE name = 'admin:book-requests:manage';

-- Websites
UPDATE permissions SET name = 'internal:websites:manage' WHERE name = 'admin:websites:manage';

-- Sensitive Content
UPDATE permissions SET name = 'internal:sensitive-content:manage' WHERE name = 'admin:sensitive-content:manage';
UPDATE permissions SET name = 'internal:sensitive-content:view' WHERE name = 'admin:sensitive-content:view';
