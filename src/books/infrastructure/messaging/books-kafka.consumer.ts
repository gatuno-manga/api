import { Controller, Inject, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { KafkaMessage } from 'kafkajs';
import { BookContentUpdateService } from '@books/application/services/book-content-update.service';
import { BookCreationService } from '@books/application/services/book-creation.service';
import { ChapterScrapingSharedService } from '@books/infrastructure/jobs/chapter-scraping.shared';
import {
	I_BOOK_REPOSITORY,
	IBookRepository,
} from '@books/application/ports/book-repository.interface';
import {
	I_CHAPTER_REPOSITORY,
	IChapterRepository,
} from '@books/application/ports/chapter-repository.interface';
import {
	I_CHAPTER_COMMENT_REPOSITORY,
	IChapterCommentRepository,
} from '@books/application/ports/chapter-comment-repository.interface';
import {
	I_COVER_REPOSITORY,
	ICoverRepository,
} from '@books/application/ports/cover-repository.interface';
import { MediaUrlService } from '@common/services/media-url.service';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { CreateBookDto } from '@books/application/dto/create-book.dto';
import { ContentFormat } from '@books/domain/enums/content-format.enum';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import * as cheerio from 'cheerio';
import { Chapter as InfraChapter } from '../database/entities/chapter.entity';
import { ChapterComment as InfraComment } from '../database/entities/chapter-comment.entity';

interface ScrapingBookCompletedPayload {
	jobId?: string;
	job_id?: string;
	bookId?: string;
	book_id?: string;
	targetUrl?: string;
	target_url?: string;
	title?: string;
	description?: string;
	authors?: string[];
	tags?: string[];
	chapters: Array<{
		title: string;
		url: string;
		index?: number;
		isFinal?: boolean;
	}>;
	covers: Array<{
		url: string;
		title?: string;
	}>;
}

interface ChapterPagePayload {
	originalUrl?: string;
	original_url?: string;
	path: string;
}

interface ChapterCompletedPayload {
	chapterId?: string;
	chapter_id?: string;
	bookId?: string;
	book_id?: string;
	scrapedTitle?: string;
	scraped_title?: string;
	totalImages?: number;
	total_images?: number;
	images: string[] | ChapterPagePayload[];
}

interface CoversCompletedPayload {
	jobId?: string;
	job_id?: string;
	bookId?: string;
	book_id?: string;
	results: string[];
}

interface ImagesCompletedPayload {
	jobId?: string;
	job_id?: string;
	entityId?: string;
	entity_id?: string;
	source: 'CHAPTER' | 'COMMENT';
	format: string;
	urlMap?: Record<string, string>; // originalUrl -> internalPath
	url_map?: Record<string, string>;
}

@Controller()
export class BooksKafkaConsumer {
	private readonly logger = new Logger(BooksKafkaConsumer.name);

	constructor(
		private readonly bookContentUpdateService: BookContentUpdateService,
		private readonly bookCreationService: BookCreationService,
		private readonly chapterScrapingShared: ChapterScrapingSharedService,
		@Inject(I_BOOK_REPOSITORY)
		private readonly bookRepository: IBookRepository,
		@Inject(I_CHAPTER_REPOSITORY)
		private readonly chapterRepository: IChapterRepository,
		@Inject(I_CHAPTER_COMMENT_REPOSITORY)
		private readonly chapterCommentRepository: IChapterCommentRepository,
		@Inject(I_COVER_REPOSITORY)
		private readonly coverRepository: ICoverRepository,
		private readonly mediaUrlService: MediaUrlService,
		private readonly redisService: RedisService,
	) {
		this.logger.log(
			'BooksKafkaConsumer: inicializado e pronto para receber eventos de scraping',
		);
	}

	private parseMessage<T>(message: KafkaMessage | T): T | null {
		if (!message) return null;

		if (
			typeof message === 'object' &&
			'value' in message &&
			Buffer.isBuffer((message as KafkaMessage).value)
		) {
			try {
				const value = (message as KafkaMessage).value;
				if (!value) return null;
				const parsed = JSON.parse(value.toString()) as T;
				this.logger.debug(
					`BooksKafkaConsumer: Mensagem Kafka parseada com sucesso: ${JSON.stringify(parsed).slice(0, 200)}...`,
				);
				return parsed;
			} catch (error) {
				this.logger.error(
					`Erro ao desserializar mensagem Kafka: ${error.message}`,
				);
				return null;
			}
		}

		return message as T;
	}

	@EventPattern('scraping.new-book.completed')
	async handleNewBookScrapingCompleted(
		@Payload() messages: KafkaMessage[] | ScrapingBookCompletedPayload,
	) {
		const messageArray = Array.isArray(messages) ? messages : [messages];

		this.logger.log(
			`BooksKafkaConsumer: handleNewBookScrapingCompleted recebeu lote com ${messageArray.length} mensagens`,
		);

		for (const message of messageArray) {
			const data =
				this.parseMessage<ScrapingBookCompletedPayload>(message);

			if (!data) {
				continue;
			}

			const jobId = data.jobId || data.job_id;
			const targetUrl = data.targetUrl || data.target_url;

			if (!data.title || !targetUrl) {
				this.logger.error(
					`Payload inválido em scraping.new-book.completed para job: ${jobId}`,
				);
				continue;
			}

			this.logger.log(
				`Recebido conclusão de scraping (NEW) para job: ${jobId}`,
			);

			try {
				const createBookDto: CreateBookDto = {
					title: data.title,
					description: data.description || '',
					originalUrl: [targetUrl],
					authors: (data.authors || []).map((name) => ({ name })),
					tags: data.tags || [],
					chapters: (data.chapters || []).map((ch) => ({
						title: ch.title,
						url: ch.url,
						index: ch.index,
						isFinal: ch.isFinal,
					})),
					cover: {
						urlOrigin: targetUrl,
						urlImgs: (data.covers || []).map((c) => ({
							url: c.url,
							title: c.title || 'Cover Image',
						})),
					},
					ignoreConflict: true,
				};

				const book =
					await this.bookCreationService.createBook(createBookDto);
				this.logger.log(
					`Livro criado automaticamente com sucesso: ${book.title} (ID: ${book.id})`,
				);
			} catch (error) {
				this.logger.error(
					`Erro ao criar livro automaticamente para o job ${jobId}: ${error.message}`,
				);
			}
		}
	}

	@EventPattern('scraping.update-book.completed')
	async handleUpdateBookScrapingCompleted(
		@Payload() messages: KafkaMessage[] | ScrapingBookCompletedPayload,
	) {
		const messageArray = Array.isArray(messages) ? messages : [messages];

		this.logger.log(
			`BooksKafkaConsumer: handleUpdateBookScrapingCompleted recebeu lote com ${messageArray.length} mensagens`,
		);

		for (const message of messageArray) {
			const data =
				this.parseMessage<ScrapingBookCompletedPayload>(message);

			if (!data) {
				continue;
			}

			const bookId = data.bookId || data.book_id;
			const targetUrl = data.targetUrl || data.target_url;

			if (!bookId) {
				this.logger.error(
					'Payload inválido em scraping.update-book.completed: sem bookId',
				);
				continue;
			}

			this.logger.log(
				`Recebido conclusão de scraping (UPDATE) para livro: ${bookId}`,
			);

			const book = await this.bookRepository.findById(bookId, [
				'chapters',
				'covers',
			]);

			if (!book) {
				this.logger.error(
					`Livro ${bookId} não encontrado ao processar conclusão de scraping`,
				);
				continue;
			}

			await this.bookContentUpdateService.syncChapters(
				book,
				data.chapters || [],
				[],
			);
			await this.bookContentUpdateService.syncCovers(
				book,
				data.covers || [],
				targetUrl || '',
			);

			this.logger.log(
				`Processamento de capítulos e capas finalizado para livro: ${book.title}`,
			);
			await this.redisService
				.getClient()
				.del(`lock:scraping:book:${bookId}`);
		}
	}

	@EventPattern('scraping.chapter.pages_extracted')
	async handleChapterPagesExtracted(
		@Payload() messages: KafkaMessage[] | ChapterCompletedPayload,
	) {
		const messageArray = Array.isArray(messages) ? messages : [messages];
		this.logger.debug(
			`handleChapterPagesExtracted: processando ${messageArray.length} mensagens`,
		);

		for (const message of messageArray) {
			const data = this.parseMessage<ChapterCompletedPayload>(message);
			if (!data) continue;

			const chapterId = data.chapterId || data.chapter_id;

			this.logger.log(
				`Fast-Track: Recebido scraping.chapter.pages_extracted para capítulo: ${chapterId}`,
			);

			if (!chapterId) continue;

			const chapter = await this.chapterRepository.findById(
				chapterId,
				['book'],
				'force_master',
			);

			if (!chapter) {
				this.logger.error(
					`Fast-Track: Capítulo ${chapterId} não encontrado`,
				);
				continue;
			}

			await this.chapterScrapingShared.saveExtractedPages(
				chapter as unknown as InfraChapter,
				data.images || [],
			);
		}
	}

	@EventPattern('scraping.chapter.completed')
	async handleChapterScrapingCompleted(
		@Payload() messages: KafkaMessage[] | ChapterCompletedPayload,
	) {
		const messageArray = Array.isArray(messages) ? messages : [messages];
		this.logger.debug(
			`handleChapterScrapingCompleted: processando ${messageArray.length} mensagens`,
		);

		for (const message of messageArray) {
			const data = this.parseMessage<ChapterCompletedPayload>(message);
			if (!data) continue;

			const chapterId = data.chapterId || data.chapter_id;

			this.logger.log(
				`Recebido scraping.chapter.completed para capítulo: ${chapterId}`,
			);

			if (!chapterId) {
				this.logger.error('Capítulo ID não encontrado no payload');
				continue;
			}

			const chapter = await this.chapterRepository.findById(
				chapterId,
				['book'],
				'force_master',
			);

			if (!chapter) {
				this.logger.error(
					`Capítulo ${chapterId} não encontrado ao processar conclusão de scraping`,
				);
				continue;
			}

			const scrapedTitle = data.scrapedTitle || data.scraped_title;
			if (scrapedTitle && !chapter.title) {
				const mutableChapter = chapter as unknown as InfraChapter;
				mutableChapter.title = scrapedTitle;
			}

			await this.chapterScrapingShared.finalizeChapterScraping(
				chapter as unknown as InfraChapter,
				data.images || [],
			);

			await this.redisService
				.getClient()
				.del(`lock:scraping:chapter:${chapterId}`);
		}
	}

	@EventPattern('scraping.covers.completed')
	async handleCoversScrapingCompleted(
		@Payload() messages: KafkaMessage[] | CoversCompletedPayload,
	) {
		const messageArray = Array.isArray(messages) ? messages : [messages];

		for (const message of messageArray) {
			const data = this.parseMessage<CoversCompletedPayload>(message);
			if (!data) continue;

			const bookId = data.bookId || data.book_id;
			if (!bookId) continue;

			this.logger.log(
				`Recebido scraping.covers.completed para livro: ${bookId}`,
			);

			try {
				const covers = await this.coverRepository.findByBookId(bookId);
				const processingCovers = covers.filter(
					(c) => c.scrapingStatus === ScrapingStatus.PROCESS,
				);

				const results = data.results || [];

				for (let i = 0; i < processingCovers.length; i++) {
					const cover = processingCovers[i];
					// Se tivermos um caminho correspondente no results, usamos
					// Caso contrário (mismatch de quantidade), mantemos o status READY mas sem trocar a URL se não houver path
					if (results[i]) {
						let path = results[i];
						if (
							!path.startsWith('http') &&
							!path.startsWith('processing/')
						) {
							path = `processing/${path}`;
						}
						cover.url = path;
					}
					cover.scrapingStatus = ScrapingStatus.READY;
					await this.coverRepository.save(cover);
				}

				this.logger.log(
					`Finalizado processamento de ${processingCovers.length} capas para o livro: ${bookId}`,
				);
			} catch (error) {
				this.logger.error(
					`Erro ao finalizar scraping de capas para o livro ${bookId}: ${error.message}`,
				);
			} finally {
				await this.redisService
					.getClient()
					.del(`lock:scraping:book:${bookId}`);
			}
		}
	}

	@EventPattern('scraping.covers.failed')
	async handleCoversScrapingFailed(
		@Payload() messages:
			| KafkaMessage[]
			| { bookId?: string; book_id?: string; error: string },
	) {
		const messageArray = Array.isArray(messages) ? messages : [messages];

		for (const message of messageArray) {
			const data = this.parseMessage<{
				bookId?: string;
				book_id?: string;
				error: string;
			}>(message);
			if (!data) continue;

			const bookId = data.bookId || data.book_id;
			if (!bookId) continue;

			this.logger.warn(
				`Recebido scraping.covers.failed para livro: ${bookId}. Erro: ${data.error}`,
			);

			try {
				const covers = await this.coverRepository.findByBookId(bookId);
				const processCovers = covers.filter(
					(c) => c.scrapingStatus === ScrapingStatus.PROCESS,
				);

				for (const cover of processCovers) {
					cover.scrapingStatus = ScrapingStatus.ERROR;
					await this.coverRepository.save(cover);
				}
			} catch (error) {
				this.logger.error(
					`Erro ao marcar falha de capas para o livro ${bookId}: ${error.message}`,
				);
			} finally {
				await this.redisService
					.getClient()
					.del(`lock:scraping:book:${bookId}`);
			}
		}
	}
	@EventPattern('scraping.images.completed')
	async handleImagesScrapingCompleted(
		@Payload() messages: KafkaMessage[] | ImagesCompletedPayload,
	) {
		const messageArray = Array.isArray(messages) ? messages : [messages];

		for (const message of messageArray) {
			const data = this.parseMessage<ImagesCompletedPayload>(message);
			if (!data) continue;

			const entityId = data.entityId || data.entity_id;
			const urlMap = data.urlMap || data.url_map;

			this.logger.log(
				`Recebido scraping.images.completed para ${data.source}: ${entityId}`,
			);

			try {
				let content = '';

				let chapter: InfraChapter | null = null;
				let comment: InfraComment | null = null;

				if (data.source === 'CHAPTER') {
					chapter = (await this.chapterRepository.findById(
						entityId as string,
						[],
						'force_master',
					)) as InfraChapter | null;
				} else if (data.source === 'COMMENT') {
					comment = (await this.chapterCommentRepository.findById(
						entityId as string,
						[],
						'force_master',
					)) as InfraComment | null;
				}

				if (chapter) {
					content = chapter.content || '';
				} else if (comment) {
					content = comment.content || '';
				}

				if (!content) {
					this.logger.warn(
						`${data.source} ${entityId} não encontrado para atualizar URLs espelhadas`,
					);
					continue;
				}

				if (!urlMap) {
					this.logger.warn(
						`Nenhum urlMap recebido para ${data.source} ${entityId}`,
					);
					continue;
				}

				const internalUrlMap = new Map<string, string>();
				for (let [originalUrl, internalPath] of Object.entries(
					urlMap,
				)) {
					if (
						!internalPath.startsWith('http') &&
						!internalPath.startsWith('processing/')
					) {
						internalPath = `processing/${internalPath}`;
					}
					const fullUrl = this.mediaUrlService.resolveUrl(
						internalPath,
						StorageBucket.BOOKS,
					);
					internalUrlMap.set(originalUrl, fullUrl);
				}

				const format =
					data.format === 'HTML'
						? ContentFormat.HTML
						: ContentFormat.MARKDOWN;
				const updatedContent = await this.replaceUrlsInText(
					content,
					format,
					internalUrlMap,
				);

				if (chapter) {
					chapter.content = updatedContent;
					await this.chapterRepository.save(chapter);
				} else if (comment) {
					comment.content = updatedContent;
					await this.chapterCommentRepository.save(comment);
				}

				this.logger.log(
					`Atualizadas ${Object.keys(urlMap).length} URLs no conteúdo do ${data.source} ${entityId}`,
				);
			} catch (error) {
				this.logger.error(
					`Erro ao processar URLs de imagens para ${data.source} ${entityId}: ${error.message}`,
				);
			}
		}
	}

	@EventPattern('scraping.chapter.failed')
	async handleChapterScrapingFailed(
		@Payload() messages:
			| KafkaMessage[]
			| { chapterId?: string; chapter_id?: string; error: string },
	) {
		const messageArray = Array.isArray(messages) ? messages : [messages];

		for (const message of messageArray) {
			const data = this.parseMessage<{
				chapterId?: string;
				chapter_id?: string;
				error: string;
			}>(message);
			if (!data) continue;

			const chapterId = data.chapterId || data.chapter_id;

			this.logger.warn(
				`Recebido scraping.chapter.failed para capítulo: ${chapterId}. Erro: ${data.error}`,
			);

			if (!chapterId) continue;

			const chapter = await this.chapterRepository.findById(
				chapterId,
				['book'],
				'force_master',
			);

			if (chapter) {
				this.chapterScrapingShared.emitFailedEvent(
					chapter as unknown as InfraChapter,
					data.error,
				);
			}

			await this.redisService
				.getClient()
				.del(`lock:scraping:chapter:${chapterId}`);
		}
	}

	private async replaceUrlsInText(
		content: string,
		format: ContentFormat,
		urlMap: Map<string, string>,
	): Promise<string> {
		if (format === ContentFormat.HTML) {
			const $ = cheerio.load(content, null, false);
			$('img').each((_, img) => {
				const src = $(img).attr('src');
				if (src) {
					const mirroredUrl = urlMap.get(src);
					if (mirroredUrl) $(img).attr('src', mirroredUrl);
				}
			});
			return $.html();
		}

		if (format === ContentFormat.MARKDOWN) {
			const { remark } = await import('remark');
			const { visit } = await import('unist-util-visit');
			const processor = remark();
			const ast = processor.parse(content);
			visit(ast, 'image', (node: { url: string }) => {
				if (node.url) {
					const mirroredUrl = urlMap.get(node.url);
					if (mirroredUrl) node.url = mirroredUrl;
				}
			});
			return processor.stringify(ast);
		}
		return content;
	}
}
