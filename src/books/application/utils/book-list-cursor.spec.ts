import { BookOrderField } from '@books/domain/enums/book-order-field.enum';
import { InvalidBookListCursorException } from '@books/domain/exceptions/invalid-book-list-cursor.exception';
import { OrderDirection } from 'src/common/enum/order-direction.enum';
import { encodeCursorPayload } from 'src/common/pagination/cursor.utils';
import {
	BookListSort,
	decodeBookListCursor,
	encodeKeysetCursor,
	encodeSearchCursor,
	resolveBookListSort,
} from './book-list-cursor';

describe('book list cursor', () => {
	const createdAtDesc: BookListSort = {
		orderBy: BookOrderField.CREATED_AT,
		order: OrderDirection.DESC,
	};
	const position = {
		sortValue: '2026-01-01 10:00:00.123456',
		createdAt: '2026-01-01 10:00:00.123456',
		id: '0190a2b4-0000-7000-8000-000000000001',
	};

	describe('resolveBookListSort', () => {
		it('should default to the list order the repository uses, so the cursor and the query agree', () => {
			// Act
			const sort = resolveBookListSort({});

			// Assert
			expect(sort).toEqual(createdAtDesc);
		});
	});

	describe('decodeBookListCursor', () => {
		it('should start at the first page when there is no cursor, so paginationMode=cursor alone returns page one', () => {
			// Act
			const target = decodeBookListCursor(
				undefined,
				createdAtDesc,
				false,
			);

			// Assert
			expect(target).toEqual({ kind: 'start' });
		});

		it('should continue after the exact position a keyset cursor was issued for, keeping microseconds', () => {
			// Arrange
			const cursor = encodeKeysetCursor(createdAtDesc, position);

			// Act
			const target = decodeBookListCursor(cursor, createdAtDesc, false);

			// Assert
			expect(target).toEqual({ kind: 'keyset', position });
		});

		it('should continue a search walk at the offset its cursor carries', () => {
			// Arrange
			const cursor = encodeSearchCursor(40);

			// Act
			const target = decodeBookListCursor(cursor, createdAtDesc, true);

			// Assert
			expect(target).toEqual({ kind: 'search', offset: 40 });
		});

		it('should accept a keyset cursor on a search request, because the MySQL fallback issues one when the search engine fails', () => {
			// Arrange
			const cursor = encodeKeysetCursor(createdAtDesc, position);

			// Act
			const target = decodeBookListCursor(cursor, createdAtDesc, true);

			// Assert
			expect(target).toEqual({ kind: 'keyset', position });
		});

		it('should accept a null publication, because books without a year sit in the list too', () => {
			// Arrange
			const sort = {
				orderBy: BookOrderField.PUBLICATION,
				order: OrderDirection.ASC,
			};
			const cursor = encodeKeysetCursor(sort, {
				...position,
				sortValue: null,
			});

			// Act
			const target = decodeBookListCursor(cursor, sort, false);

			// Assert
			expect(target).toEqual({
				kind: 'keyset',
				position: { ...position, sortValue: null },
			});
		});

		it.each([
			['not base64 JSON', 'not-a-cursor'],
			['an unknown mode', encodeCursorPayload({ mode: 'other' })],
			[
				'a negative search offset',
				encodeCursorPayload({ mode: 'search', offset: -5 }),
			],
			[
				'a millisecond Date instead of the database timestamp',
				encodeCursorPayload({
					mode: 'keyset',
					orderBy: BookOrderField.CREATED_AT,
					order: OrderDirection.DESC,
					value: '2026-01-01T10:00:00.123Z',
					createdAt: '2026-01-01T10:00:00.123Z',
					id: position.id,
				}),
			],
			[
				'an id that is not a UUID',
				encodeCursorPayload({
					mode: 'keyset',
					orderBy: BookOrderField.CREATED_AT,
					order: OrderDirection.DESC,
					value: position.createdAt,
					createdAt: position.createdAt,
					id: '1 OR 1=1',
				}),
			],
		])(
			'should reject %s, so a broken client fails loudly instead of restarting the list',
			(_case, cursor) => {
				// Act
				const decode = () =>
					decodeBookListCursor(cursor, createdAtDesc, true);

				// Assert
				expect(decode).toThrow(InvalidBookListCursorException);
			},
		);

		it('should reject a cursor issued for another sort, because its position means nothing in the new order', () => {
			// Arrange
			const cursor = encodeKeysetCursor(createdAtDesc, position);
			const titleAsc = {
				orderBy: BookOrderField.TITLE,
				order: OrderDirection.ASC,
			};

			// Act
			const decode = () => decodeBookListCursor(cursor, titleAsc, false);

			// Assert
			expect(decode).toThrow('another orderBy or order');
		});

		it('should reject a search cursor on a request without search, because its offset points into search results', () => {
			// Arrange
			const cursor = encodeSearchCursor(20);

			// Act
			const decode = () =>
				decodeBookListCursor(cursor, createdAtDesc, false);

			// Assert
			expect(decode).toThrow(InvalidBookListCursorException);
		});

		it.each([
			[BookOrderField.TITLE, 1997],
			[BookOrderField.PUBLICATION, 'Solo Leveling'],
			[BookOrderField.UPDATED_AT, null],
		])(
			'should reject a %s cursor whose value has the wrong type',
			(orderBy, value) => {
				// Arrange
				const sort = { orderBy, order: OrderDirection.ASC };
				const cursor = encodeCursorPayload({
					mode: 'keyset',
					...sort,
					value,
					createdAt: position.createdAt,
					id: position.id,
				});

				// Act
				const decode = () => decodeBookListCursor(cursor, sort, false);

				// Assert
				expect(decode).toThrow(InvalidBookListCursorException);
			},
		);
	});
});
