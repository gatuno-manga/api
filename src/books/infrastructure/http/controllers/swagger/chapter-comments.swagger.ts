import { COMMON_RESPONSES } from 'src/common/swagger/common-responses';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

export function ApiDocsListChapterComments() {
	return applyDecorators(
		ApiOperation({
			summary: 'Listar comentarios do capitulo',
			description:
				'Lista comentarios de um capitulo com respostas em arvore e paginacao dos comentarios raiz (page/limit ou cursor)',
		}),
		ApiParam({ name: 'chapterId', description: 'UUID do capitulo' }),
		ApiResponse({
			status: 200,
			description: 'Comentarios listados com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
	);
}

export function ApiDocsCreateComment() {
	return applyDecorators(
		ApiOperation({
			summary: 'Criar comentario no capitulo',
			description: 'Cria um comentario raiz para o capitulo',
		}),
		ApiParam({ name: 'chapterId', description: 'UUID do capitulo' }),
		ApiResponse({
			status: 201,
			description: 'Comentario criado com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
	);
}

export function ApiDocsCreateReply() {
	return applyDecorators(
		ApiOperation({
			summary: 'Responder comentario',
			description:
				'Cria uma resposta para qualquer comentario da discussao',
		}),
		ApiParam({ name: 'chapterId', description: 'UUID do capitulo' }),
		ApiParam({ name: 'parentId', description: 'UUID do comentario pai' }),
		ApiResponse({
			status: 201,
			description: 'Resposta criada com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.BAD_REQUEST),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
	);
}

export function ApiDocsUpdateComment() {
	return applyDecorators(
		ApiOperation({
			summary: 'Atualizar comentario',
			description: 'Atualiza um comentario do capitulo (autor ou admin)',
		}),
		ApiParam({ name: 'chapterId', description: 'UUID do capitulo' }),
		ApiParam({ name: 'commentId', description: 'UUID do comentario' }),
		ApiResponse({
			status: 200,
			description: 'Comentario atualizado com sucesso',
		}),
		ApiResponse({
			status: 400,
			description: 'Comentarios removidos nao podem ser editados',
		}),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse({ status: 403, description: 'Proibido' }),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
	);
}

export function ApiDocsDeleteComment() {
	return applyDecorators(
		ApiOperation({
			summary: 'Remover comentario',
			description:
				'Remove logicamente um comentario mantendo a estrutura de respostas',
		}),
		ApiParam({ name: 'chapterId', description: 'UUID do capitulo' }),
		ApiParam({ name: 'commentId', description: 'UUID do comentario' }),
		ApiResponse({
			status: 200,
			description: 'Comentario removido com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse({ status: 403, description: 'Proibido' }),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
	);
}
