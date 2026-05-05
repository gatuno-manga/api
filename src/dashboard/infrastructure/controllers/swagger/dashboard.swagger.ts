import { applyDecorators } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

export function ApiDocsGetOverview() {
	return applyDecorators(
		ApiOperation({ summary: 'Obter visão geral do dashboard' }),
	);
}
