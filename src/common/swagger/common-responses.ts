export const COMMON_RESPONSES = {
	BAD_REQUEST: {
		status: 400,
		description: 'Requisicao invalida',
	},
	UNAUTHORIZED: {
		status: 401,
		description: 'Nao autorizado',
	},
	FORBIDDEN_ADMIN: {
		status: 403,
		description: 'Proibido - perfil de administrador obrigatorio',
	},
	NOT_FOUND: {
		status: 404,
		description: 'Recurso nao encontrado',
	},
	TOO_MANY_REQUESTS: {
		status: 429,
		description: 'Muitas requisicoes',
	},
};
