import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AppConfigService } from 'src/app-config/app-config.service';
import { Book } from 'src/books/entities/book.entity';
import { Chapter } from 'src/books/entities/chapter.entity';
import { Page } from 'src/books/entities/page.entity';
import { Repository } from 'typeorm';
import { CreateSavedPageDto } from './dto/create-saved-page.dto';
import { UpdateSavedPageDto } from './dto/update-saved-page.dto';
import { SavedPage } from './entities/saved-page.entity';

@Injectable()
export class SavedPagesService {
	constructor(
		@InjectRepository(SavedPage)
		private readonly savedPageRepository: Repository<SavedPage>,
		@InjectRepository(Page)
		private readonly pageRepository: Repository<Page>,
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
		private readonly appConfig: AppConfigService,
	) {}

	private urlImage(url: string): string {
		if (
			!url ||
			url.startsWith('null') ||
			url.startsWith('undefined') ||
			url.startsWith('http')
		)
			return url || '';
		const appUrl = this.appConfig.apiUrl;
		return `${appUrl}${url}`;
	}

	/**
	 * Salva uma página para o usuário
	 */
	async savePage(
		dto: CreateSavedPageDto,
		userId: string,
	): Promise<SavedPage> {
		// Verifica se a página existe e pertence ao capítulo/livro informado
		const page = await this.pageRepository.findOne({
			where: { id: dto.pageId },
			relations: ['chapter', 'chapter.book'],
		});

		if (!page) {
			throw new NotFoundException('Page not found');
		}

		if (page.chapter.id !== dto.chapterId) {
			throw new BadRequestException(
				'Page does not belong to the specified chapter',
			);
		}

		if (page.chapter.book.id !== dto.bookId) {
			throw new BadRequestException(
				'Chapter does not belong to the specified book',
			);
		}

		// Verifica se já está salvo
		const existing = await this.savedPageRepository.findOne({
			where: {
				user: { id: userId },
				page: { id: dto.pageId },
			},
		});

		if (existing) {
			throw new BadRequestException('Page is already saved');
		}

		const savedPage = this.savedPageRepository.create({
			user: { id: userId },
			page: { id: dto.pageId },
			chapter: { id: dto.chapterId },
			book: { id: dto.bookId },
			comment: dto.comment || null,
		});

		return this.savedPageRepository.save(savedPage);
	}

	/**
	 * Lista todas as páginas salvas do usuário
	 */
	async getSavedPages(userId: string): Promise<SavedPage[]> {
		const savedPages = await this.savedPageRepository.find({
			where: { user: { id: userId } },
			relations: ['page', 'chapter', 'book'],
			order: { createdAt: 'DESC' },
		});

		return savedPages.map((savedPage) => {
			if (savedPage.page) {
				savedPage.page.path = this.urlImage(savedPage.page.path);
			}
			return savedPage;
		});
	}

	/**
	 * Lista páginas salvas por livro
	 */
	async getSavedPagesByBook(
		userId: string,
		bookId: string,
	): Promise<SavedPage[]> {
		const savedPages = await this.savedPageRepository.find({
			where: {
				user: { id: userId },
				book: { id: bookId },
			},
			relations: ['page', 'chapter'],
			order: { chapter: { index: 'ASC' }, page: { index: 'ASC' } },
		});

		return savedPages.map((savedPage) => {
			if (savedPage.page) {
				savedPage.page.path = this.urlImage(savedPage.page.path);
			}
			return savedPage;
		});
	}

	/**
	 * Lista páginas salvas por capítulo
	 */
	async getSavedPagesByChapter(
		userId: string,
		chapterId: string,
	): Promise<SavedPage[]> {
		const savedPages = await this.savedPageRepository.find({
			where: {
				user: { id: userId },
				chapter: { id: chapterId },
			},
			relations: ['page'],
			order: { page: { index: 'ASC' } },
		});

		return savedPages.map((savedPage) => {
			if (savedPage.page) {
				savedPage.page.path = this.urlImage(savedPage.page.path);
			}
			return savedPage;
		});
	}

	/**
	 * Busca uma página salva específica
	 */
	async getSavedPage(id: string, userId: string): Promise<SavedPage> {
		const savedPage = await this.savedPageRepository.findOne({
			where: { id, user: { id: userId } },
			relations: ['page', 'chapter', 'book'],
		});

		if (!savedPage) {
			throw new NotFoundException('Saved page not found');
		}

		if (savedPage.page) {
			savedPage.page.path = this.urlImage(savedPage.page.path);
		}

		return savedPage;
	}

	/**
	 * Verifica se uma página está salva
	 */
	async isPageSaved(pageId: number, userId: string): Promise<boolean> {
		const count = await this.savedPageRepository.count({
			where: {
				user: { id: userId },
				page: { id: pageId },
			},
		});
		return count > 0;
	}

	/**
	 * Atualiza o comentário de uma página salva
	 */
	async updateComment(
		id: string,
		dto: UpdateSavedPageDto,
		userId: string,
	): Promise<SavedPage> {
		const savedPage = await this.getSavedPage(id, userId);

		savedPage.comment = dto.comment ?? null;

		return this.savedPageRepository.save(savedPage);
	}

	/**
	 * Remove uma página salva
	 */
	async unsavePage(id: string, userId: string): Promise<void> {
		const savedPage = await this.getSavedPage(id, userId);
		await this.savedPageRepository.remove(savedPage);
	}

	/**
	 * Remove página salva por pageId (alternativo)
	 */
	async unsavePageByPageId(pageId: number, userId: string): Promise<void> {
		const savedPage = await this.savedPageRepository.findOne({
			where: {
				user: { id: userId },
				page: { id: pageId },
			},
		});

		if (!savedPage) {
			throw new NotFoundException('Saved page not found');
		}

		await this.savedPageRepository.remove(savedPage);
	}

	/**
	 * Conta páginas salvas por livro
	 */
	async countSavedPagesByBook(
		userId: string,
		bookId: string,
	): Promise<number> {
		return this.savedPageRepository.count({
			where: {
				user: { id: userId },
				book: { id: bookId },
			},
		});
	}
}
