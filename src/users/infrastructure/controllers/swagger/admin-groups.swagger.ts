import { COMMON_RESPONSES } from 'src/common/swagger/common-responses';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export function ApiDocsListGroups() {
	return applyDecorators(
		ApiOperation({ summary: 'Listar todos os grupos' }),
		ApiResponse({
			status: 200,
			description: 'Grupos listados com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN),
	);
}

export function ApiDocsCreateGroup() {
	return applyDecorators(
		ApiOperation({ summary: 'Criar grupo' }),
		ApiResponse({ status: 201, description: 'Grupo criado com sucesso' }),
		ApiResponse(COMMON_RESPONSES.BAD_REQUEST),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN),
	);
}

export function ApiDocsUpdateGroup() {
	return applyDecorators(
		ApiOperation({ summary: 'Atualizar grupo' }),
		ApiResponse({
			status: 200,
			description: 'Grupo atualizado com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.BAD_REQUEST),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN),
	);
}

export function ApiDocsDeleteGroup() {
	return applyDecorators(
		ApiOperation({ summary: 'Excluir grupo' }),
		ApiResponse({ status: 200, description: 'Grupo excluido com sucesso' }),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN),
	);
}

export function ApiDocsAddMembers() {
	return applyDecorators(
		ApiOperation({ summary: 'Adicionar membros ao grupo' }),
		ApiResponse({
			status: 201,
			description: 'Membros adicionados com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.BAD_REQUEST),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN),
	);
}

export function ApiDocsRemoveMember() {
	return applyDecorators(
		ApiOperation({ summary: 'Remover membro do grupo' }),
		ApiResponse({
			status: 200,
			description: 'Membro removido com sucesso',
		}),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN),
	);
}
