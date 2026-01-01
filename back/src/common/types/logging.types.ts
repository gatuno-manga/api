export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';
export type LogContext = string | undefined;

export interface LogMetadata {
	context?: string;
	[key: string]: any;
}

export interface PerformanceLog {
	operation: string;
	duration: number;
	metadata?: Record<string, any>;
}

export interface ErrorLog {
	error: Error;
	context?: string;
	metadata?: Record<string, any>;
}

export interface HttpRequestLog {
	method: string;
	url: string;
	statusCode: number;
	duration: number;
	userId?: string;
	ip?: string;
	userAgent?: string;
	metadata?: Record<string, any>;
}

export interface QueueJobLog {
	queue: string;
	jobId: string;
	status: 'STARTED' | 'COMPLETED' | 'FAILED' | 'RETRY';
	metadata?: Record<string, any>;
}

export interface BookScrapingLog {
	bookId: string;
	message: string;
	metadata?: Record<string, any>;
}

export interface ChapterProcessingLog {
	chapterId: string;
	message: string;
	metadata?: Record<string, any>;
}

export interface FileUploadLog {
	fileName: string;
	message: string;
	metadata?: Record<string, any>;
}

export interface UserActionLog {
	userId: string;
	action: string;
	metadata?: Record<string, any>;
}

export interface DatabaseErrorLog {
	error: Error;
	query?: string;
	params?: any;
}

export interface ValidationErrorLog {
	errors: any[];
	context?: string;
}
