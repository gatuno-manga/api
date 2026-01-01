import { Injectable, Scope, LoggerService } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AppConfigService } from './app-config/app-config.service';
import {
	LogLevel,
	LogContext,
	LogMetadata,
	PerformanceLog,
	HttpRequestLog,
	QueueJobLog,
	BookScrapingLog,
	ChapterProcessingLog,
	FileUploadLog,
	UserActionLog,
	DatabaseErrorLog,
	ValidationErrorLog,
} from './common/types/logging.types';

@Injectable({ scope: Scope.TRANSIENT })
export class CustomLogger implements LoggerService {
	private static contextRules: Map<string, number> = new Map();
	private static initialized = false;

	private readonly DEFAULT_CONTEXT = '*';
	private readonly DEFAULT_LEVEL: LogLevel = 'info';

	private readonly LOG_LEVEL_MAP: Readonly<Record<LogLevel, number>> = {
		trace: 0,
		debug: 1,
		info: 2,
		warn: 3,
		error: 4,
	};

	private context?: string;

	constructor(
		private readonly configService: AppConfigService,
		@InjectPinoLogger()
		private readonly logger: PinoLogger,
	) {
		if (!CustomLogger.initialized) {
			this.initializeContextRules();
			CustomLogger.initialized = true;
		}
	}

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
		let message: string;
		let trace: string | undefined;
		let context: string | undefined;
		let metadata: LogMetadata = {};

		if (messageOrError instanceof Error) {
			const error = messageOrError;
			message = error.message;
			trace = error.stack;
			context = traceOrContext as string;
			metadata = (contextOrMetadata as LogMetadata) || {};

			metadata.errorName = error.name;
			metadata.errorStack = error.stack;
		} else {
			message = messageOrError;
			trace = traceOrContext;
			context = contextOrMetadata as string;
		}

		const finalContext = context || this.context;

