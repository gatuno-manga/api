import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { AppConfigService } from 'src/app-config/app-config.service';
import { In, Repository } from 'typeorm';
import { ChapterRead } from '../entities/chapter-read.entity';
import { Chapter } from '../entities/chapter.entity';
import { ContentType } from '../enum/content-type.enum';
import { ScrapingStatus } from '../enum/scrapingStatus.enum';
import { ChapterUpdatedEvent } from './events/chapter-updated.event';

@Injectable()
export class ChapterService {
	private readonly logger = new Logger(ChapterService.name);
	constructor(
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		@InjectRepository(ChapterRead)
		private readonly chapterReadRepository: Repository<ChapterRead>,
		private readonly appConfig: AppConfigService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	private urlImage(url: string): string {
		if (!url || url.startsWith('null') || url.startsWith('undefined'))
			return '';
		const appUrl = this.appConfig.apiUrl;
		return `${appUrl}${url}`;
	}

	async getChapter(idChapter: string, userId?: string) {
		const chapter = await this.chapterRepository
			.createQueryBuilder('chapter')
			.leftJoinAndSelect('chapter.book', 'book')
			.leftJoinAndSelect('chapter.pages', 'pages')
			.where('chapter.id = :id', { id: idChapter })
			.getOne();

		if (!chapter) {
			this.logger.warn(`Chapter with id ${idChapter} not found`);
			throw new NotFoundException(
				`Chapter with id ${idChapter} not found`,
			);
		}

		const previousChapter = await this.chapterRepository
			.createQueryBuilder('chapter')
			.where('chapter.bookId = :bookId', { bookId: chapter.book.id })
			.andWhere('chapter.index < :currentIndex', {
				currentIndex: chapter.index,
			})
			.orderBy('chapter.index', 'DESC')
			.select(['chapter.id'])
			.getOne();
		const nextChapter = await this.chapterRepository
			.createQueryBuilder('chapter')
			.where('chapter.bookId = :bookId', { bookId: chapter.book.id })
			.andWhere('chapter.index > :currentIndex', {
				currentIndex: chapter.index,
			})
			.orderBy('chapter.index', 'ASC')
			.select(['chapter.id'])
			.getOne();
		const maxIndexChapter = await this.chapterRepository
			.createQueryBuilder('chapter')
			.where('chapter.bookId = :bookId', { bookId: chapter.book.id })
			.select('MAX(chapter.index)', 'max')
			.getRawOne();
		const totalChapters = maxIndexChapter?.max
			? Number(maxIndexChapter.max)
			: 0;
		const { book, ...chapterWithoutBook } = chapter;

		// Monta resposta baseada no tipo de conteúdo
		const baseResponse: Omit<Chapter, 'book'> & {
			previous?: string;
			next?: string;
			bookId: string;
			bookTitle: string;
			totalChapters: number;
			documentPath?: string | null;
		} = {
			...chapterWithoutBook,
			previous: previousChapter?.id,
			next: nextChapter?.id,
			bookId: book.id,
			bookTitle: book.title,
			totalChapters,
		};

		// Para IMAGE: retorna pages com URLs completas
		if (chapter.contentType === ContentType.IMAGE) {
			if (chapterWithoutBook.pages) {
				for (const page of chapterWithoutBook.pages) {
					page.path = this.urlImage(page.path);
				}
			}
		} else {
			// Remove pages para outros tipos para economizar banda
			(baseResponse as Partial<Chapter>).pages = undefined;
		}

		// Para DOCUMENT: converte documentPath para URL completa
		if (
			chapter.contentType === ContentType.DOCUMENT &&
			chapter.documentPath
		) {
			baseResponse.documentPath = this.urlImage(chapter.documentPath);
		}

		// Para TEXT: content já está no objeto, não precisa modificar

		if (userId) {
			this.markChapterAsRead(idChapter, userId).catch((err) =>
				this.logger.error(err),
			);
		}

		return baseResponse;
	}

	async resetChapter(idChapter: string) {
		const chapter = await this.chapterRepository.findOne({
			where: { id: idChapter },
			relations: ['book'],
		});
		if (!chapter) {
			throw new NotFoundException(
				`Chapter with id ${idChapter} not found`,
			);
		}
		chapter.scrapingStatus = ScrapingStatus.PROCESS;
		await this.chapterRepository.save(chapter);
		this.eventEmitter.emit('chapters.updated', chapter);
		this.eventEmitter.emit(
			'chapter.updated',
			new ChapterUpdatedEvent(chapter.id, chapter.book.id),
		);
		return chapter;
	}

	async markChapterAsRead(chapterId: string, userId: string) {
		const chapter = await this.chapterRepository.findOne({
			where: { id: chapterId },
		});
		if (!chapter) {
			throw new NotFoundException(
				`Chapter with id ${chapterId} not found`,
			);
		}

		// Verificar se já está marcado como lido
		const existing = await this.chapterReadRepository.findOne({
			where: {
				chapter: { id: chapterId },
				user: { id: userId },
			},
		});

		if (existing) {
			this.logger.log(
				`Chapter ${chapterId} already marked as read by user ${userId}`,
			);
			return existing;
		}

		const chapterRead = this.chapterReadRepository.create({
			chapter,
			user: { id: userId },
		});
		await this.chapterReadRepository.save(chapterRead);
		this.logger.log(
			`Chapter ${chapterId} marked as read by user ${userId}`,
		);
		return chapterRead;
	}

	async markChapterAsUnread(chapterId: string, userId: string) {
		const chapter = await this.chapterRepository.findOne({
			where: { id: chapterId },
		});
		if (!chapter) {
			throw new NotFoundException(
				`Chapter with id ${chapterId} not found`,
			);
		}
		const result = await this.chapterReadRepository.delete({
			chapter: { id: chapterId },
			user: { id: userId },
		});
		this.logger.log(
			`Chapter ${chapterId} marked as unread by user ${userId}`,
		);
		return result;
	}

	async markChaptersAsRead(chapterIds: string[], userId: string) {
		const results: {
			chapterId: string;
			success: boolean;
			result?: ChapterRead;
			error?: string;
		}[] = [];
		for (const chapterId of chapterIds) {
			try {
				const result = await this.markChapterAsRead(chapterId, userId);
				results.push({ chapterId, success: true, result });
			} catch (error) {
				results.push({
					chapterId,
					success: false,
					error:
						error instanceof Error
							? error.message
							: 'Unknown error',
				});
			}
		}
		this.logger.log(
			`Marked ${results.filter((r) => r.success).length}/${chapterIds.length} chapters as read for user ${userId}`,
		);
		return results;
	}

	async markChaptersAsUnread(chapterIds: string[], userId: string) {
		const results: {
			chapterId: string;
			success: boolean;
			result?: import('typeorm').DeleteResult;
			error?: string;
		}[] = [];
		for (const chapterId of chapterIds) {
			try {
				const result = await this.markChapterAsUnread(
					chapterId,
					userId,
				);
				results.push({ chapterId, success: true, result });
			} catch (error) {
				results.push({
					chapterId,
					success: false,
					error:
						error instanceof Error
							? error.message
							: 'Unknown error',
				});
			}
		}
		this.logger.log(
			`Marked ${results.filter((r) => r.success).length}/${chapterIds.length} chapters as unread for user ${userId}`,
		);
		return results;
	}

	async listLessPages(pages: number) {
		const chapters = await this.chapterRepository
			.createQueryBuilder('chapter')
			.leftJoinAndSelect('chapter.pages', 'page')
			.loadRelationCountAndMap('chapter.pageCount', 'chapter.pages')
			.getMany();

		return (chapters as Array<Chapter & { pageCount: number }>)
			.filter((chapter) => chapter.pageCount < pages)
			.map((chapter) => {
				const { pages, ...rest } = chapter;
				return { ...rest, pageCount: chapter.pageCount };
			});
	}

	async resetAllChapters(ids: string[]) {
		const chapters = await this.chapterRepository.find({
			where: { id: In(ids) },
			relations: ['book'],
		});
		for (const chapter of chapters) {
			chapter.scrapingStatus = ScrapingStatus.PROCESS;
		}
		await this.chapterRepository.save(chapters);
		this.eventEmitter.emit('chapters.updated', chapters);
		for (const chapter of chapters) {
			this.eventEmitter.emit(
				'chapter.updated',
				new ChapterUpdatedEvent(chapter.id, chapter.book.id),
			);
		}
		return chapters;
	}

	/**
	 * Busca dados de múltiplos capítulos de uma vez para facilitar o download offline.
	 * Inclui páginas, URLs completas e referências de navegação (anterior/próximo).
	 */
	async getChaptersBatch(ids: string[]) {
		if (!ids || ids.length === 0) return [];

		const chapters = await this.chapterRepository.find({
			where: { id: In(ids) },
			relations: ['pages', 'book'],
		});

		if (chapters.length === 0) return [];

		// Agrupa capítulos por livro para calcular anterior/próximo eficientemente
		const bookIds = [...new Set(chapters.map((c) => c.book.id))];

		const allChaptersOfBooks = await this.chapterRepository.find({
			where: { book: { id: In(bookIds) } },
			select: ['id', 'index', 'book'],
			relations: ['book'],
			order: { index: 'ASC' },
		});

		const chaptersByBook = new Map<string, Chapter[]>();
		for (const ch of allChaptersOfBooks) {
			const bId = ch.book.id;
			if (!chaptersByBook.has(bId)) {
				chaptersByBook.set(bId, []);
			}
			chaptersByBook.get(bId)?.push(ch);
		}

		return chapters.map((chapter) => {
			const bookChapters = chaptersByBook.get(chapter.book.id) || [];
			const currentIndex = bookChapters.findIndex(
				(c) => c.id === chapter.id,
			);

			const previousChapter =
				currentIndex > 0 ? bookChapters[currentIndex - 1] : null;
			const nextChapter =
				currentIndex !== -1 && currentIndex < bookChapters.length - 1
					? bookChapters[currentIndex + 1]
					: null;

			const { book, ...chapterWithoutBook } = chapter;

			const baseResponse = {
				...chapterWithoutBook,
				previous: previousChapter?.id,
				next: nextChapter?.id,
				bookId: book.id,
				bookTitle: book.title,
				totalChapters:
					bookChapters.length > 0
						? Number(bookChapters[bookChapters.length - 1].index)
						: 0,
				documentPath:
					chapter.contentType === ContentType.DOCUMENT &&
					chapter.documentPath
						? this.urlImage(chapter.documentPath)
						: undefined,
			};

			// Converte caminhos para URLs completas
			if (
				chapter.contentType === ContentType.IMAGE &&
				baseResponse.pages
			) {
				for (const page of baseResponse.pages) {
					page.path = this.urlImage(page.path);
				}
			}

			return baseResponse;
		});
	}
}
