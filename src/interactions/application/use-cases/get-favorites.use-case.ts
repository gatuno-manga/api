import { FavoriteRepository } from '@/interactions/application/ports/favorite-repository.port';
import { Favorite } from '@/interactions/domain/entities/favorite';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Inject, Injectable } from '@nestjs/common';
import { CursorPageDto } from 'src/common/pagination/cursor-page.dto';
import {
	decodeCursorPayload,
	encodeCursorPayload,
} from 'src/common/pagination/cursor.utils';

type FavoritesCursorPayload = {
	createdAt: string;
	bookId: string;
};

@Injectable()
export class GetFavoritesUseCase {
	constructor(
		@Inject('FavoriteRepository')
		private readonly favoriteRepository: FavoriteRepository,
	) {}

	async execute(
		userId: UserId,
		limit: number,
		cursor?: string,
	): Promise<CursorPageDto<Favorite>> {
		let cursorCreatedAt: Date | undefined;
		let cursorBookId: string | undefined;

		if (cursor) {
			const decoded = decodeCursorPayload<FavoritesCursorPayload>(cursor);
			if (
				decoded &&
				typeof decoded.createdAt === 'string' &&
				typeof decoded.bookId === 'string'
			) {
				const parsedDate = new Date(decoded.createdAt);
				if (!Number.isNaN(parsedDate.getTime())) {
					cursorCreatedAt = parsedDate;
					cursorBookId = decoded.bookId;
				}
			}
		}

		const favorites = await this.favoriteRepository.findPaginatedByUser(
			userId,
			limit,
			cursorCreatedAt,
			cursorBookId,
		);

		const hasNextPage = favorites.length > limit;
		const data = hasNextPage ? favorites.slice(0, limit) : favorites;
		const lastItem = data[data.length - 1];

		const nextCursor =
			hasNextPage && lastItem
				? encodeCursorPayload({
						createdAt: lastItem
							.toSnapshot()
							.createdAt.toISOString(),
						bookId: lastItem.toSnapshot().bookId,
					})
				: null;

		return new CursorPageDto(data, nextCursor, hasNextPage);
	}
}
