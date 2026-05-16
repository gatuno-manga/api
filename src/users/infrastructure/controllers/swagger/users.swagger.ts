import { applyDecorators } from '@nestjs/common';
import {
	ApiBody,
	ApiConsumes,
	ApiOperation,
	ApiResponse,
} from '@nestjs/swagger';
import { COMMON_RESPONSES } from 'src/common/swagger/common-responses';
import { MULTIPART_SCHEMAS } from 'src/common/swagger/multipart-schemas';

export function ApiDocsGetCurrentUser() {
	return applyDecorators(
		ApiOperation({
			summary: 'Obter perfil do usuario atual',
			description: 'Recupera as informacoes do usuario autenticado',
		}),
		ApiResponse({
			status: 200,
			description: 'Perfil retornado com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
	);
}

export function ApiDocsUpdateUser() {
	return applyDecorators(
		ApiOperation({
			summary: 'Atualizar perfil do usuario',
			description: 'Atualiza as informacoes do usuario autenticado',
		}),
		ApiResponse({
			status: 200,
			description: 'Usuario atualizado com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.BAD_REQUEST),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
	);
}

export function ApiDocsUploadAvatar() {
	return applyDecorators(
		ApiOperation({
			summary: 'Enviar avatar do usuario',
			description: 'Envia ou substitui a imagem de perfil do usuario',
		}),
		ApiResponse({
			status: 200,
			description: 'Avatar atualizado com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.BAD_REQUEST),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiConsumes('multipart/form-data'),
		ApiBody({
			schema: MULTIPART_SCHEMAS.SINGLE_IMAGE_FILE,
		}),
	);
}

export function ApiDocsUploadBanner() {
	return applyDecorators(
		ApiOperation({
			summary: 'Enviar banner do usuario',
			description: 'Envia ou substitui a imagem de banner do usuario',
		}),
		ApiResponse({
			status: 200,
			description: 'Banner atualizado com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.BAD_REQUEST),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiConsumes('multipart/form-data'),
		ApiBody({
			schema: MULTIPART_SCHEMAS.SINGLE_IMAGE_FILE,
		}),
	);
}
