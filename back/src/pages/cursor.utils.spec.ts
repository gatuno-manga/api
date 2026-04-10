import { decodeCursorPayload, encodeCursorPayload } from './cursor.utils';

describe('cursor.utils', () => {
	it('encodes and decodes cursor payload', () => {
		const payload = {
			createdAt: '2026-04-10T00:00:00.000Z',
			id: '550e8400-e29b-41d4-a716-446655440000',
		};

		const cursor = encodeCursorPayload(payload);
		const decoded = decodeCursorPayload<typeof payload>(cursor);

		expect(decoded).toEqual(payload);
	});

	it('returns null for malformed cursor', () => {
		const decoded = decodeCursorPayload<{ id: string }>('%invalid-cursor%');

		expect(decoded).toBeNull();
	});

	it('returns null for cursor that is not an object payload', () => {
		const cursor = Buffer.from('"text"', 'utf8').toString('base64');
		const decoded = decodeCursorPayload<Record<string, unknown>>(cursor);

		expect(decoded).toBeNull();
	});
});
