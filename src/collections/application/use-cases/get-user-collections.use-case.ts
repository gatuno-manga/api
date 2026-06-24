import { CollectionRepository } from '@/collections/application/ports/collection-repository.port';
import { Collection } from '@/collections/domain/entities/collection';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Inject, Injectable } from '@nestjs/common';
import { CursorPageDto } from 'src/common/pagination/cursor-page.dto';
import {
	decodeCursorPayload,
	encodeCursorPayload,
} from 'src/common/pagination/cursor.utils';
import { PageDto } from 'src/common/pagination/page.dto';

type CollectionsCursorPayload = {
	createdAt: string;
	id: string;
};

@Injectable()
export class GetUserCollectionsUseCase {
	constructor(
		@Inject('CollectionRepository')
		private readonly collectionRepository: CollectionRepository,
	) {}

	async execute(
		userId: string,
		limit = 20,
		cursor?: string,
		page?: number,
	): Promise<CursorPageDto<Collection> | PageDto<Collection>> {
		const user = UserId.create(userId);

		if (page) {
			const skip = (page - 1) * limit;
			const [data, total] =
				await this.collectionRepository.findByOwnerWithOffset(
					user,
					skip,
					limit,
				);

			const lastPage = Math.ceil(total / limit);

			return new PageDto(data, {
				total,
				page,
				lastPage,
			});
		}

		const parsedCursor = this.parseCursor(cursor);

		const collections =
			await this.collectionRepository.findPaginatedByOwner(
				user,
				limit,
				parsedCursor?.createdAt,
				parsedCursor?.id,
			);

		const hasNextPage = collections.length > limit;
		const data = hasNextPage ? collections.slice(0, limit) : collections;
		const lastItem = data[data.length - 1];

		const nextCursor =
			hasNextPage && lastItem
				? encodeCursorPayload({
						createdAt: lastItem
							.toSnapshot()
							.createdAt.toISOString(),
						id: lastItem.toSnapshot().id,
					})
				: null;

		return new CursorPageDto(data, nextCursor, hasNextPage);
	}

	private parseCursor(
		cursor?: string,
	): { createdAt?: Date; id?: string } | undefined {
		if (!cursor) {
			return undefined;
		}

		const decoded = decodeCursorPayload<CollectionsCursorPayload>(cursor);
		if (
			!decoded ||
			typeof decoded.createdAt !== 'string' ||
			typeof decoded.id !== 'string'
		) {
			return undefined;
		}

		const parsedDate = new Date(decoded.createdAt);
		if (Number.isNaN(parsedDate.getTime())) {
			return undefined;
		}

		return {
			createdAt: parsedDate,
			id: decoded.id,
		};
	}
}
