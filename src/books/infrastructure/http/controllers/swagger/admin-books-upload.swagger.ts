import { MULTIPART_SCHEMAS } from 'src/common/swagger/multipart-schemas';
import { COMMON_RESPONSES } from 'src/common/swagger/common-responses';
import { UploadTextContentDto } from '@books/application/dto/upload-text-content.dto';
import { applyDecorators } from '@nestjs/common';
import {
	ApiOperation,
	ApiConsumes,
	ApiParam,
	ApiBody,
	ApiResponse,
} from '@nestjs/swagger';

export function ApiDocsReplaceCoverImage() {
	return applyDecorators(
		ApiOperation({
			summary: 'Substituir imagem da capa',
			description:
				'Substitui a imagem de uma capa existente (somente admin)',
		}),
		ApiConsumes('multipart/form-data'),
		ApiParam({
			name: 'idBook',
			description: 'Identificador unico do livro',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiParam({
			name: 'idCover',
			description: 'Identificador unico da capa',
			example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
		}),
		ApiBody({
			schema: MULTIPART_SCHEMAS.IMAGE_FILE_WITH_OPTIONAL_TITLE,
		}),
		ApiResponse({
			status: 200,
			description: 'Imagem da capa substituida com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.BAD_REQUEST),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
	);
}

export function ApiDocsUploadCover() {
	return applyDecorators(
		ApiOperation({
			summary: 'Enviar capa do livro',
			description:
				'Envia uma unica imagem de capa para um livro (somente admin)',
		}),
		ApiConsumes('multipart/form-data'),
		ApiParam({
			name: 'idBook',
			description: 'Identificador unico do livro',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiBody({
			schema: MULTIPART_SCHEMAS.IMAGE_FILE_WITH_OPTIONAL_TITLE,
		}),
		ApiResponse({ status: 201, description: 'Capa enviada com sucesso' }),
		ApiResponse(COMMON_RESPONSES.BAD_REQUEST),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
	);
}

export function ApiDocsUploadMultipleCovers() {
	return applyDecorators(
		ApiOperation({
			summary: 'Enviar multiplas capas do livro',
			description:
				'Envia varias imagens de capa de uma vez (somente admin)',
		}),
		ApiConsumes('multipart/form-data'),
		ApiParam({
			name: 'idBook',
			description: 'Identificador unico do livro',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiBody({
			schema: MULTIPART_SCHEMAS.MULTIPLE_IMAGE_FILES,
		}),
		ApiResponse({ status: 201, description: 'Capas enviadas com sucesso' }),
		ApiResponse(COMMON_RESPONSES.BAD_REQUEST),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
	);
}

export function ApiDocsUploadChapterPages() {
	return applyDecorators(
		ApiOperation({
			summary: 'Enviar paginas do capitulo',
			description:
				'Envia varias imagens de pagina para um capitulo (somente admin)',
		}),
		ApiConsumes('multipart/form-data'),
		ApiParam({
			name: 'idChapter',
			description: 'Identificador unico do capitulo',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiBody({
			schema: MULTIPART_SCHEMAS.CHAPTER_PAGES_UPLOAD,
		}),
		ApiResponse({
			status: 201,
			description: 'Paginas enviadas com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.BAD_REQUEST),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
	);
}

export function ApiDocsUploadChapterDocument() {
	return applyDecorators(
		ApiOperation({
			summary: 'Enviar documento do capitulo',
			description:
				'Envia um documento PDF ou EPUB para um capitulo (somente admin)',
		}),
		ApiConsumes('multipart/form-data'),
		ApiParam({
			name: 'idChapter',
			description: 'Identificador unico do capitulo',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiBody({
			schema: MULTIPART_SCHEMAS.DOCUMENT_FILE_WITH_OPTIONAL_TITLE,
		}),
		ApiResponse({
			status: 201,
			description: 'Documento enviado com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.BAD_REQUEST),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
	);
}

export function ApiDocsUploadChapterTextContent() {
	return applyDecorators(
		ApiOperation({
			summary: 'Enviar conteudo textual do capitulo',
			description:
				'Envia conteudo textual (Markdown/HTML/Plain) para um capitulo (somente admin)',
		}),
		ApiParam({
			name: 'idChapter',
			description: 'Identificador unico do capitulo',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiBody({
			type: UploadTextContentDto,
			description: 'Conteudo textual e formato',
		}),
		ApiResponse({
			status: 201,
			description: 'Conteudo textual enviado com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.BAD_REQUEST),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
	);
}
