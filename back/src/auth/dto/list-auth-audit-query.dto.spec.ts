import { validate } from 'class-validator';
import { ListAuthAuditQueryDto } from './list-auth-audit-query.dto';

describe('ListAuthAuditQueryDto', () => {
	it('accepts valid cursor and limit', async () => {
		const dto = new ListAuthAuditQueryDto();
		dto.cursor = Buffer.from(
			JSON.stringify({
				createdAt: '2026-04-10T00:00:00.000Z',
				id: '550e8400-e29b-41d4-a716-446655440000',
			}),
		).toString('base64');
		dto.limit = 20;

		const errors = await validate(dto);
		expect(errors.length).toBe(0);
	});

	it('fails when cursor is not a string', async () => {
		const dto = new ListAuthAuditQueryDto();
		(dto as unknown as { cursor: number }).cursor = 42;

		const errors = await validate(dto);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors[0].property).toBe('cursor');
	});
});
