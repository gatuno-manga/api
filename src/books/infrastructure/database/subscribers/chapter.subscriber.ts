import { Book } from '@books/infrastructure/database/entities/book.entity';
import { Chapter } from '@books/infrastructure/database/entities/chapter.entity';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
	DataSource,
	EntitySubscriberInterface,
	EventSubscriber,
	InsertEvent,
	RemoveEvent,
	UpdateEvent,
} from 'typeorm';

@Injectable()
@EventSubscriber()
export class ChapterSubscriber implements EntitySubscriberInterface<Chapter> {
	constructor(@InjectDataSource() readonly dataSource: DataSource) {
		dataSource.subscribers.push(this);
	}

	listenTo() {
		return Chapter;
	}

	async afterInsert(event: InsertEvent<Chapter>) {
		if (event.entity?.book) {
			await this.updateBookChapterStats(
				event.entity.book.id ||
					(event.entity.book as unknown as { id: string }).id,
				event as unknown as InsertEvent<Chapter>,
			);
		}
	}

	async afterUpdate(event: UpdateEvent<Chapter>) {
		if (event.entity?.book) {
			await this.updateBookChapterStats(
				event.entity.book.id ||
					(event.entity.book as unknown as { id: string }).id,
				event as unknown as UpdateEvent<Chapter>,
			);
		}
	}

	async afterRemove(event: RemoveEvent<Chapter>) {
		if (event.entity?.book) {
			await this.updateBookChapterStats(
				event.entity.book.id ||
					(event.entity.book as unknown as { id: string }).id,
				event as unknown as RemoveEvent<Chapter>,
			);
		}
	}

	private async updateBookChapterStats(
		bookId: string | undefined,
		event:
			| InsertEvent<Chapter>
			| UpdateEvent<Chapter>
			| RemoveEvent<Chapter>,
	) {
		if (!bookId || typeof bookId !== 'string') return;

		const stats = await event.manager
			.createQueryBuilder(Chapter, 'chapter')
			.where('chapter.bookId = :bookId', { bookId })
			.select('chapter.languageCode', 'language')
			.addSelect('COUNT(chapter.id)', 'count')
			.groupBy('chapter.languageCode')
			.getRawMany();

		let totalChapters = 0;
		const chaptersPerLanguage = stats.map(
			(stat: { language: string; count: string | number }) => {
				const count = Number(stat.count) || 0;
				if (count > totalChapters) {
					totalChapters = count;
				}
				return { language: stat.language, count };
			},
		);

		await event.manager.update(Book, bookId, {
			totalChapters,
			chaptersPerLanguage,
		});
	}
}
