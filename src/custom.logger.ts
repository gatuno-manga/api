import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AppConfigService } from './app-config/app-config.service';
import {
	BookScrapingLog,
	ChapterProcessingLog,
	DatabaseErrorLog,
	FileUploadLog,
	HttpRequestLog,
	LogLevel,
	LogMetadata,
	PerformanceLog,
	QueueJobLog,
	UserActionLog,
	ValidationErrorLog,
} from './common/types/logging.types';
import { LoggerRuleEngine } from './logging/logger-rule-engine';

@Injectable({ scope: Scope.TRANSIENT })
export class CustomLogger implements LoggerService {
	private context?: string;

	constructor(
		private readonly configService: AppConfigService,
		@InjectPinoLogger()
		private readonly logger: PinoLogger,
		private readonly engine: LoggerRuleEngine,
	) {}

	setContext(context: string): void {
		this.context = context;
		this.logger.setContext(context);
	}

	getContext(): string | undefined {
		return this.context;
	}

	verbose(message: string, context?: string): void {
		this.logInternal('trace', message, context);
	}

	debug(message: string, context?: string): void {
		this.logInternal('debug', message, context);
	}

	log(message: string, context?: string): void {
		this.logInternal('info', message, context);
	}

	warn(message: string, context?: string): void {
		this.logInternal('warn', message, context);
	}

	error(message: string, trace?: string, context?: string): void;
	error(error: Error, context?: string, metadata?: LogMetadata): void;
	error(
		messageOrError: string | Error,
		traceOrContext?: string,
		contextOrMetadata?: string | LogMetadata,
	): void {
		const { message, metadata, trace, context } = this.normalizeError(
			messageOrError,
			traceOrContext,
			contextOrMetadata,
		);

		const finalContext = context || this.context;

		if (!this.engine.shouldLog('error', finalContext)) {
			return;
		}

		this.logger.error(
			{
				...metadata,
				context: finalContext,
				trace,
				timestamp: new Date().toISOString(),
			},
			message,
		);
	}

	// ========== Métodos Especializados ==========

	logPerformance(data: PerformanceLog): void {
		const level: LogLevel = data.duration > 3000 ? 'warn' : 'info';
		this.emitStructured(level, 'PERFORMANCE', data.operation, {
			...data.metadata,
			duration: data.duration,
			durationMs: data.duration,
			durationSec: (data.duration / 1000).toFixed(2),
		});
	}

	logBookScraping(data: BookScrapingLog): void {
		this.emitStructured('info', 'BOOK_SCRAPING', data.message, {
			bookId: data.bookId,
			...data.metadata,
		});
	}

	logChapterProcessing(data: ChapterProcessingLog): void {
		this.emitStructured('info', 'CHAPTER_PROCESSING', data.message, {
			chapterId: data.chapterId,
			...data.metadata,
		});
	}

	logFileUpload(data: FileUploadLog): void {
		this.emitStructured('info', 'FILE_UPLOAD', data.message, {
			fileName: data.fileName,
			...data.metadata,
		});
	}

	logUserAction(data: UserActionLog): void {
		this.emitStructured(
			'info',
			'USER_ACTION',
			`User ${data.userId} performed action: ${data.action}`,
			{
				userId: data.userId,
				action: data.action,
				...data.metadata,
			},
		);
	}

	logQueueJob(data: QueueJobLog): void {
		const level: LogLevel = data.status === 'FAILED' ? 'error' : 'info';
		this.emitStructured(
			level,
			'QUEUE_JOB',
			`Job ${data.jobId} in queue ${data.queue}: ${data.status}`,
			{
				queue: data.queue,
				jobId: data.jobId,
				status: data.status,
				...data.metadata,
			},
		);
	}

	logHttpRequest(data: HttpRequestLog): void {
		const level: LogLevel =
			data.statusCode >= 500
				? 'error'
				: data.statusCode >= 400
					? 'warn'
					: 'info';

		this.emitStructured(
			level,
			'HTTP_REQUEST',
			`${data.method} ${data.url} ${data.statusCode} - ${data.duration}ms`,
			{ ...data },
		);
	}

	logDatabaseError(data: DatabaseErrorLog): void {
		this.emitStructured(
			'error',
			'DATABASE_ERROR',
			'Database operation failed',
			{
				errorName: data.error.name,
				errorMessage: data.error.message,
				errorStack: data.error.stack,
				query: data.query,
				params: data.params,
			},
		);
	}

	logValidationError(data: ValidationErrorLog): void {
		this.emitStructured('warn', 'VALIDATION_ERROR', 'Validation failed', {
			errors: data.errors,
			errorsCount: data.errors.length,
			context: data.context,
		});
	}

	// ========== Helpers Internos ==========

	private emitStructured(
		level: LogLevel,
		type: string,
		message: string,
		data: Record<string, unknown>,
	): void {
		const finalContext =
			(data.context as string | undefined) || this.context || type;

		if (!this.engine.shouldLog(level, finalContext)) {
			return;
		}

		this.logger[level](
			{
				...data,
				type,
				context: finalContext,
				timestamp: new Date().toISOString(),
			},
			message,
		);
	}

	private logInternal(
		level: LogLevel,
		message: string,
		context?: string,
		metadata?: LogMetadata,
	): void {
		const finalContext = context || this.context;

		if (!this.engine.shouldLog(level, finalContext)) {
			return;
		}

		this.logger[level](
			{
				...(metadata || {}),
				context: finalContext,
				timestamp: new Date().toISOString(),
			},
			message,
		);
	}

	private normalizeError(
		messageOrError: string | Error,
		traceOrContext?: string,
		contextOrMetadata?: string | LogMetadata,
	): {
		message: string;
		trace?: string;
		context?: string;
		metadata: LogMetadata;
	} {
		if (messageOrError instanceof Error) {
			return {
				message: messageOrError.message,
				trace: messageOrError.stack,
				context: traceOrContext as string,
				metadata: {
					...((contextOrMetadata as LogMetadata) || {}),
					errorName: messageOrError.name,
					errorStack: messageOrError.stack,
				},
			};
		}

		return {
			message: messageOrError,
			trace: traceOrContext,
			context: contextOrMetadata as string,
			metadata: {},
		};
	}
}
