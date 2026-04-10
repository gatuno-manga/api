import { validate } from 'class-validator';
import { BookRelationshipsQueryDto } from './book-relationships-query.dto';

describe('BookRelationshipsQueryDto', () => {
	it('accepts valid cursor, limit and offset', async () => {
		const dto = new BookRelationshipsQueryDto();
		dto.cursor = Buffer.from(
			JSON.stringify({
				order: 1,
				createdAt: '2026-04-10T00:00:00.000Z',
				id: '550e8400-e29b-41d4-a716-446655440000',
			}),
		).toString('base64');
		dto.limit = 20;
		dto.offset = 0;

		const errors = await validate(dto);
		expect(errors.length).toBe(0);
	});
});
