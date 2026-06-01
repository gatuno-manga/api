export enum PermissionsEnum {
	// ADMIN - General & System
	ADMIN_PANEL_ACCESS = 'admin:panel',
	SYSTEM_MANAGE = 'admin:system:manage',
	FILES_MANAGE = 'admin:files:manage',
	AUTH_MIGRATION_VIEW = 'admin:auth:migration:view',

	// ADMIN - Users Management
	USERS_VIEW = 'admin:users:view',
	USERS_SEARCH = 'admin:users:search',
	USERS_EDIT = 'admin:users:edit',
	USERS_DELETE = 'admin:users:delete',
	USERS_ROLES_EDIT = 'admin:users:roles:edit',
	USERS_PASSWORD_EDIT = 'admin:users:password:edit',
	USERS_MODERATION = 'admin:users:moderation',

	// ADMIN - RBAC & Policies
	ROLES_VIEW = 'admin:roles:view',
	ROLES_MANAGE = 'admin:roles:manage',
	GROUPS_VIEW = 'admin:groups:view',
	GROUPS_MANAGE = 'admin:groups:manage',
	ACCESS_POLICIES_VIEW = 'admin:access-policies:view',
	ACCESS_POLICIES_MANAGE = 'admin:access-policies:manage',

	// ADMIN - Books Management
	BOOKS_VIEW_ADMIN = 'admin:books:view',
	BOOKS_CREATE = 'admin:books:create',
	BOOKS_EDIT = 'admin:books:edit',
	BOOKS_DELETE = 'admin:books:delete',
	BOOKS_UPLOAD = 'admin:books:upload',
	BOOKS_MAINTENANCE = 'admin:books:maintenance',
	BOOKS_RELATIONSHIPS_MANAGE = 'admin:books:relationships:manage',
	BOOKS_DASHBOARD_VIEW = 'admin:books:dashboard:view',

	// ADMIN - Book Requests
	BOOK_REQUESTS_VIEW_ADMIN = 'admin:book-requests:view',
	BOOK_REQUESTS_MANAGE = 'admin:book-requests:manage',

	// ADMIN - Websites
	WEBSITES_MANAGE_ADMIN = 'admin:websites:manage',

	// REGULAR USER - Books & Content
	BOOKS_VIEW = 'books:view',
	AUTHORS_VIEW = 'authors:view',
	TAGS_VIEW = 'tags:view',
	CHAPTERS_VIEW = 'chapters:view',
	CHAPTER_COMMENTS_VIEW = 'chapters:comments:view',
	CHAPTER_COMMENTS_CREATE = 'chapters:comments:create',
	CHAPTER_COMMENTS_MANAGE_OWN = 'chapters:comments:manage:own',

	// REGULAR USER - Personal Data
	COLLECTIONS_VIEW = 'collections:view',
	COLLECTIONS_MANAGE = 'collections:manage',
	BOOK_REQUESTS_CREATE = 'book-requests:create',
	BOOK_REQUESTS_VIEW_OWN = 'book-requests:view:own',

	// REGULAR USER - Websites
	WEBSITES_VIEW = 'websites:view',
}
