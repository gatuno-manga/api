export interface DashboardStats {
	counts: {
		books: number;
		chapters: number;
		users: number;
		pages: number;
		tags: number;
		authors: number;
		sensitiveContent: number;
	};
	status: {
		books: Array<{ status: string; count: number }>;
		chapters: Array<{ status: string; count: number }>;
	};
	sensitiveContent: Array<{ name: string; count: number }>;
	tags: Array<{ name: string; count: number }>;
}

export interface DashboardRepositoryPort {
	getOverviewStats(): Promise<DashboardStats>;
}
