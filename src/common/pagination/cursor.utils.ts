export function encodeCursorPayload(payload: Record<string, unknown>): string {
	return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

export function decodeCursorPayload<T>(cursor?: string): T | null {
	if (!cursor) {
		return null;
	}

	try {
		const decodedCursor = Buffer.from(cursor, 'base64').toString('utf8');
		const payload: unknown = JSON.parse(decodedCursor);

		if (!payload || typeof payload !== 'object') {
			return null;
		}

		return payload as T;
	} catch {
		return null;
	}
}
