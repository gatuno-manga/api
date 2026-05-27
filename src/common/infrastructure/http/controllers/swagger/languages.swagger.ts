import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

export function ApiDocsListLanguages() {
	return applyDecorators(
		ApiOperation({
			summary: 'Listar idiomas suportados',
			description:
				'Retorna uma lista de códigos BCP-47 e seus nomes traduzidos para exibição no frontend.',
		}),
		ApiQuery({
			name: 'lang',
			description:
				'Idioma para traduzir os nomes da lista (ex: en-US para ver "Portuguese" em vez de "Português")',
			required: false,
			example: 'pt-BR',
		}),
		ApiResponse({
			status: 200,
			description: 'Lista de idiomas retornada com sucesso',
			schema: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						code: { type: 'string', example: 'pt-BR' },
						name: { type: 'string', example: 'Português (Brasil)' },
					},
				},
			},
		}),
	);
}
