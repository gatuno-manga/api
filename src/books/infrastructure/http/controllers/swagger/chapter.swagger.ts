import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { COMMON_RESPONSES } from 'src/common/swagger/common-responses';

export function ApiDocsGetChapter() {
	return applyDecorators(
		ApiOperation({
			summary: 'Obter capitulo por ID',
			description: 'Retorna conteudo e detalhes do capitulo',
		}),
		ApiParam({
			name: 'idChapter',
			description: 'Identificador unico do capitulo',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({ status: 200, description: 'Capitulo encontrado' }),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
		ApiResponse(COMMON_RESPONSES.TOO_MANY_REQUESTS),
	);
}

export function ApiDocsResetChapter() {
	return applyDecorators(
		ApiOperation({
			summary: 'Resetar capitulo',
			description: 'Reseta cache e dados do capitulo',
		}),
		ApiParam({
			name: 'idChapter',
			description: 'Identificador unico do capitulo',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Capitulo resetado com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
	);
}

export function ApiDocsResetAllChapters() {
	return applyDecorators(
		ApiOperation({
			summary: 'Resetar multiplos capitulos',
			description: 'Reseta cache e dados de varios capitulos',
		}),
		ApiResponse({
			status: 200,
			description: 'Capitulos resetados com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
	);
}

export function ApiDocsMarkChapterAsRead() {
	return applyDecorators(
		ApiOperation({
			summary: 'Marcar capitulo como lido',
			description: 'Marca um capitulo como lido para o usuario atual',
		}),
		ApiParam({
			name: 'idChapter',
			description: 'Identificador unico do capitulo',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({ status: 200, description: 'Capitulo marcado como lido' }),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.TOO_MANY_REQUESTS),
	);
}

export function ApiDocsMarkChapterAsUnread() {
	return applyDecorators(
		ApiOperation({
			summary: 'Marcar capitulo como nao lido',
			description: 'Marca um capitulo como nao lido para o usuario atual',
		}),
		ApiParam({
			name: 'idChapter',
			description: 'Identificador unico do capitulo',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Capitulo marcado como nao lido',
		}),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.TOO_MANY_REQUESTS),
	);
}

export function ApiDocsMarkChaptersAsRead() {
	return applyDecorators(
		ApiOperation({
			summary: 'Marcar multiplos capitulos como lidos',
			description:
				'Marca varios capitulos como lidos para o usuario atual',
		}),
		ApiResponse({
			status: 200,
			description: 'Capitulos marcados como lidos',
		}),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
	);
}

export function ApiDocsMarkChaptersAsUnread() {
	return applyDecorators(
		ApiOperation({
			summary: 'Marcar multiplos capitulos como nao lidos',
			description:
				'Marca varios capitulos como nao lidos para o usuario atual',
		}),
		ApiResponse({
			status: 200,
			description: 'Capitulos marcados como nao lidos',
		}),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
	);
}

export function ApiDocsGetChaptersWithLessPages() {
	return applyDecorators(
		ApiOperation({
			summary: 'Listar capitulos com poucas paginas',
			description:
				'Lista capitulos com menos paginas que o valor informado',
		}),
		ApiParam({
			name: 'pages',
			description: 'Quantidade maxima de paginas',
			example: 10,
		}),
		ApiResponse({
			status: 200,
			description: 'Capitulos retornados com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
	);
}

export function ApiDocsGetChaptersBatch() {
	return applyDecorators(
		ApiOperation({
			summary: 'Obter dados de multiplos capitulos',
			description:
				'Retorna conteudo e detalhes de varios capitulos de uma vez (otimizado para download offline)',
		}),
		ApiBody({ type: [String], description: 'Array de IDs de capitulos' }),
		ApiResponse({
			status: 200,
			description: 'Dados dos capitulos retornados com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
	);
}
