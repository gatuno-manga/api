import { extname } from 'node:path';
import { OrderCoversDto } from '@books/application/dto/order-covers.dto';
import { ScrapeCoverDto } from '@books/application/dto/scrape-cover.dto';
import { UpdateBookDto } from '@books/application/dto/update-book.dto';
import { UpdateCoverDto } from '@books/application/dto/update-cover.dto';
import { UploadCoverDto } from '@books/application/dto/upload-cover.dto';
import {
	IBookRepository,
	I_BOOK_REPOSITORY,
} from '@books/application/ports/book-repository.interface';
import {
	ICoverRepository,
	I_COVER_REPOSITORY,
} from '@books/application/ports/cover-repository.interface';
import { AlternativeTitle } from '@books/domain/entities/alternative-title';
import { Book } from '@books/domain/entities/book';
import { BookDescription } from '@books/domain/entities/book-description';
import { Cover } from '@books/domain/entities/cover';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { CoverImageService } from '@books/infrastructure/jobs/cover-image.service';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import { FilesService } from '@files/application/services/files.service';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
	IUnitOfWork,
	I_UNIT_OF_WORK,
} from 'src/common/application/ports/unit-of-work.interface';
import { BookRelationshipService } from './book-relationship.service';

/**
 * Service responsável pela atualização de livros
 */
@Injectable()
export class BookUpdateService {
	private readonly logger = new Logger(BookUpdateService.name);

