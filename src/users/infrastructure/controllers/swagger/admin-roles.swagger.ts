import { COMMON_RESPONSES } from 'src/common/swagger/common-responses';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export function ApiDocsListRoles() {
	return applyDecorators(
		ApiOperation({ summary: 'Listar todas as roles' }),
		ApiResponse({ status: 200, description: 'Roles listadas com sucesso' }),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN),
	);
}

export function ApiDocsCreateRole() {
	return applyDecorators(
		ApiOperation({ summary: 'Criar role' }),
		ApiResponse({ status: 201, description: 'Role criada com sucesso' }),
		ApiResponse(COMMON_RESPONSES.BAD_REQUEST),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN),
	);
}

export function ApiDocsUpdateRole() {
	return applyDecorators(
		ApiOperation({ summary: 'Atualizar role' }),
		ApiResponse({
			status: 200,
			description: 'Role atualizada com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.BAD_REQUEST),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN),
	);
}
