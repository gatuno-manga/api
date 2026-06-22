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
		const parsedCursor = this.parseCursor(cursor);

		const favorites = await this.favoriteRepository.findPaginatedByUser(
			userId,
			limit,
			parsedCursor?.createdAt,
			parsedCursor?.bookId,
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

	private parseCursor(
		cursor?: string,
	): { createdAt?: Date; bookId?: string } | undefined {
		if (!cursor) {
			return undefined;
		}

		const decoded = decodeCursorPayload<FavoritesCursorPayload>(cursor);
		if (
			!decoded ||
			typeof decoded.createdAt !== 'string' ||
			typeof decoded.bookId !== 'string'
		) {
			return undefined;
		}

		const parsedDate = new Date(decoded.createdAt);
		if (Number.isNaN(parsedDate.getTime())) {
			return undefined;
		}

		return {
			createdAt: parsedDate,
			bookId: decoded.bookId,
		};
	}
}