	constructor(
		@Inject(I_BOOK_REPOSITORY)
		private readonly bookRepository: IBookRepository,
		@Inject(I_COVER_REPOSITORY)
		private readonly coverRepository: ICoverRepository,
		@Inject(I_UNIT_OF_WORK)
		private readonly unitOfWork: IUnitOfWork,
		private readonly bookRelationshipService: BookRelationshipService,
		private readonly coverImageService: CoverImageService,
		private readonly filesService: FilesService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Atualiza um livro existente
	 */
	async updateBook(id: string, dto: UpdateBookDto): Promise<Book> {
		const exists = await this.bookRepository.exists(id);

		if (!exists) {
			this.logger.warn(`Book with id ${id} not found`);
			throw new NotFoundException(`Book with id ${id} not found`);
		}

		const scalarUpdates: Partial<Book> = {};
		if (dto.title !== undefined) scalarUpdates.title = dto.title;
		if (dto.searchTerms !== undefined)
			scalarUpdates.searchTerms = dto.searchTerms;
		if (dto.originalUrl !== undefined)
			scalarUpdates.originalUrl = dto.originalUrl;
		if (dto.description !== undefined)
			scalarUpdates.description = dto.description;
		if (dto.publication !== undefined)
			scalarUpdates.publication = dto.publication;
		if (dto.type !== undefined) scalarUpdates.type = dto.type;
		if (dto.originalLanguageCode !== undefined)
			scalarUpdates.originalLanguageCode = dto.originalLanguageCode;

		if (Object.keys(scalarUpdates).length > 0) {
			await this.bookRepository.update(id, scalarUpdates);
		}

		// 1. Consolidate alternative titles from all possible fields
		if (
			dto.alternativeTitles !== undefined ||
			dto.alternativeTitle !== undefined
		) {
			const consolidatedAltTitles: AlternativeTitle[] = [];

			// Process new field 'alternativeTitles'
			if (dto.alternativeTitles?.length) {
				for (const alt of dto.alternativeTitles) {
					const isString = typeof alt === 'string';
					const title = isString ? (alt as string) : alt.title;
					const languageCode = isString ? null : alt.languageCode;
					const rank = isString ? 0 : (alt.rank ?? 0);

					if (title) {
						consolidatedAltTitles.push(
							new AlternativeTitle(
								title,
								languageCode || null,
								rank,
							),
						);
					}
				}
			}

			// Process legacy field 'alternativeTitle'
			if (dto.alternativeTitle?.length) {
				for (const title of dto.alternativeTitle) {
					if (
						title &&
						!consolidatedAltTitles.some((t) => t.title === title)
					) {
						consolidatedAltTitles.push(
							new AlternativeTitle(title, null, 0),
						);
					}
				}
			}

			const bookForAlt = await this.findBookWith(id, [
				'alternativeTitles',
			]);
			bookForAlt.alternativeTitles = consolidatedAltTitles;
			await this.bookRepository.save(bookForAlt);
		}

		// 2. Consolidate localized descriptions
		if (
			dto.localizedDescriptions !== undefined ||
			dto.description !== undefined
		) {
			const consolidatedDescriptions: BookDescription[] = [];

			if (dto.localizedDescriptions?.length) {
				for (const item of dto.localizedDescriptions) {
					consolidatedDescriptions.push(
						new BookDescription(
							item.description,
							item.languageCode,
							item.rank ?? 0,
						),
					);
				}
			}

			if (dto.description) {
				const bookForLang = await this.bookRepository.findById(id);
				const lang =
					dto.originalLanguageCode ||
					bookForLang?.originalLanguageCode ||
					'pt-BR';
				if (
					!consolidatedDescriptions.some(
						(d) =>
							d.languageCode === lang &&
							d.description === dto.description,
					)
				) {
					consolidatedDescriptions.push(
						new BookDescription(dto.description, lang, 0),
					);
				}
			}

			const bookForDesc = await this.findBookWith(id, [
				'localizedDescriptions',
			]);
			bookForDesc.localizedDescriptions = consolidatedDescriptions;
			await this.bookRepository.save(bookForDesc);
		}

		if (dto.tags !== undefined) {
			const newTags =
				dto.tags.length > 0
					? await this.bookRelationshipService.findOrCreateTags(
							dto.tags,
						)
					: [];
			const bookForTags = await this.findBookWith(id, ['tags']);
			bookForTags.tags = newTags;
			await this.bookRepository.save(bookForTags);
		}

		if (dto.authors !== undefined) {
			const newAuthors =
				dto.authors.length > 0
					? await this.bookRelationshipService.findOrCreateAuthors(
							dto.authors,
						)
					: [];
			const bookForAuthors = await this.findBookWith(id, ['authors']);
			bookForAuthors.authors = newAuthors;
			await this.bookRepository.save(bookForAuthors);
		}

		if (dto.sensitiveContent !== undefined) {
			const newContent =
				dto.sensitiveContent.length > 0
					? await this.bookRelationshipService.findOrCreateSensitiveContent(
							dto.sensitiveContent,
						)
					: [];
			const bookForContent = await this.findBookWith(id, [
				'sensitiveContent',
			]);
			bookForContent.sensitiveContent = newContent;
			await this.bookRepository.save(bookForContent);
		}

		if (dto.cover?.urlImgs && dto.cover.urlImgs.length > 0) {
			await this.coverImageService.addCoverToQueue(
				id,
				dto.cover.urlOrigin,
				dto.cover.urlImgs,
			);
		}

		const updatedBook = await this.findBookWith(id, [
			'tags',
			'sensitiveContent',
			'authors',
		]);

		this.eventEmitter.emit('book.updated', updatedBook);

		return updatedBook;
	}

	/**
	 * Busca um livro com as relações especificadas ou lança NotFoundException
	 */
	private async findBookWith(id: string, relations: string[]): Promise<Book> {
		const book = await this.bookRepository.findById(id, relations);
		if (!book) {
			throw new NotFoundException(`Book with id ${id} not found`);
		}
		return book;
	}

	/**
	 * Seleciona uma capa específica para um livro
	 */
	async selectCover(idBook: string, idCover: string): Promise<void> {
		const book = await this.bookRepository.findById(idBook, ['covers']);

		if (!book) {
			this.logger.warn(`Book with id ${idBook} not found`);
			throw new NotFoundException(`Book with id ${idBook} not found`);
		}

		book.covers = book.covers.map((cover) => {
			cover.selected = cover.id === idCover;
			return cover;
		});

		await this.bookRepository.save(book);

		// Emite evento de seleção de capa
		this.eventEmitter.emit('cover.selected', {
			bookId: idBook,
			coverId: idCover,
		});
	}

	/**
	 * Atualiza os dados de uma capa específica
	 */
	async updateCover(
		idBook: string,
		idCover: string,
		dto: UpdateCoverDto,
	): Promise<Cover> {
		const cover = await this.coverRepository.findById(idCover);

		if (!cover) {
			this.logger.warn(
				`Cover with id ${idCover} not found for book ${idBook}`,
			);
			throw new NotFoundException(
				`Cover with id ${idCover} not found for book ${idBook}`,
			);
		}

		if (dto.title !== undefined) {
			cover.title = dto.title;
		}

		const updatedCover = await this.coverRepository.save(cover);

		// Emite evento de atualização de capa
		this.eventEmitter.emit('cover.updated', {
			bookId: idBook,
			coverId: idCover,
		});

		return updatedCover;
	}

	/**
	 * Reordena as capas de um livro
	 */
	async orderCovers(
		idBook: string,
		coversDto: OrderCoversDto[],
	): Promise<void> {
		const book = await this.bookRepository.findById(idBook, ['covers']);

		if (!book) {
			this.logger.warn(`Book with id ${idBook} not found`);
			throw new NotFoundException(`Book with id ${idBook} not found`);
		}

		const coverMap = new Map<string, Cover>();
		for (const cover of book.covers) {
			coverMap.set(cover.id, cover);
		}

		// Verificar se todas as capas enviadas pertencem ao livro
		for (const dto of coversDto) {
			if (!coverMap.has(dto.id)) {
				throw new NotFoundException(
					`Cover with id ${dto.id} not found in book ${idBook}`,
				);
			}
		}

		await this.unitOfWork.runInTransaction(async (uow) => {
			const transactionCoverRepo = uow.getCoverRepository();

			// 1. Usar índices temporários negativos para evitar conflitos de UNIQUE constraint (se existirem ou forem adicionados)
			let tempIndex = -100_000;
			for (const cover of book.covers) {
				cover.index = tempIndex++;
			}
			await transactionCoverRepo.saveAll(book.covers);

			// 2. Aplicar os novos índices finais
			for (const dto of coversDto) {
				const cover = coverMap.get(dto.id);
				if (cover) {
					cover.index = dto.index;
				}
			}

			// 3. Salvar todos os estados finais
			await transactionCoverRepo.saveAll(Array.from(coverMap.values()));
		});

		this.eventEmitter.emit('covers.reordered', {
			bookId: idBook,
			covers: coversDto,
		});
	}

	/**
	 * Habilita ou desabilita atualizações automáticas para um livro
	 */
	async toggleAutoUpdate(idBook: string, enabled: boolean) {
		const book = await this.bookRepository.findById(idBook);

		if (!book) {
			throw new NotFoundException('Book not found');
		}

		book.autoUpdate = enabled;
		await this.bookRepository.save(book);

		this.logger.log(
			`Auto-update ${enabled ? 'enabled' : 'disabled'} for book: ${book.title}`,
		);

		return {
			id: book.id,
			title: book.title,
			autoUpdate: book.autoUpdate,
		};
	}

	/**
	 * Upload manual de uma capa
	 */
	async manualUploadCover(
		idBook: string,
		file: Express.Multer.File,
		dto: UploadCoverDto,
	): Promise<Cover> {
		const book = await this.findBookWith(idBook, ['covers']);

		const extension = extname(file.originalname);
		const savedPath = await this.filesService.saveBufferFile(
			file.buffer,
			extension,
			StorageBucket.BOOKS,
		);

		const cover = this.coverRepository.create({
			title: dto.title || 'Manual Upload Cover',
			url: savedPath,
			book: book,
			index: book.covers.length,
			selected: book.covers.length === 0,
		});

		const savedCover = await this.coverRepository.save(cover);

		this.eventEmitter.emit('cover.uploaded.manual', {
			bookId: idBook,
			coverId: savedCover.id,
			url: savedPath,
		});

		return savedCover;
	}

	/**
	 * Dispara o scraping de uma capa específica por URL
	 */
	async scrapeCover(idBook: string, dto: ScrapeCoverDto): Promise<void> {
		const book = await this.findBookWith(idBook, ['covers']);

		// Verificar se a capa já existe pela URL original
		const existingCover = book.covers.find(
			(c) => c.originalUrl === dto.url,
		);
		if (existingCover) {
			existingCover.retries = 0;
			existingCover.scrapingStatus = ScrapingStatus.PROCESS;
			await this.coverRepository.save(existingCover);
		}

		await this.coverImageService.addCoverToQueue(
			idBook,
			book.originalUrl?.[0] || '',
			[{ url: dto.url, title: 'Scraped Cover' }],
		);

		this.logger.log(
			`Scrape de capa enfileirado para o livro: ${book.title} (URL: ${dto.url})`,
		);
	}

	/**
	 * Conserta as capas de um livro re-enfileirando-as para processamento
	 */
	async fixBookCovers(idBook: string): Promise<void> {
		const book = await this.bookRepository.findById(idBook, ['covers']);

		if (!book) {
			this.logger.warn(`Book with id ${idBook} not found`);
			throw new NotFoundException(`Book with id ${idBook} not found`);
		}

		if (!book.covers || book.covers.length === 0) {
			this.logger.debug(`Book ${book.title} has no covers to fix`);
			return;
		}

		const coversToFix = book.covers.filter((c) => c.originalUrl);

		if (coversToFix.length > 0) {
			this.logger.log(
				`Enfileirando ${coversToFix.length} capas para correção no livro: ${book.title}`,
			);

			// Reset retries and status for manual fix
			for (const cover of coversToFix) {
				cover.retries = 0;
				cover.scrapingStatus = ScrapingStatus.PROCESS;
			}
			await this.coverRepository.saveAll(coversToFix);

			await this.coverImageService.addCoverToQueue(
				idBook,
				book.originalUrl?.[0] || '',
				coversToFix.map((c) => ({
					url: c.originalUrl || '',
					title: c.title,
				})),
			);
		}
	}

	/**
	 * Conserta uma capa específica re-enfileirando-a para processamento
	 */
	async fixCover(idBook: string, idCover: string): Promise<void> {
		const book = await this.bookRepository.findById(idBook, ['covers']);

		if (!book) {
			this.logger.warn(`Book with id ${idBook} not found`);
			throw new NotFoundException(`Book with id ${idBook} not found`);
		}

		const cover = book.covers.find((c) => c.id === idCover);

		if (!cover) {
			this.logger.warn(
				`Cover with id ${idCover} not found for book ${idBook}`,
			);
			throw new NotFoundException(
				`Cover with id ${idCover} not found for book ${idBook}`,
			);
		}

		if (!cover.originalUrl) {
			this.logger.warn(
				`Cover ${idCover} for book ${idBook} has no original URL to fix`,
			);
			throw new Error('Cover has no original URL to fix');
		}

		this.logger.log(
			`Enfileirando capa ${idCover} para correção no livro: ${book.title}`,
		);

		// Reset retries and status for manual fix
		cover.retries = 0;
		cover.scrapingStatus = ScrapingStatus.PROCESS;
		await this.coverRepository.save(cover);

		await this.coverImageService.addCoverToQueue(
			idBook,
			book.originalUrl?.[0] || '',
			[{ url: cover.originalUrl, title: cover.title }],
		);
	}
}
