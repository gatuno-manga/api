import { COMMON_RESPONSES } from 'src/common/swagger/common-responses';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

export function ApiDocsSearch() {
	return applyDecorators(
		ApiOperation({
			summary: 'Buscar usuários de forma rápida (Meilisearch)',
			description:
				'Retorna resultados ranqueados por relevância para autocomplete',
		}),
		ApiResponse({ status: 200, description: 'Usuários encontrados' }),
		ApiQuery({ name: 'q', required: true }),
	);
}

export function ApiDocsListUsers() {
	return applyDecorators(
		ApiOperation({
			summary: 'Listar usuarios com filtros administrativos',
			description: 'Suporta paginação por page/limit e por cursor',
		}),
		ApiResponse({
			status: 200,
			description: 'Usuarios listados com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN),
		ApiQuery({ name: 'page', required: false }),
		ApiQuery({ name: 'limit', required: false }),
		ApiQuery({ name: 'cursor', required: false }),
		ApiQuery({ name: 'search', required: false }),
		ApiQuery({ name: 'role', required: false }),
		ApiQuery({ name: 'isBanned', required: false }),
		ApiQuery({ name: 'isSuspended', required: false }),
	);
}

export function ApiDocsGetUserById() {
	return applyDecorators(
		ApiOperation({ summary: 'Buscar usuario por id (admin)' }),
		ApiResponse({
			status: 200,
			description: 'Usuario retornado com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN),
	);
}

export function ApiDocsUpdateUser() {
	return applyDecorators(
		ApiOperation({
			summary: 'Atualizar configuracoes de perfil do usuario (admin)',
		}),
		ApiResponse({
			status: 200,
			description: 'Usuario atualizado com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.BAD_REQUEST),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN),
	);
}

export function ApiDocsUpdateUserRoles() {
	return applyDecorators(
		ApiOperation({ summary: 'Substituir roles de um usuario (admin)' }),
		ApiResponse({
			status: 200,
			description: 'Roles atualizadas com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.BAD_REQUEST),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN),
	);
}

export function ApiDocsChangePassword() {
	return applyDecorators(
		ApiOperation({ summary: 'Alterar senha de um usuário (admin)' }),
		ApiResponse({ status: 200, description: 'Senha alterada com sucesso' }),
		ApiResponse(COMMON_RESPONSES.BAD_REQUEST),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN),
	);
}

export function ApiDocsSetModeration() {
	return applyDecorators(
		ApiOperation({ summary: 'Aplicar banimento/suspensao ao usuario' }),
		ApiResponse({
			status: 200,
			description: 'Moderacao aplicada com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.BAD_REQUEST),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN),
	);
}

export function ApiDocsDeleteUser() {
	return applyDecorators(
		ApiOperation({ summary: 'Excluir conta de usuario (admin)' }),
		ApiResponse({
			status: 200,
			description: 'Usuario excluido com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN),
	);
}
