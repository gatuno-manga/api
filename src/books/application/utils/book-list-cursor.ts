import { BookPageOptionsDto } from '@books/application/dto/book-page-options.dto';
import { BookOrderField } from '@books/domain/enums/book-order-field.enum';
import { InvalidBookListCursorException } from '@books/domain/exceptions/invalid-book-list-cursor.exception';
import { BookListPosition } from '@books/domain/types/criteria.types';
import { OrderDirection } from 'src/common/enum/order-direction.enum';
import { decodeCursorPayload } from 'src/common/pagination/cursor.utils';

/** What a book list cursor must agree with to continue a request. */
export type BookListRequest = {
	orderBy: BookOrderField;
	order: OrderDirection;
	search: string | null;
};

/** How the next book list page is read. */
export type BookListWalk =
	| { walk: 'search'; offset: number }
	| { walk: 'keyset'; after: BookListPosition | null };

type CursorPayload = {
	mode?: unknown;
	orderBy?: unknown;
	order?: unknown;
	search?: unknown;
	offset?: unknown;
	value?: unknown;
	createdAt?: unknown;
	id?: unknown;
};

const DATABASE_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveBookListRequest(
	options: Pick<BookPageOptionsDto, 'orderBy' | 'order' | 'search'>,
): BookListRequest {
	return {
		orderBy: options.orderBy || BookOrderField.CREATED_AT,
		order: options.order || OrderDirection.DESC,
		search: options.search?.trim() || null,
	};
}

export function encodeSearchCursor(
	request: BookListRequest,
	offset: number,
): string {
	return encodeUrlSafe({ mode: 'search', ...request, offset });
}

export function encodeKeysetCursor(
	request: BookListRequest,
	position: BookListPosition,
): string {
	return encodeUrlSafe({
		mode: 'keyset',
		...request,
		value: position.sortValue,
		createdAt: position.createdAt,
		id: position.id,
	});
}

/**
 * Turns the `cursor` of a request into the walk that continues it. Without a
 * cursor, a search starts on the search engine and anything else on keyset.
 * A keyset cursor on a search request continues a walk the MySQL fallback
 * started when the search engine failed.
 *
 * @throws InvalidBookListCursorException when the cursor cannot continue the request
 */
export function decodeBookListCursor(
	cursor: string | undefined,
	request: BookListRequest,
): BookListWalk {
	if (!cursor) return startOf(request);

	const payload = decodeCursorPayload<CursorPayload>(cursor);
	if (!payload) throw new InvalidBookListCursorException('malformed cursor');
	ensureIssuedFor(payload, request);

	if (payload.mode === 'search') return decodeSearchWalk(payload);
	if (payload.mode === 'keyset') {
		return decodeKeysetWalk(payload, request.orderBy);
	}
	throw new InvalidBookListCursorException('malformed cursor');
}

function startOf(request: BookListRequest): BookListWalk {
	if (request.search) return { walk: 'search', offset: 0 };
	return { walk: 'keyset', after: null };
}

function ensureIssuedFor(
	payload: CursorPayload,
	request: BookListRequest,
): void {
	const sameRequest =
		payload.orderBy === request.orderBy &&
		payload.order === request.order &&
		payload.search === request.search;
	if (!sameRequest) {
		throw new InvalidBookListCursorException(
			'the cursor was issued for another orderBy, order or search',
		);
	}
}

function decodeSearchWalk(payload: CursorPayload): BookListWalk {
	const offset = payload.offset;
	if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0) {
		throw new InvalidBookListCursorException('malformed search offset');
	}
	return { walk: 'search', offset };
}

function decodeKeysetWalk(
	payload: CursorPayload,
	orderBy: BookOrderField,
): BookListWalk {
	if (!isDatabaseTimestamp(payload.createdAt)) {
		throw new InvalidBookListCursorException('malformed createdAt');
	}
	if (typeof payload.id !== 'string' || !UUID.test(payload.id)) {
		throw new InvalidBookListCursorException('malformed id');
	}
	if (!isSortValueOf(orderBy, payload.value)) {
		throw new InvalidBookListCursorException(
			`malformed value for ${orderBy}`,
		);
	}
	return {
		walk: 'keyset',
		after: {
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

/** base64url, so a cursor survives a query string that was not URL-encoded. */
function encodeUrlSafe(payload: Record<string, unknown>): string {
	return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}
