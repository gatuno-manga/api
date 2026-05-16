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
import { MediaUrlService } from '@common/services/media-url.service';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { CreateBookDto } from '@books/application/dto/create-book.dto';
import { ContentFormat } from '@books/domain/enums/content-format.enum';
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

interface ChapterCompletedPayload {
	chapterId?: string;
	chapter_id?: string;
	bookId?: string;
	book_id?: string;
	scrapedTitle?: string;
	scraped_title?: string;
	totalImages?: number;
	total_images?: number;
	images: string[];
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
	@EventPattern('scraping.update-book.completed')
	async handleBookScrapingCompleted(
		@Payload() messages: KafkaMessage[] | ScrapingBookCompletedPayload,
	) {
		const messageArray = Array.isArray(messages) ? messages : [messages];

		this.logger.log(
			`BooksKafkaConsumer: handleBookScrapingCompleted recebeu lote com ${messageArray.length} mensagens`,
		);

		for (const message of messageArray) {
			this.logger.debug(
				'BooksKafkaConsumer: Processando mensagem individual do lote...',
			);
			const data =
				this.parseMessage<ScrapingBookCompletedPayload>(message);

			if (!data) {
				this.logger.warn(
					'Falha ao dar parse na mensagem Kafka ou dados vazios.',
				);
				continue;
			}

			const bookId = data.bookId || data.book_id;
			const jobId = data.jobId || data.job_id;
			const targetUrl = data.targetUrl || data.target_url;

			this.logger.debug(
				`Dados extraídos: bookId=${bookId}, jobId=${jobId}, targetUrl=${targetUrl}`,
			);

			if (bookId) {
				this.logger.log(
					`Recebido conclusão de scraping (UPDATE) para livro: ${bookId}`,
				);

				const book = await this.bookRepository.findById(
					bookId,
					['chapters', 'covers'],
					'force_master',
				);

				if (!book) {
					this.logger.error(
						`Livro ${bookId} não encontrado ao processar conclusão de scraping`,
					);
					continue;
				}

				await this.bookContentUpdateService.syncChapters(
					book,
					data.chapters || [],
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
			} else if (data.title && targetUrl) {
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
							originalUrl: ch.url,
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
						await this.bookCreationService.createBook(
							createBookDto,
						);
					this.logger.log(
						`Livro criado automaticamente com sucesso: ${book.title} (ID: ${book.id})`,
					);
				} catch (error) {
					this.logger.error(
						`Erro ao criar livro automaticamente para o job ${jobId}: ${error.message}`,
					);
				}
			} else {
				this.logger.error(
					'Payload inválido em scraping.book.completed: sem bookId e sem metadados de criação',
				);
			}
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
				for (const [originalUrl, internalPath] of Object.entries(
					urlMap,
				)) {
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
