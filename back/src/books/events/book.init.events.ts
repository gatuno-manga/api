import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from '../entities/book.entity';
import { ScrapingStatus } from '../enum/scrapingStatus.enum';

export class BookInitEvents {
	private logger = new Logger(BookInitEvents.name);

	constructor(
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findBooksWithChaptersInProcess(): Promise<Book[]> {
		const booksWithProcessChapter = await this.bookRepository
			.createQueryBuilder('book')
			.leftJoin('book.chapters', 'chapter')
			.where('chapter.scrapingStatus = :status', {
				status: ScrapingStatus.PROCESS,
			})
			.select('book.id')
			.getMany();

		const bookIds = booksWithProcessChapter.map((book) => book.id);

		if (bookIds.length === 0) return [];

		return this.bookRepository
			.createQueryBuilder('book')
			.leftJoinAndSelect('book.chapters', 'chapter')
			.where('book.id IN (:...bookIds)', { bookIds })
			.getMany();
	}
	// @OnEvent('app.ready')
	// async applicationInit() {
	//     this.logger.log('BookInitEvents module initialized');
	//     const books = await this.findBooksWithChaptersInProcess();
	//     if (books.length === 0) {
	//         return;
	//     }
	//     this.logger.log(`Livros com capítulos em PROCESS: ${books.length}`);
	//     for (const book of books) {
	//         this.eventEmitter.emit('chapters.updated', book.chapters);
	//     }
	// }
}
