import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { COMMON_RESPONSES } from 'src/common/swagger/common-responses';

const SECTION_PARAM = ApiParam({
	name: 'section',
	description: 'Preference section name',
	enum: ['reader'],
});

export function ApiDocsGetPreferences() {
	return applyDecorators(
		ApiOperation({
			summary: 'Obter preferencias do usuario atual',
			description:
				'Retorna todas as secoes de preferencias conhecidas; secoes nunca salvas vem com data e updatedAt nulos',
		}),
		ApiResponse({ status: 200, description: 'Preferencias retornadas' }),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
	);
}

export function ApiDocsGetPreferenceSection() {
	return applyDecorators(
		ApiOperation({
			summary: 'Obter uma secao de preferencias',
			description:
				'Retorna { data, updatedAt }; ambos nulos se a secao nunca foi salva',
		}),
		SECTION_PARAM,
		ApiResponse({ status: 200, description: 'Secao retornada' }),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
	);
}

export function ApiDocsPutPreferenceSection() {
	return applyDecorators(
		ApiOperation({
			summary: 'Salvar uma secao de preferencias',
			description:
				'Substitui a secao somente se updatedAt for mais recente que o salvo (last write wins). Retorna a secao vencedora.',
		}),
		SECTION_PARAM,
		ApiResponse({ status: 200, description: 'Secao vencedora retornada' }),
		ApiResponse(COMMON_RESPONSES.BAD_REQUEST),
		ApiResponse(COMMON_RESPONSES.UNAUTHORIZED),
		ApiResponse(COMMON_RESPONSES.NOT_FOUND),
	);
}
