import { RedisService } from '@/infrastructure/redis/redis.service';
import { CreateAuthorDto } from '@books/application/dto/create-author.dto';
import { CreateBookDto } from '@books/application/dto/create-book.dto';
import {
	IBookRepository,
	I_BOOK_REPOSITORY,
} from '@books/application/ports/book-repository.interface';
import {
	IChapterCommentRepository,
	I_CHAPTER_COMMENT_REPOSITORY,
} from '@books/application/ports/chapter-comment-repository.interface';
import {
	IChapterRepository,
	I_CHAPTER_REPOSITORY,
} from '@books/application/ports/chapter-repository.interface';
import {
	ICoverRepository,
	I_COVER_REPOSITORY,
} from '@books/application/ports/cover-repository.interface';
import { BookContentUpdateService } from '@books/application/services/book-content-update.service';
import { BookCreationService } from '@books/application/services/book-creation.service';
import { Book } from '@books/domain/entities/book';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { ChapterScrapingSharedService } from '@books/infrastructure/jobs/chapter-scraping.shared';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import { MediaUrlService } from '@common/services/media-url.service';
import { Controller, Inject, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { KafkaMessage } from 'kafkajs';
import { ImageMetadata } from 'src/common/domain/value-objects/image-metadata.vo';

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
		isPrimary?: boolean;
	}>;
}

interface ChapterCompletedPayload {
	jobId?: string;
	job_id?: string;
	chapterId?: string;
	chapter_id?: string;
	targetUrl?: string;
	target_url?: string;
	pages?: Array<
		string | { originalUrl?: string; original_url?: string; path: string }
	>;
	results?: Array<
		string | { originalUrl?: string; original_url?: string; path: string }
	>;
	images?: Array<
		string | { originalUrl?: string; original_url?: string; path: string }
	>;
}

interface BatchCoversCompletedPayload {
	bookId: string;
	results: string[];
}

interface TextMirroringCompletedPayload {
	entityId: string;
	source: 'CHAPTER' | 'COMMENT';
	urlMap: Record<string, string>;
}

@Controller()
export class BooksKafkaConsumer {
	private readonly logger = new Logger(BooksKafkaConsumer.name);

	constructor(
		private readonly bookContentUpdateService: BookContentUpdateService,
		private readonly bookCreationService: BookCreationService,
		private readonly chapterScrapingShared: ChapterScrapingSharedService,
		private readonly mediaUrlService: MediaUrlService,
		private readonly redisService: RedisService,
		@Inject(I_BOOK_REPOSITORY)
		private readonly bookRepository: IBookRepository,
		@Inject(I_CHAPTER_REPOSITORY)
		private readonly chapterRepository: IChapterRepository,
		@Inject(I_COVER_REPOSITORY)
		private readonly coverRepository: ICoverRepository,
		@Inject(I_CHAPTER_COMMENT_REPOSITORY)
		private readonly commentRepository: IChapterCommentRepository,
	) {}

	private parseMessage<T>(message: KafkaMessage): T | null {
		try {
			if (!message.value) return null;
			const data = JSON.parse(message.value.toString()) as T;
			this.logger.debug(
				`BooksKafkaConsumer: Mensagem Kafka parseada com sucesso: ${typeof data}`,
			);
			return data;
		} catch (error) {
			this.logger.error(
				`Erro ao parsear mensagem Kafka: ${error instanceof Error ? error.message : String(error)}`,
			);
			return null;
		}
	}

	@EventPattern('scraping.new-book.completed')
	async handleNewBookScrapingCompleted(
		@Payload() messages: KafkaMessage[] | ScrapingBookCompletedPayload,
	) {
		const messageArray = Array.isArray(messages) ? messages : [messages];

		this.logger.log(
			`handleNewBookScrapingCompleted: processando ${messageArray.length} mensagens`,
		);

		for (const message of messageArray) {
			const data = this.parseMessage<ScrapingBookCompletedPayload>(
				message as KafkaMessage,
			);
			if (!data) continue;

			const bookId = data.bookId || data.book_id;
			const jobId = data.jobId || data.job_id;

			if (!bookId) {
				this.logger.error(
					'Mensagem de scraping de novo livro sem bookId!',
				);
				continue;
			}

			try {
				const authors: CreateAuthorDto[] = (data.authors || []).map(
					(name) => ({ name }),
				);

				const targetUrl = data.targetUrl || data.target_url || '';

				const dto: CreateBookDto = {
					title: data.title || 'Unknown',
					description: data.description,
					originalUrl: targetUrl ? [targetUrl] : [],
					authors,
					tags: data.tags || [],
					chapters: (data.chapters || []).map((c) => ({
						title: c.title,
						url: c.url,
						index: c.index,
						isFinal: c.isFinal || false,
					})),
					cover: {
						urlOrigin: targetUrl,
						urlImgs: (data.covers || []).map((c) => ({
							url: c.url,
							title: 'Cover Image',
						})),
					},
					ignoreConflict: true,
				};

				const book = await this.bookCreationService.createBook(dto);

				this.logger.log(
					`Sucesso ao criar livro ${book.title} (ID: ${book.id}) a partir do scraping (Job: ${jobId || 'N/A'}).`,
				);
			} catch (error) {
				this.logger.error(
					`Erro ao processar criação de livro ${bookId}: ${error instanceof Error ? error.message : String(error)}`,
				);
			} finally {
				await this.redisService
					.getClient()
					.del(`lock:scraping:book:${bookId}`);
			}
		}
	}

