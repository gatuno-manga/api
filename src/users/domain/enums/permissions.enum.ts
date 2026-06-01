export enum PermissionsEnum {
	// User Management
	USERS_VIEW = 'users:view',
	USERS_EDIT = 'users:edit',
	USERS_DELETE = 'users:delete',

	// Role Management
	ROLES_VIEW = 'roles:view',
	ROLES_MANAGE = 'roles:manage',

	// Book Management
	BOOKS_VIEW = 'books:view',
	BOOKS_CREATE = 'books:create',
	BOOKS_EDIT = 'books:edit',
	BOOKS_DELETE = 'books:delete',

	// Chapter/Content Management
	CHAPTERS_VIEW = 'chapters:view',
	CHAPTERS_MANAGE = 'chapters:manage',

	// Admin Access
	ADMIN_PANEL_ACCESS = 'admin:panel',
}
