export enum PermissionsEnum {
	// General & System
	INTERNAL_PANEL_ACCESS = 'internal:panel',
	SYSTEM_MANAGE = 'system:config:manage',
	FILES_MANAGE = 'system:files:manage',
	AUTH_MIGRATION_VIEW = 'system:auth:migration:view',

	// Users Management
	USERS_VIEW = 'internal:users:view',
	USERS_SEARCH = 'internal:users:search',
	USERS_EDIT = 'internal:users:edit',
	USERS_DELETE = 'internal:users:delete',
	USERS_ROLES_EDIT = 'internal:users:roles:edit',
	USERS_PASSWORD_EDIT = 'internal:users:password:edit',
	USERS_MODERATION = 'mod:users:manage',

	// RBAC & Policies
	ROLES_VIEW = 'internal:roles:view',
	ROLES_MANAGE = 'internal:roles:manage',
	GROUPS_VIEW = 'internal:groups:view',
	GROUPS_MANAGE = 'internal:groups:manage',
	ACCESS_POLICIES_VIEW = 'internal:access-policies:view',
	ACCESS_POLICIES_MANAGE = 'internal:access-policies:manage',

	// Books Management
	BOOKS_VIEW_INTERNAL = 'internal:books:view',
	BOOKS_CREATE = 'internal:books:create',
	BOOKS_EDIT = 'internal:books:edit',
	BOOKS_DELETE = 'internal:books:delete',
	BOOKS_UPLOAD = 'internal:books:upload',
	BOOKS_MAINTENANCE = 'internal:books:maintenance',
	BOOKS_MANUAL_UPDATE = 'internal:books:update:manual',
	BOOKS_RELATIONSHIPS_MANAGE = 'internal:books:relationships:manage',
	BOOKS_DASHBOARD_VIEW = 'internal:books:dashboard:view',

	// Chapter Management
	CHAPTERS_VIEW_INTERNAL = 'internal:chapters:view',
	CHAPTERS_MANAGE = 'internal:chapters:manage',

	// Book Requests
	BOOK_REQUESTS_VIEW_INTERNAL = 'internal:book-requests:view',
	BOOK_REQUESTS_MANAGE = 'internal:book-requests:manage',

	// Websites
	WEBSITES_MANAGE_INTERNAL = 'internal:websites:manage',

	// Sensitive Content
	SENSITIVE_CONTENT_MANAGE = 'internal:sensitive-content:manage',
	SENSITIVE_CONTENT_VIEW = 'internal:sensitive-content:view',

	// Books & Content (Public/User)
	BOOKS_VIEW = 'books:view',
	AUTHORS_VIEW = 'authors:view',
	TAGS_VIEW = 'tags:view',
	CHAPTERS_VIEW = 'chapters:view',
	CHAPTER_COMMENTS_VIEW = 'chapters:comments:view',
	CHAPTER_COMMENTS_CREATE = 'chapters:comments:create',
	CHAPTER_COMMENTS_MANAGE_OWN = 'chapters:comments:manage:own',

	// Personal Data & Sync
	COLLECTIONS_VIEW = 'collections:view',
	COLLECTIONS_MANAGE = 'collections:manage',
	BOOK_REQUESTS_CREATE = 'book-requests:create',
	BOOK_REQUESTS_VIEW_OWN = 'book-requests:view:own',
	READING_PROGRESS_MANAGE = 'reading-progress:manage',
	SAVED_PAGES_MANAGE = 'saved-pages:manage',
	INTERACTIONS_MANAGE = 'interactions:manage',
	SYNC_ALL = 'sync:all',

	// Websites (Public/User)
	WEBSITES_VIEW = 'websites:view',
}
