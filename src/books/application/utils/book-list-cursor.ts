import { BookPageOptionsDto } from '@books/application/dto/book-page-options.dto';
import { BookOrderField } from '@books/domain/enums/book-order-field.enum';
import { InvalidBookListCursorException } from '@books/domain/exceptions/invalid-book-list-cursor.exception';
import { BookListPosition } from '@books/domain/types/criteria.types';
import { OrderDirection } from 'src/common/enum/order-direction.enum';
import {
	decodeCursorPayload,
	encodeCursorPayload,
} from 'src/common/pagination/cursor.utils';

export type BookListSort = {
	orderBy: BookOrderField;
	order: OrderDirection;
};

/** Where the next book list page starts. */
export type BookListCursorTarget =
	| { kind: 'start' }
	| { kind: 'search'; offset: number }
	| { kind: 'keyset'; position: BookListPosition };

type SearchCursorPayload = { mode: 'search'; offset: unknown };

type KeysetCursorPayload = {
	mode: 'keyset';
	orderBy: unknown;
	order: unknown;
	value: unknown;
	createdAt: unknown;
	id: unknown;
};

const DATABASE_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveBookListSort(
	options: Pick<BookPageOptionsDto, 'orderBy' | 'order'>,
): BookListSort {
	return {
		orderBy: options.orderBy || BookOrderField.CREATED_AT,
		order: options.order || OrderDirection.DESC,
	};
}

export function encodeSearchCursor(offset: number): string {
	return encodeCursorPayload({ mode: 'search', offset });
}

export function encodeKeysetCursor(
	sort: BookListSort,
	position: BookListPosition,
): string {
	return encodeCursorPayload({
		mode: 'keyset',
		orderBy: sort.orderBy,
		order: sort.order,
		value: position.sortValue,
		createdAt: position.createdAt,
		id: position.id,
	});
}

/**
 * Reads a `nextCursor` back. A keyset cursor on a search request is accepted:
 * it continues a walk the MySQL fallback started when the search engine failed.
 *
 * @throws InvalidBookListCursorException when the cursor cannot continue the request
 */
export function decodeBookListCursor(
	cursor: string | undefined,
	sort: BookListSort,
	isSearch: boolean,
): BookListCursorTarget {
	if (!cursor) return { kind: 'start' };

	const payload = decodeCursorPayload<{ mode?: unknown }>(cursor);
	if (payload?.mode === 'search') {
		return decodeSearchCursor(payload as SearchCursorPayload, isSearch);
	}
	if (payload?.mode === 'keyset') {
		return decodeKeysetCursor(payload as KeysetCursorPayload, sort);
	}
	throw new InvalidBookListCursorException('malformed cursor');
}

function decodeSearchCursor(
	payload: SearchCursorPayload,
	isSearch: boolean,
): BookListCursorTarget {
	if (!isSearch) {
		throw new InvalidBookListCursorException(
			'a search cursor needs the search it was issued for',
		);
	}
	const offset = payload.offset;
	if (!Number.isInteger(offset) || (offset as number) < 0) {
		throw new InvalidBookListCursorException('malformed search offset');
	}
	return { kind: 'search', offset: offset as number };
}

function decodeKeysetCursor(
	payload: KeysetCursorPayload,
	sort: BookListSort,
): BookListCursorTarget {
	if (payload.orderBy !== sort.orderBy || payload.order !== sort.order) {
		throw new InvalidBookListCursorException(
			'the cursor was issued for another orderBy or order',
		);
	}
	if (!isDatabaseTimestamp(payload.createdAt)) {
		throw new InvalidBookListCursorException('malformed createdAt');
	}
	if (typeof payload.id !== 'string' || !UUID.test(payload.id)) {
		throw new InvalidBookListCursorException('malformed id');
	}
	if (!isSortValueOf(sort.orderBy, payload.value)) {
		throw new InvalidBookListCursorException(
			`malformed value for ${sort.orderBy}`,
		);
	}
	return {
		kind: 'keyset',
		position: {
			sortValue: payload.value,
			createdAt: payload.createdAt,
			id: payload.id,
		},
	};
}

function isDatabaseTimestamp(value: unknown): value is string {
	return typeof value === 'string' && DATABASE_TIMESTAMP.test(value);
}

function isSortValueOf(
	orderBy: BookOrderField,
	value: unknown,
): value is string | number | null {
	if (orderBy === BookOrderField.TITLE) return typeof value === 'string';
	if (orderBy === BookOrderField.PUBLICATION) {
		return value === null || Number.isInteger(value);
	}
	return isDatabaseTimestamp(value);
}
