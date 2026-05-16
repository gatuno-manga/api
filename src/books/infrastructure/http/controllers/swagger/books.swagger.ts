import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { COMMON_RESPONSES } from 'src/common/swagger/common-responses';
import { BookChaptersCursorPageDto } from '@books/application/dto/book-chapters-cursor-page.dto';
import { BookRelationshipsPageDto } from '@books/application/dto/book-relationships-page.dto';

export function ApiDocsGetAllBooks() {
	return applyDecorators(
		ApiOperation({
			summary: 'Listar livros',
			description:
				'Retorna uma lista paginada de livros com filtros (page/limit ou cursor)',
		}),
		ApiResponse({
			status: 200,
			description: 'Livros retornados com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.TOO_MANY_REQUESTS),
	);
}

export function ApiDocsGetRandomBook() {
	return applyDecorators(
		ApiOperation({
			summary: 'Obter livro aleatorio',
			description: 'Retorna um livro aleatorio com base nos filtros',
		}),
		ApiResponse({
			status: 200,
			description: 'Livro aleatorio retornado com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.TOO_MANY_REQUESTS),
	);
}

export function ApiDocsCheckBookTitle() {
	return applyDecorators(
		ApiOperation({
			summary: 'Verificar se titulo do livro ja existe',
			description:
				'Verifica se ja existe livro com o titulo informado ou titulos alternativos antes de criar um novo. Retorna todos os conflitos.',
		}),
		ApiParam({
			name: 'title',
			description: 'Titulo do livro para verificacao',
			example: 'One Piece',
		}),
		ApiQuery({
			name: 'alternativeTitles',
			description:
				'Titulos alternativos para verificar (separados por virgula)',
			required: false,
			example: 'ワンピース,Wan Pīsu',
		}),
		ApiResponse({
			status: 200,
			description:
				'Title check completed. Returns all books that conflict with the provided titles.',
			schema: {
				type: 'object',
				properties: {
					conflict: { type: 'boolean', example: true },
					existingBook: {
						type: 'object',
						description:
							'First conflicting book (for backwards compatibility)',
						properties: {
							id: {
								type: 'string',
								example: '550e8400-e29b-41d4-a716-446655440000',
							},
							title: { type: 'string', example: 'One Piece' },
							alternativeTitle: {
								type: 'array',
								items: { type: 'string' },
								example: ['ワンピース', 'Wan Pīsu'],
							},
						},
					},
					conflictingBooks: {
						type: 'array',
						description: 'All books that have conflicting titles',
						items: {
							type: 'object',
							properties: {
								id: {
									type: 'string',
									example:
										'550e8400-e29b-41d4-a716-446655440000',
								},
								title: { type: 'string', example: 'One Piece' },
								alternativeTitle: {
									type: 'array',
									items: { type: 'string' },
									example: ['ワンピース', 'Wan Pīsu'],
								},
							},
						},
					},
				},
			},
		}),
	);
}

export function ApiDocsGetBook() {
	return applyDecorators(
		ApiOperation({
			summary: 'Obter livro por ID',
			description:
				'Retorna informacoes detalhadas de um livro especifico',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Identificador unico do livro',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({ status: 200, description: 'Livro encontrado' }),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
		ApiResponse(COMMON_RESPONSES.TOO_MANY_REQUESTS),
	);
}

export function ApiDocsGetBookChapters() {
	return applyDecorators(
		ApiOperation({
			summary: 'Obter capitulos do livro',
			description: 'Retorna capitulos de um livro especifico',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Identificador unico do livro',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiQuery({
			name: 'cursor',
			required: false,
			description: 'Cursor em base64 retornado na página anterior',
			example: 'MTAwLjA=',
		}),
		ApiQuery({
			name: 'limit',
			required: false,
			description: 'Quantidade de capítulos por página',
			example: 200,
		}),
		ApiResponse({
			status: 200,
			description: 'Capitulos retornados com sucesso',
			type: BookChaptersCursorPageDto,
		}),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
		ApiResponse(COMMON_RESPONSES.TOO_MANY_REQUESTS),
	);
}

export function ApiDocsGetBookCovers() {
	return applyDecorators(
		ApiOperation({
			summary: 'Obter capas do livro',
			description: 'Retorna todas as capas disponiveis de um livro',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Identificador unico do livro',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Capas retornadas com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
		ApiResponse(COMMON_RESPONSES.TOO_MANY_REQUESTS),
	);
}

export function ApiDocsGetBookRelationships() {
	return applyDecorators(
		ApiOperation({
			summary: 'Obter relacionamentos do livro',
			description:
				'Retorna livros relacionados a um livro especifico, aplicando politicas de acesso e limites de conteudo sensivel (offset/limit ou cursor)',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Identificador unico do livro',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Relacionamentos retornados com sucesso',
			type: BookRelationshipsPageDto,
		}),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
		ApiResponse(COMMON_RESPONSES.TOO_MANY_REQUESTS),
	);
}

export function ApiDocsGetBookInfos() {
	return applyDecorators(
		ApiOperation({
			summary: 'Obter informacoes do livro',
			description:
				'Retorna informacoes adicionais e metadados de um livro',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Identificador unico do livro',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Informacoes do livro retornadas com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
		ApiResponse(COMMON_RESPONSES.TOO_MANY_REQUESTS),
	);
}
