import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export class BookInitEvents {
	constructor(
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
		readonly _eventEmitter: EventEmitter2,
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
