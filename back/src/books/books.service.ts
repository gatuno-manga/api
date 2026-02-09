import { Injectable, Logger } from '@nestjs/common';
import { PageDto } from 'src/pages/page.dto';
import { BookPageOptionsDto } from './dto/book-page-options.dto';
import { Book } from './entities/book.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { OrderChaptersDto } from './dto/order-chapters.dto';
import { OrderCoversDto } from './dto/order-covers.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { BookCreationService } from './services/book-creation.service';
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
		maxWeightSensitiveContent = 0,
	): Promise<PageDto<Omit<Book, 'covers'> & { cover: string | null }>> {
		return this.bookQueryService.getAllBooks(
			options,
			maxWeightSensitiveContent,
			this.filterStrategies,
		);
	}

	async getRandomBook(
		options: BookPageOptionsDto,
		maxWeightSensitiveContent = 0,
	): Promise<{ id: string }> {
		return this.bookQueryService.getRandomBook(
			options,
			maxWeightSensitiveContent,
			this.filterStrategies,
		);
	}

	async getOne(id: string, maxWeightSensitiveContent = 0) {
		return this.bookQueryService.getOne(id, maxWeightSensitiveContent);
	}

	async getChapters(
		id: string,
		userid?: string,
		maxWeightSensitiveContent = 0,
	) {
		return this.bookQueryService.getChapters(
			id,
			userid,
			maxWeightSensitiveContent,
		);
	}

	async getCovers(id: string, maxWeightSensitiveContent = 0) {
		return this.bookQueryService.getCovers(id, maxWeightSensitiveContent);
	}

	async getInfos(id: string, maxWeightSensitiveContent = 0) {
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