		if (!this.shouldLog('error', finalContext)) {
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

	/**
	 * Log de performance de operações
	 */
	logPerformance(data: PerformanceLog): void {
		const { operation, duration, metadata = {} } = data;

		const level: LogLevel = duration > 3000 ? 'warn' : 'info';
		const finalContext = this.context || 'Performance';

		if (!this.shouldLog(level, finalContext)) {
			return;
		}

		this.logger[level](
			{
				type: 'PERFORMANCE',
				operation,
				duration,
				durationMs: duration,
				durationSec: (duration / 1000).toFixed(2),
				context: finalContext,
				...metadata,
			},
			`Operation ${operation} completed in ${duration}ms`,
		);
	}

	/**
	 * Log de scraping de livros
	 */
	logBookScraping(data: BookScrapingLog): void {
		const { bookId, message, metadata = {} } = data;
		const finalContext = this.context || 'BookScraping';

		if (!this.shouldLog('info', finalContext)) {
			return;
		}

		this.logger.info(
			{
				type: 'BOOK_SCRAPING',
				context: finalContext,
				bookId,
				...metadata,
			},
			message,
		);
	}

	logChapterProcessing(data: ChapterProcessingLog): void {
		const { chapterId, message, metadata = {} } = data;
		const finalContext = this.context || 'ChapterProcessing';

		if (!this.shouldLog('info', finalContext)) {
			return;
		}

		this.logger.info(
			{
				type: 'CHAPTER_PROCESSING',
				context: finalContext,
				chapterId,
				...metadata,
			},
			message,
		);
	}

	logFileUpload(data: FileUploadLog): void {
		const { fileName, message, metadata = {} } = data;
		const finalContext = this.context || 'FileUpload';

		if (!this.shouldLog('info', finalContext)) {
			return;
		}

		this.logger.info(
			{
				type: 'FILE_UPLOAD',
				context: finalContext,
				fileName,
				...metadata,
			},
			message,
		);
	}

	logUserAction(data: UserActionLog): void {
		const { userId, action, metadata = {} } = data;
		const finalContext = this.context || 'UserAction';

		if (!this.shouldLog('info', finalContext)) {
			return;
		}

		this.logger.info(
			{
				type: 'USER_ACTION',
				context: finalContext,
				userId,
				action,
				...metadata,
			},
			`User ${userId} performed action: ${action}`,
		);
	}

	logQueueJob(data: QueueJobLog): void {
		const { queue, jobId, status, metadata = {} } = data;
		const finalContext = this.context || 'QueueJob';

		const level: LogLevel = status === 'FAILED' ? 'error' : 'info';

		if (!this.shouldLog(level, finalContext)) {
			return;
		}

		this.logger[level](
			{
				type: 'QUEUE_JOB',
				context: finalContext,
				queue,
				jobId,
				status,
				...metadata,
			},
			`Job ${jobId} in queue ${queue}: ${status}`,
		);
	}

	logHttpRequest(data: HttpRequestLog): void {
		const {
			method,
			url,
			statusCode,
			duration,
			userId,
			ip,
			userAgent,
			metadata = {},
		} = data;
		const finalContext = this.context || 'HttpRequest';

		const level: LogLevel =
			statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

		if (!this.shouldLog(level, finalContext)) {
			return;
		}

		this.logger[level](
			{
				type: 'HTTP_REQUEST',
				context: finalContext,
				method,
				url,
				statusCode,
				duration,
				userId,
				ip,
				userAgent,
				...metadata,
			},
			`${method} ${url} ${statusCode} - ${duration}ms`,
		);
	}

	logDatabaseError(data: DatabaseErrorLog): void {
		const { error, query, params } = data;
		const finalContext = this.context || 'Database';

		if (!this.shouldLog('error', finalContext)) {
			return;
		}

		this.logger.error(
			{
				type: 'DATABASE_ERROR',
				context: finalContext,
				errorName: error.name,
				errorMessage: error.message,
				errorStack: error.stack,
				query,
				params,
			},
			'Database operation failed',
		);
	}

	logValidationError(data: ValidationErrorLog): void {
		const { errors, context } = data;
		const finalContext = context || this.context || 'Validation';

		if (!this.shouldLog('warn', finalContext)) {
			return;
		}

		this.logger.warn(
			{
				type: 'VALIDATION_ERROR',
				context: finalContext,
				errors,
				errorsCount: errors.length,
			},
			'Validation failed',
		);
	}

	private logInternal(
		level: LogLevel,
		message: string,
		context?: string,
		metadata?: LogMetadata,
	): void {
		const finalContext = context || this.context;

		if (!this.shouldLog(level, finalContext)) {
			return;
		}

		const logData = {
			...(metadata || {}),
			context: finalContext,
			timestamp: new Date().toISOString(),
		};

		this.logger[level](logData, message);
	}

	private initializeContextRules(): void {
		try {
			const rules = this.configService.LogLevel?.trim();

			if (!rules) {
				CustomLogger.contextRules.set(
					this.DEFAULT_CONTEXT,
					this.LOG_LEVEL_MAP[this.DEFAULT_LEVEL],
				);
				return;
			}

			const ruleEntries = rules.split('/').filter(Boolean);

			for (const rule of ruleEntries) {
				const parsedRule = this.parseRule(rule.trim());

				if (!parsedRule) {
					this.logger.warn(
						{ rule },
						`Invalid log level rule: ${rule}`,
					);
					continue;
				}

				const { contexts, level } = parsedRule;
				const numericLevel =
					this.LOG_LEVEL_MAP[level] ??
					this.LOG_LEVEL_MAP[this.DEFAULT_LEVEL];

				for (const context of contexts) {
					CustomLogger.contextRules.set(context.trim(), numericLevel);
				}
			}

			if (!CustomLogger.contextRules.has(this.DEFAULT_CONTEXT)) {
				CustomLogger.contextRules.set(
					this.DEFAULT_CONTEXT,
					this.LOG_LEVEL_MAP[this.DEFAULT_LEVEL],
				);
			}
		} catch (error) {
			this.logger.error(
				{ error: error.message },
				'Failed to initialize context rules, using defaults',
			);

			CustomLogger.contextRules.set(
				this.DEFAULT_CONTEXT,
				this.LOG_LEVEL_MAP[this.DEFAULT_LEVEL],
			);
		}
	}

	private parseRule(
		rule: string,
	): { contexts: string[]; level: LogLevel } | null {
		try {
			let contextPart = this.DEFAULT_CONTEXT;
			let levelPart = this.DEFAULT_LEVEL;

			const parts = rule.split(';').filter(Boolean);

			for (const part of parts) {
				const trimmedPart = part.trim();

				if (trimmedPart.startsWith('context=')) {
					contextPart = trimmedPart.slice(8) || this.DEFAULT_CONTEXT;
				} else if (trimmedPart.startsWith('level=')) {
					const extractedLevel = trimmedPart.slice(6);
					if (this.isLogLevel(extractedLevel)) {
						levelPart = extractedLevel;
					}
				}
			}

			const contexts = contextPart
				.split(',')
				.map((c) => c.trim())
				.filter(Boolean);

			return {
				contexts:
					contexts.length > 0 ? contexts : [this.DEFAULT_CONTEXT],
				level: levelPart,
			};
		} catch {
			return null;
		}
	}

	private shouldLog(methodLevel: LogLevel, context: LogContext): boolean {
		const methodLevelNum = this.LOG_LEVEL_MAP[methodLevel];
		const configuredLevelNum = this.getLogLevel(context);

		return methodLevelNum >= configuredLevelNum;
	}

	private getLogLevel(context?: string): number {
		const ctx = context || this.DEFAULT_CONTEXT;

		if (CustomLogger.contextRules.has(ctx)) {
			return CustomLogger.contextRules.get(ctx)!;
		}

		return (
			CustomLogger.contextRules.get(this.DEFAULT_CONTEXT) ??
			this.LOG_LEVEL_MAP[this.DEFAULT_LEVEL]
		);
	}

	private isLogLevel(value: string): value is LogLevel {
		return value in this.LOG_LEVEL_MAP;
	}
}
