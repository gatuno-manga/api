import { Controller, Inject, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
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

interface BookCompletedPayload {
	bookId: string;
	targetUrl: string;
	scrapedTitle?: string;
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
	chapterId: string;
	bookId: string;
	scrapedTitle?: string;
	totalImages: number;
	images: string[];
}

interface NewBookCompletedPayload {
	jobId: string;
	targetUrl: string;
	title: string;
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

interface ImagesCompletedPayload {
	jobId: string;
	entityId: string;
	source: 'CHAPTER' | 'COMMENT';
	format: string;
	urlMap: Record<string, string>; // originalUrl -> internalPath
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
	) {}

	@EventPattern('scraping.new-book.completed')
	async handleNewBookScrapingCompleted(
		@Payload() data: NewBookCompletedPayload,
	) {
		this.logger.log(
			`Recebido scraping.new-book.completed para job: ${data.jobId}`,
		);

		try {
			const createBookDto: CreateBookDto = {
				title: data.title,
				description: data.description || '',
				originalUrl: [data.targetUrl],
				authors: (data.authors || []).map((name) => ({ name })),
				tags: data.tags || [],
				chapters: data.chapters.map((ch) => ({
					title: ch.title,
					originalUrl: ch.url,
					index: ch.index,
					isFinal: ch.isFinal,
				})),
				cover: {
					urlOrigin: data.targetUrl,
					urlImgs: data.covers.map((c) => ({
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
				`Erro ao criar livro automaticamente para o job ${data.jobId}: ${error.message}`,
			);
		}
	}

	@EventPattern('scraping.book.completed')
	async handleBookScrapingCompleted(@Payload() data: BookCompletedPayload) {
		this.logger.log(
			`Recebido scraping.book.completed para livro: ${data.bookId}`,
		);

		const book = await this.bookRepository.findById(data.bookId, [
			'chapters',
			'covers',
		]);

		if (!book) {
			this.logger.error(
				`Livro ${data.bookId} não encontrado ao processar conclusão de scraping`,
			);
			return;
		}

		// Sincroniza Capítulos
		await this.bookContentUpdateService.syncChapters(book, data.chapters);

		// Sincroniza Capas
		await this.bookContentUpdateService.syncCovers(
			book,
			data.covers,
			data.targetUrl,
		);

		this.logger.log(
			`Processamento de capítulos e capas finalizado para livro: ${book.title}`,
		);

		// Libera o Lock do Redis
		await this.redisService
			.getClient()
			.del(`lock:scraping:book:${data.bookId}`);
	}

	@EventPattern('scraping.chapter.completed')
	async handleChapterScrapingCompleted(
		@Payload() data: ChapterCompletedPayload,
	) {
		this.logger.log(
			`Recebido scraping.chapter.completed para capítulo: ${data.chapterId}`,
		);

		const chapter = await this.chapterRepository.findById(data.chapterId, [
			'book',
		]);

		if (!chapter) {
			this.logger.error(
				`Capítulo ${data.chapterId} não encontrado ao processar conclusão de scraping`,
			);
			return;
		}

		if (data.scrapedTitle && !chapter.title) {
			const mutableChapter = chapter as unknown as InfraChapter;
			mutableChapter.title = data.scrapedTitle;
		}

		await this.chapterScrapingShared.finalizeChapterScraping(
			chapter as unknown as InfraChapter,
			data.images,
		);

		// Libera o Lock do Redis
		await this.redisService
			.getClient()
			.del(`lock:scraping:chapter:${data.chapterId}`);
	}

	@EventPattern('scraping.images.completed')
	async handleImagesScrapingCompleted(
		@Payload() data: ImagesCompletedPayload,
	) {
		this.logger.log(
			`Recebido scraping.images.completed para ${data.source}: ${data.entityId}`,
		);

		try {
			let content = '';
			const chapter =
				data.source === 'CHAPTER'
					? await this.chapterRepository.findById(data.entityId)
					: null;
			const comment =
				data.source === 'COMMENT'
					? await this.chapterCommentRepository.findById(
							data.entityId,
						)
					: null;

			if (chapter) {
				content = chapter.content || '';
			} else if (comment) {
				content = comment.content || '';
			}

			if (!content) {
				this.logger.warn(
					`${data.source} ${data.entityId} não encontrado para atualizar URLs espelhadas`,
				);
				return;
			}

			// Converte o urlMap de caminhos internos para URLs completas
			const internalUrlMap = new Map<string, string>();
			for (const [originalUrl, internalPath] of Object.entries(
				data.urlMap,
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
				const mutableChapter = chapter as unknown as InfraChapter;
				mutableChapter.content = updatedContent;
				await this.chapterRepository.save(chapter);
			} else if (comment) {
				const mutableComment = comment as unknown as {
					content: string;
				};
				mutableComment.content = updatedContent;
				await this.chapterCommentRepository.save(comment);
			}

			this.logger.log(
				`URLs espelhadas com sucesso em ${data.source}: ${data.entityId}`,
			);
		} catch (error) {
			this.logger.error(
				`Erro ao processar scraping.images.completed: ${error.message}`,
			);
		}
	}

	@EventPattern('scraping.chapter.failed')
	async handleChapterScrapingFailed(
		@Payload() data: { chapterId: string; error: string },
	) {
		this.logger.warn(
			`Recebido scraping.chapter.failed para capítulo: ${data.chapterId}. Erro: ${data.error}`,
		);

		const chapter = await this.chapterRepository.findById(data.chapterId, [
			'book',
		]);
		if (chapter) {
			this.chapterScrapingShared.emitFailedEvent(
				chapter as unknown as InfraChapter,
				data.error,
			);
		}

		// Libera o Lock do Redis
		await this.redisService
			.getClient()
			.del(`lock:scraping:chapter:${data.chapterId}`);
	}

	/**
	 * Lógica de substituição de URLs
	 */
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
