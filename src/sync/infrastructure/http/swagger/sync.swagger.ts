import { applyDecorators } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

export function ApiDocsSync() {
	return applyDecorators(
		ApiOperation({ summary: 'Sincronização unificada offline-first' }),
	);
}
