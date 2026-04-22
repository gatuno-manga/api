import { validate } from 'class-validator';
import { ChapterCommentsPageOptionsDto } from './chapter-comments-page-options.dto';

describe('ChapterCommentsPageOptionsDto', () => {
	it('accepts valid cursor and maxDepth', async () => {
		const dto = new ChapterCommentsPageOptionsDto();
		dto.cursor = Buffer.from(
			JSON.stringify({
				createdAt: '2026-04-10T00:00:00.000Z',
				id: '550e8400-e29b-41d4-a716-446655440000',
			}),
		).toString('base64');
		dto.maxDepth = 5;

		const errors = await validate(dto);
		expect(errors.length).toBe(0);
	});
});
