import { Injectable, Logger } from '@nestjs/common';
import { CursorPageDto } from 'src/pages/cursor-page.dto';
import { PageDto } from 'src/pages/page.dto';
import { BookRelationshipsQueryDto } from './dto/book-relationships-query.dto';
import { BookChaptersCursorPageDto } from './dto/book-chapters-cursor-page.dto';
import { BookChaptersCursorOptionsDto } from './dto/book-chapters-cursor-options.dto';
import { BookPageOptionsDto } from './dto/book-page-options.dto';
import { CreateBookRelationshipDto } from './dto/create-book-relationship.dto';
import { UpdateBookRelationshipDto } from './dto/update-book-relationship.dto';
import { Book } from './entities/book.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { OrderChaptersDto } from './dto/order-chapters.dto';
import { OrderCoversDto } from './dto/order-covers.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { BookCreationService } from './services/book-creation.service';
import { BookBookRelationshipService } from './services/book-book-relationship.service';
import { BookQueryService } from './services/book-query.service';
import { BookRelationshipService } from './services/book-relationship.service';
import { BookUpdateService } from './services/book-update.service';
import { ChapterManagementService } from './services/chapter-management.service';
import {
	AuthorsFilterStrategy,
	ExcludeTagsFilterStrategy,
	FilterStrategy,
	PublicationFilterStrategy,
	SearchFilterStrategy,
	TagsFilterStrategy,
	TypeFilterStrategy,
} from './strategies';

/**
 * BooksService refatorado - agora atua como orquestrador (Facade)
 * delegando responsabilidades para serviços especializados
 */
@Injectable()
export class BooksService {
	logger = new Logger(BooksService.name);
	readonly filterStrategies: FilterStrategy[];

	constructor(
		private readonly bookCreationService: BookCreationService,
		private readonly bookUpdateService: BookUpdateService,
		private readonly bookQueryService: BookQueryService,
		private readonly chapterManagementService: ChapterManagementService,
		private readonly bookRelationshipService: BookRelationshipService,
		private readonly bookBookRelationshipService: BookBookRelationshipService,
	) {
		this.filterStrategies = [
			new TypeFilterStrategy(),
			new SearchFilterStrategy(),
			new TagsFilterStrategy(),
			new ExcludeTagsFilterStrategy(),
			new PublicationFilterStrategy(),
			new AuthorsFilterStrategy(),
		];
	}

	// ==================== CRIAÇÃO ====================

	async createBook(dto: CreateBookDto) {
		return this.bookCreationService.createBook(dto);
	}

	async checkBookTitleConflict(
		title: string,
		alternativeTitles: string[] = [],
	) {
		return this.bookCreationService.checkBookTitleConflict(
			title,
			alternativeTitles,
		);
	}

	// ==================== ATUALIZAÇÃO ====================

	async updateBook(id: string, dto: UpdateBookDto) {
		return this.bookUpdateService.updateBook(id, dto);
	}

	async selectCover(idBook: string, idCover: string) {
		return this.bookUpdateService.selectCover(idBook, idCover);
	}

	async updateCover(
		idBook: string,
		idCover: string,
		dto: { title?: string },
	) {
		return this.bookUpdateService.updateCover(idBook, idCover, dto);
	}

	async orderCovers(idBook: string, covers: OrderCoversDto[]) {
		return this.bookUpdateService.orderCovers(idBook, covers);
	}

	async toggleAutoUpdate(idBook: string, enabled: boolean) {
		return this.bookUpdateService.toggleAutoUpdate(idBook, enabled);
	}

	// ==================== CONSULTA ====================

	async getAllBooks(
		options: BookPageOptionsDto,
		maxWeightSensitiveContent = 0,
		userId?: string,
	): Promise<
		| PageDto<Omit<Book, 'covers'> & { cover: string | null }>
		| CursorPageDto<Omit<Book, 'covers'> & { cover: string | null }>
	> {
		return this.bookQueryService.getAllBooks(
			options,
			maxWeightSensitiveContent,
			userId,
			this.filterStrategies,
		);
	}

	async getRandomBook(
		options: BookPageOptionsDto,
		maxWeightSensitiveContent = 0,
		userId?: string,
	): Promise<{ id: string }> {
		return this.bookQueryService.getRandomBook(
			options,
			maxWeightSensitiveContent,
			userId,
			this.filterStrategies,
		);
	}

	async getOne(id: string, maxWeightSensitiveContent = 0, userId?: string) {
		return this.bookQueryService.getOne(
			id,
			maxWeightSensitiveContent,
			userId,
		);
	}

	async getChapters(
		id: string,
		options: BookChaptersCursorOptionsDto,
		userid?: string,
		maxWeightSensitiveContent = 0,
	): Promise<BookChaptersCursorPageDto> {
		return this.bookQueryService.getChapters(
			id,
			options,
			userid,
			maxWeightSensitiveContent,
		);
	}

	async getCovers(
		id: string,
		maxWeightSensitiveContent = 0,
		userId?: string,
	) {
		return this.bookQueryService.getCovers(
			id,
			maxWeightSensitiveContent,
			userId,
		);
	}

	async getInfos(id: string, maxWeightSensitiveContent = 0, userId?: string) {
		return this.bookQueryService.getInfos(
			id,
			maxWeightSensitiveContent,
			userId,
		);
	}

	async verifyBook(idBook: string) {
		return this.bookQueryService.verifyBook(idBook);
	}

	async getDashboardOverview() {
		return this.bookQueryService.getDashboardOverview();
	}

	async getProcessBook() {
		return this.bookQueryService.getProcessBook();
	}

	async getQueueStats() {
		return this.bookQueryService.getQueueStats();
	}

	// ==================== GERENCIAMENTO DE CAPÍTULOS ====================

	async updateChapter(idBook: string, dto: UpdateChapterDto[]) {
		return this.chapterManagementService.updateChapters(idBook, dto);
	}

	async orderChapters(idBook: string, chapters: OrderChaptersDto[]) {
		return this.chapterManagementService.orderChapters(idBook, chapters);
	}

	async fixBook(idBook: string) {
		return this.chapterManagementService.fixBookChapters(idBook);
	}

	async resetBook(idBook: string) {
		return this.chapterManagementService.resetBookChapters(idBook);
	}

	// ==================== RELACIONAMENTOS ====================

	async createBookRelationship(
		idBook: string,
		dto: CreateBookRelationshipDto,
	) {
		return this.bookBookRelationshipService.createRelationship(idBook, dto);
	}

	async updateBookRelationship(
		idBook: string,
		idRelationship: string,
		dto: UpdateBookRelationshipDto,
	) {
		return this.bookBookRelationshipService.updateRelationship(
			idBook,
			idRelationship,
			dto,
		);
	}

	async deleteBookRelationship(idBook: string, idRelationship: string) {
		return this.bookBookRelationshipService.deleteRelationship(
			idBook,
			idRelationship,
		);
	}

	async getBookRelationships(
		idBook: string,
		query: BookRelationshipsQueryDto,
		maxWeightSensitiveContent = 0,
		userId?: string,
	) {
		return this.bookBookRelationshipService.listRelationships(
			idBook,
			query,
			maxWeightSensitiveContent,
			userId,
		);
	}

	async findOrCreateSensitiveContent(sensitiveContentNames: string[]) {
		return this.bookRelationshipService.findOrCreateSensitiveContent(
			sensitiveContentNames,
		);
	}
}