	@EventPattern('scraping.update-book.completed')
	async handleUpdateBookScrapingCompleted(
		@Payload() messages: KafkaMessage[] | ScrapingBookCompletedPayload,
	) {
		const messageArray = Array.isArray(messages) ? messages : [messages];

		this.logger.log(
			`handleUpdateBookScrapingCompleted: processando ${messageArray.length} mensagens`,
		);

		for (const message of messageArray) {
			const data = this.parseMessage<ScrapingBookCompletedPayload>(
				message as KafkaMessage,
			);
			if (!data) continue;

			const bookId = data.bookId || data.book_id;
			const jobId = data.jobId || data.job_id;

			if (!bookId) {
				this.logger.error(
					'Mensagem de scraping de atualização sem bookId!',
				);
				continue;
			}

			try {
				const chapters = (data.chapters || []).map((c) => ({
					title: c.title,
					url: c.url,
					index: c.index,
					isFinal: c.isFinal || false,
				}));

				const covers = (data.covers || []).map((c) => c.url);

				await this.bookContentUpdateService.addScrapedChapters(
					bookId,
					chapters,
					covers,
				);
				this.logger.log(
					`Sucesso ao atualizar conteúdo do livro ${bookId} (Job: ${jobId || 'N/A'}).`,
				);
			} catch (error) {
				this.logger.error(
					`Erro ao processar atualização do livro ${bookId}: ${error instanceof Error ? error.message : String(error)}`,
				);
			} finally {
				await this.redisService
					.getClient()
					.del(`lock:scraping:book:${bookId}`);
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
			const data = this.parseMessage<ChapterCompletedPayload>(
				message as KafkaMessage,
			);
			if (!data) continue;

			const chapterId = data.chapterId || data.chapter_id;
			const pages = data.images || data.pages || data.results;

			if (!chapterId) {
				this.logger.error(
					'Fast-Track: Mensagem de páginas extraídas sem ID!',
				);
				continue;
			}

			if (!pages || !Array.isArray(pages)) {
				this.logger.warn(
					`Fast-Track: Capítulo ${chapterId} sem páginas extraídas no payload!`,
				);
				continue;
			}

			try {
				await this.chapterScrapingShared.finalizeChapterScraping(
					chapterId,
					pages,
				);
				this.logger.log(
					`Fast-Track: URLs de páginas registradas para o capítulo ${chapterId}.`,
				);
			} catch (error) {
				this.logger.error(
					`Fast-Track: Erro ao registrar páginas para o capítulo ${chapterId}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
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
			const data = this.parseMessage<ChapterCompletedPayload>(
				message as KafkaMessage,
			);
			if (!data) continue;

			const chapterId = data.chapterId || data.chapter_id;
			const pages = data.images || data.pages || data.results;

			if (!chapterId) {
				this.logger.error('Mensagem de scraping de capítulo sem ID!');
				continue;
			}

			if (!pages || !Array.isArray(pages)) {
				this.logger.error(
					`Erro: Capítulo ${chapterId} finalizado sem páginas no payload!`,
				);
				continue;
			}

			try {
				await this.chapterScrapingShared.finalizeChapterScraping(
					chapterId,
					pages,
				);
				this.logger.log(
					`Sucesso ao finalizar scraping do capítulo ${chapterId}.`,
				);
			} catch (error) {
				this.logger.error(
					`Erro ao processar finalização do capítulo ${chapterId}: ${error instanceof Error ? error.message : String(error)}`,
				);
			} finally {
				await this.redisService
					.getClient()
					.del(`lock:scraping:chapter:${chapterId}`);
			}
		}
	}

	@EventPattern('scraping.covers.completed')
	async handleCoversScrapingCompleted(
		@Payload() messages: KafkaMessage[] | BatchCoversCompletedPayload,
	) {
		const messageArray = Array.isArray(messages) ? messages : [messages];

		this.logger.log(
			`handleCoversScrapingCompleted: processando ${messageArray.length} mensagens`,
		);

		for (const message of messageArray) {
			const data = this.parseMessage<BatchCoversCompletedPayload>(
				message as KafkaMessage,
			);
			if (!data) continue;

			const { bookId, results } = data;

			try {
				const processingCovers = await this.coverRepository.find({
					book: { id: bookId } as Book,
					scrapingStatus: ScrapingStatus.PROCESS,
				});

				const redis = this.redisService.getClient();

				for (let i = 0; i < processingCovers.length; i++) {
					const cover = processingCovers[i];
					const resultPath = results[i];
					if (resultPath) {
						let path: string = resultPath;

						// Normalização robusta: garante que o path usado no Redis comece com 'processing/'
						// e não tenha prefixos de buckets conhecidos duplicados.
						let lookupPath = path.replace(
							/^(books|processing)\//,
							'',
						);
						if (!lookupPath.startsWith('processing/')) {
							lookupPath = `processing/${lookupPath}`;
						}

						path = lookupPath;

						const cacheKey = `pending_optimization:${lookupPath}`;

						const cached = await redis.get(cacheKey);
						if (cached) {
							try {
								const optimized = JSON.parse(
									cached,
								) as ImageMetadata & { path: string };
								path = optimized.path;
								if (optimized) {
									cover.metadata = optimized;
								}
							} catch (_e) {
								this.logger.warn(
									`Erro ao parsear cache de otimização para capa: ${path}`,
								);
							}
						}

						cover.url = path;
					}
					cover.scrapingStatus = ScrapingStatus.READY;
					await this.coverRepository.save(cover);
				}

				this.logger.log(
					`Sucesso ao processar lote de capas para livro ${bookId}.`,
				);

				// Cleanup do cache de otimização
				for (const path of results) {
					let lookupPath = path.replace(/^(books|processing)\//, '');
					if (!lookupPath.startsWith('processing/')) {
						lookupPath = `processing/${lookupPath}`;
					}
					await redis
						.del(`pending_optimization:${lookupPath}`)
						.catch(() => {});
				}
			} catch (error) {
				this.logger.error(
					`Erro ao processar lote de capas para livro ${bookId}: ${error instanceof Error ? error.message : String(error)}`,
				);
			} finally {
				await this.redisService
					.getClient()
					.del(`lock:scraping:book:${bookId}`);
			}
		}
	}

	@EventPattern('scraping.covers.failed')
	async handleCoversScrapingFailed(@Payload() messages: KafkaMessage[]) {
		const messageArray = Array.isArray(messages) ? messages : [messages];

		for (const message of messageArray) {
			const data = this.parseMessage<{ bookId: string; error: string }>(
				message,
			);
			if (!data) continue;

			const { bookId } = data;

			try {
				await this.coverRepository.update(
					{
						book: { id: bookId } as Book,
						scrapingStatus: ScrapingStatus.PROCESS,
					},
					{ scrapingStatus: ScrapingStatus.ERROR },
				);
			} catch (error) {
				this.logger.error(
					`Erro ao marcar erro em capas para livro ${bookId}: ${error instanceof Error ? error.message : String(error)}`,
				);
			} finally {
				await this.redisService
					.getClient()
					.del(`lock:scraping:book:${bookId}`);
			}
		}
	}

	@EventPattern('scraping.images.completed')
	async handleTextMirroringCompleted(
		@Payload() messages: KafkaMessage[] | TextMirroringCompletedPayload,
	) {
		const messageArray = Array.isArray(messages) ? messages : [messages];

		this.logger.log(
			`handleTextMirroringCompleted: processando ${messageArray.length} mensagens`,
		);

		for (const message of messageArray) {
			const data = this.parseMessage<TextMirroringCompletedPayload>(
				message as KafkaMessage,
			);
			if (!data) continue;

			const { entityId, source, urlMap } = data;

			try {
				let content = '';

				if (source === 'CHAPTER') {
					const chapter =
						await this.chapterRepository.findById(entityId);
					if (!chapter) continue;
					content = chapter.content || '';
				} else if (source === 'COMMENT') {
					const comment =
						await this.commentRepository.findById(entityId);
					if (!comment) continue;
					content = comment.content || '';
				}

				if (!content) continue;

				const internalUrlMap = new Map<string, string>();
				for (const [originalUrl, pathValue] of Object.entries(urlMap)) {
					const internalPath = pathValue;

					const internalUrl = this.mediaUrlService.resolveUrl(
						internalPath,
						StorageBucket.BOOKS,
					);
					internalUrlMap.set(originalUrl, internalUrl);
				}

				let updatedContent = content;
				internalUrlMap.forEach((internalUrl, originalUrl) => {
					updatedContent = updatedContent
						.split(originalUrl)
						.join(internalUrl);
				});

				if (source === 'CHAPTER') {
					await this.chapterRepository.update(entityId, {
						content: updatedContent,
					});
				} else if (source === 'COMMENT') {
					await this.commentRepository.update(entityId, {
						content: updatedContent,
					});
				}

				this.logger.log(
					`Sucesso ao processar URLs de imagens para ${source}: ${entityId}`,
				);
			} catch (error) {
				this.logger.error(
					`Erro ao processar URLs de imagens para ${source} ${entityId}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
	}
}
