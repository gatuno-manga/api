import { BookOrderField } from '@books/domain/enums/book-order-field.enum';
import { InvalidBookListCursorException } from '@books/domain/exceptions/invalid-book-list-cursor.exception';
import { OrderDirection } from 'src/common/enum/order-direction.enum';
import { encodeCursorPayload } from 'src/common/pagination/cursor.utils';
import {
	BookListRequest,
	decodeBookListCursor,
	encodeKeysetCursor,
	encodeSearchCursor,
	resolveBookListRequest,
} from './book-list-cursor';

describe('book list cursor', () => {
	const browse: BookListRequest = {
		orderBy: BookOrderField.CREATED_AT,
		order: OrderDirection.DESC,
		search: null,
	};
	const search: BookListRequest = { ...browse, search: 'solo' };
	const position = {
		sortValue: '2026-01-01 10:00:00.123456',
		createdAt: '2026-01-01 10:00:00.123456',
		id: '0190a2b4-0000-7000-8000-000000000001',
	};
	const keysetPayload = (overrides: Record<string, unknown> = {}) =>
		encodeCursorPayload({
			mode: 'keyset',
			...browse,
			value: position.sortValue,
			createdAt: position.createdAt,
			id: position.id,
			...overrides,
		});

	describe('resolveBookListRequest', () => {
		it('should default to the list order the repository uses, so the cursor and the query agree', () => {
			// Act
			const request = resolveBookListRequest({});

			// Assert
			expect(request).toEqual(browse);
		});

		it('should treat a blank search as no search, as the list does', () => {
			// Act
			const request = resolveBookListRequest({ search: '  solo ' });
			const blank = resolveBookListRequest({ search: '   ' });

			// Assert
			expect(request.search).toBe('solo');
			expect(blank.search).toBeNull();
		});
	});

	describe('decodeBookListCursor', () => {
		it('should start a browse at the top of the keyset walk when there is no cursor', () => {
			// Act
			const walk = decodeBookListCursor(undefined, browse);

			// Assert
			expect(walk).toEqual({ walk: 'keyset', after: null });
		});

		it('should start a search at offset 0 of the search engine when there is no cursor', () => {
			// Act
			const walk = decodeBookListCursor(undefined, search);

			// Assert
			expect(walk).toEqual({ walk: 'search', offset: 0 });
		});

		it('should continue after the exact position a keyset cursor was issued for, keeping microseconds', () => {
			// Arrange
			const cursor = encodeKeysetCursor(browse, position);

			// Act
			const walk = decodeBookListCursor(cursor, browse);

			// Assert
			expect(walk).toEqual({ walk: 'keyset', after: position });
		});

		it('should issue URL-safe cursors, so a client that does not encode the query string still sends them intact', () => {
			// Arrange
			const cursor = encodeKeysetCursor(
				{ ...browse, orderBy: BookOrderField.TITLE },
				{ ...position, sortValue: '??>>~~ÿÿ' },
			);

			// Assert
			expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
		});

		it('should continue a search walk at the offset its cursor carries', () => {
			// Arrange
			const cursor = encodeSearchCursor(search, 40);

			// Act
			const walk = decodeBookListCursor(cursor, search);

			// Assert
			expect(walk).toEqual({ walk: 'search', offset: 40 });
		});

		it('should continue on keyset when a search brings the keyset cursor the MySQL fallback issued for it', () => {
			// Arrange
			const cursor = encodeKeysetCursor(search, position);

			// Act
			const walk = decodeBookListCursor(cursor, search);

			// Assert
			expect(walk).toEqual({ walk: 'keyset', after: position });
		});

		it('should accept a null publication, because books without a year sit in the list too', () => {
			// Arrange
			const request = {
				...browse,
				orderBy: BookOrderField.PUBLICATION,
				order: OrderDirection.ASC,
			};
			const cursor = encodeKeysetCursor(request, {
				...position,
				sortValue: null,
			});

			// Act
			const walk = decodeBookListCursor(cursor, request);

			// Assert
			expect(walk).toEqual({
				walk: 'keyset',
				after: { ...position, sortValue: null },
			});
		});

		it.each([
			[
				'another orderBy',
				browse,
				{ ...browse, orderBy: BookOrderField.TITLE },
			],
			['another order', browse, { ...browse, order: OrderDirection.ASC }],
			['a search, when it came from a browse', browse, search],
			['a browse, when it came from a search', search, browse],
			['another search term', search, { ...search, search: 'naruto' }],
		])(
			'should reject a keyset cursor reused with %s, because its position means nothing there',
			(_case, issuedFor, reusedWith) => {
				// Arrange
				const cursor = encodeKeysetCursor(issuedFor, position);

				// Act
				const decode = () => decodeBookListCursor(cursor, reusedWith);

				// Assert
				expect(decode).toThrow(InvalidBookListCursorException);
			},
		);

		it.each([
			['another orderBy', { ...search, orderBy: BookOrderField.TITLE }],
			['another order', { ...search, order: OrderDirection.ASC }],
			['another search term', { ...search, search: 'naruto' }],
			['no search', browse],
		])(
			'should reject a search cursor reused with %s, because its offset points into other results',
			(_case, reusedWith) => {
				// Arrange
				const cursor = encodeSearchCursor(search, 20);

				// Act
				const decode = () => decodeBookListCursor(cursor, reusedWith);

				// Assert
				expect(decode).toThrow(InvalidBookListCursorException);
			},
		);

		it.each([
			['not base64 JSON', 'not-a-cursor'],
			[
				'an unknown mode',
				encodeCursorPayload({ mode: 'other', ...browse }),
			],
			[
				'a negative search offset',
				encodeCursorPayload({ mode: 'search', ...browse, offset: -5 }),
			],
			[
				'a millisecond Date instead of the database timestamp',
				keysetPayload({
					value: '2026-01-01T10:00:00.123Z',
					createdAt: '2026-01-01T10:00:00.123Z',
				}),
			],
			['an id that is not a UUID', keysetPayload({ id: '1 OR 1=1' })],
		])(
			'should reject %s, so a broken client fails loudly instead of restarting the list',
			(_case, cursor) => {
				// Act
				const decode = () => decodeBookListCursor(cursor, browse);

				// Assert
				expect(decode).toThrow(InvalidBookListCursorException);
			},
		);

		it.each([
			[BookOrderField.TITLE, 1997],
			[BookOrderField.PUBLICATION, 'Solo Leveling'],
			[BookOrderField.UPDATED_AT, null],
		])(
			'should reject a %s cursor whose value has the wrong type',
			(orderBy, value) => {
				// Arrange
				const request = { ...browse, orderBy };
				const cursor = keysetPayload({ orderBy, value });

				// Act
				const decode = () => decodeBookListCursor(cursor, request);

				// Assert
				expect(decode).toThrow(InvalidBookListCursorException);
			},
		);
	});
});
