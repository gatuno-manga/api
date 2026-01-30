import { Injectable, Logger } from '@nestjs/common';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { BookPageOptionsDto } from './dto/book-page-options.dto';
import { PageDto } from 'src/pages/page.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { OrderChaptersDto } from './dto/order-chapters.dto';
import { OrderCoversDto } from './dto/order-covers.dto';
import {
	FilterStrategy,
	TypeFilterStrategy,
	SearchFilterStrategy,
	TagsFilterStrategy,
	ExcludeTagsFilterStrategy,
	PublicationFilterStrategy,
	AuthorsFilterStrategy,
} from './strategies';
import { BookCreationService } from './services/book-creation.service';
import { BookUpdateService } from './services/book-update.service';
import { BookQueryService } from './services/book-query.service';
import { ChapterManagementService } from './services/chapter-management.service';
import { BookRelationshipService } from './services/book-relationship.service';

/**
 * BooksService refatorado - agora atua como orquestrador (Facade)
 * delegando responsabilidades para serviços especializados
 */
@Injectable()
export class BooksService {
	logger = new Logger(BooksService.name);
	private readonly filterStrategies: FilterStrategy[];

	constructor(
		private readonly bookCreationService: BookCreationService,
		private readonly bookUpdateService: BookUpdateService,
		private readonly bookQueryService: BookQueryService,
		private readonly chapterManagementService: ChapterManagementService,
		private readonly bookRelationshipService: BookRelationshipService,
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
		maxWeightSensitiveContent: number = 0,
	): Promise<PageDto<any>> {
		return this.bookQueryService.getAllBooks(
			options,
			maxWeightSensitiveContent,
			this.filterStrategies,
		);
	}

	async getRandomBook(
		options: BookPageOptionsDto,
		maxWeightSensitiveContent: number = 0,
	): Promise<{ id: string }> {
		return this.bookQueryService.getRandomBook(
			options,
			maxWeightSensitiveContent,
			this.filterStrategies,
		);
	}

	async getOne(id: string, maxWeightSensitiveContent: number = 0) {
		return this.bookQueryService.getOne(id, maxWeightSensitiveContent);
	}

	async getChapters(
		id: string,
		userid?: string,
		maxWeightSensitiveContent: number = 0,
	) {
		return this.bookQueryService.getChapters(
			id,
			userid,
			maxWeightSensitiveContent,
		);
	}

	async getCovers(id: string, maxWeightSensitiveContent: number = 0) {
		return this.bookQueryService.getCovers(id, maxWeightSensitiveContent);
	}

	async getInfos(id: string, maxWeightSensitiveContent: number = 0) {
		return this.bookQueryService.getInfos(id, maxWeightSensitiveContent);
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

	async findOrCreateSensitiveContent(sensitiveContentNames: string[]) {
		return this.bookRelationshipService.findOrCreateSensitiveContent(
			sensitiveContentNames,
		);
	}
}
