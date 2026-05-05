import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

export function ApiDocsDownloadChapter() {
	return applyDecorators(
		ApiOperation({
			summary: 'Download de um capítulo',
			description:
				'Baixa um capítulo específico em formato ZIP (imagens) ou PDF',
		}),
		ApiParam({
			name: 'idChapter',
			description: 'ID do capítulo',
			type: 'string',
			format: 'uuid',
		}),
		ApiResponse({
			status: 200,
			description: 'Arquivo do capítulo gerado com sucesso',
			content: {
				'application/zip': {},
				'application/pdf': {},
			},
		}),
		ApiResponse({
			status: 404,
			description: 'Capítulo não encontrado ou sem páginas',
		}),
		ApiResponse({
			status: 429,
			description: 'Limite de requisições excedido',
		}),
	);
}
