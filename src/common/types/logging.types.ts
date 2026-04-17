export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';
export type LogContext = string | undefined;

export interface LogMetadata {
	context?: string;
	[key: string]: unknown;
}

export interface PerformanceLog {
	operation: string;
	duration: number;
	metadata?: Record<string, unknown>;
}

export interface ErrorLog {
	error: Error;
	context?: string;
	metadata?: Record<string, unknown>;
}

export interface HttpRequestLog {
	method: string;
	url: string;
	statusCode: number;
	duration: number;
	userId?: string;
	ip?: string;
	userAgent?: string;
	metadata?: Record<string, unknown>;
}

export interface QueueJobLog {
	queue: string;
	jobId: string;
	status: 'STARTED' | 'COMPLETED' | 'FAILED' | 'RETRY';
	metadata?: Record<string, unknown>;
}

export interface BookScrapingLog {
	bookId: string;
	message: string;
	metadata?: Record<string, unknown>;
}

export interface ChapterProcessingLog {
	chapterId: string;
	message: string;
	metadata?: Record<string, unknown>;
}

export interface FileUploadLog {
	fileName: string;
	message: string;
	metadata?: Record<string, unknown>;
}

export interface UserActionLog {
	userId: string;
	action: string;
	metadata?: Record<string, unknown>;
}

export interface DatabaseErrorLog {
	error: Error;
	query?: string;
	params?: unknown;
}

export interface ValidationErrorLog {
	errors: unknown[];
	context?: string;
}
