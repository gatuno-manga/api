import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

export function ApiDocsDownloadBookGet() {
	return applyDecorators(
		ApiOperation({
			summary: 'Download de um livro (GET)',
			description:
				'Baixa capítulos selecionados de um livro em formato ZIP de imagens ou PDFs via link direto',
		}),
		ApiParam({
			name: 'idBook',
			description: 'ID do livro',
			type: 'string',
			format: 'uuid',
		}),
		ApiResponse({
			status: 200,
			description: 'Arquivo do livro gerado com sucesso',
			content: {
				'application/zip': {},
			},
		}),
	);
}

export function ApiDocsDownloadBook() {
	return applyDecorators(
		ApiOperation({
			summary: 'Download de um livro',
			description:
				'Baixa capítulos selecionados de um livro em formato ZIP de imagens ou PDFs',
		}),
		ApiParam({
			name: 'idBook',
			description: 'ID do livro',
			type: 'string',
			format: 'uuid',
		}),
		ApiResponse({
			status: 200,
			description: 'Arquivo do livro gerado com sucesso',
			content: {
				'application/zip': {},
			},
		}),
		ApiResponse({
			status: 404,
			description: 'Livro não encontrado ou capítulos sem páginas',
		}),
		ApiResponse({
			status: 400,
			description: 'Dados inválidos na requisição',
		}),
		ApiResponse({
			status: 429,
			description: 'Limite de requisições excedido',
		}),
	);
}
