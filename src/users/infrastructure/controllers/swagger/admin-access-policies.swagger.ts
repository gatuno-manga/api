import { COMMON_RESPONSES } from 'src/common/swagger/common-responses';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export function ApiDocsListPolicies() {
	return applyDecorators(
		ApiOperation({ summary: 'Listar politicas de acesso' }),
		ApiResponse({
			status: 200,
			description: 'Politicas listadas com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN),
	);
}

export function ApiDocsCreatePolicy() {
	return applyDecorators(
		ApiOperation({ summary: 'Criar politica de acesso' }),
		ApiResponse({
			status: 201,
			description: 'Politica criada com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.BAD_REQUEST),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN),
	);
}

export function ApiDocsDeletePolicy() {
	return applyDecorators(
		ApiOperation({ summary: 'Excluir politica de acesso' }),
		ApiResponse({
			status: 200,
			description: 'Politica excluida com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN),
	);
}
