export const MULTIPART_SCHEMAS = {
	IMAGE_FILE_WITH_OPTIONAL_TITLE: {
		type: 'object',
		properties: {
			file: {
				type: 'string',
				format: 'binary',
				description: 'Arquivo de imagem (JPG, PNG, WEBP)',
			},
			title: {
				type: 'string',
				description: 'Titulo opcional',
				maxLength: 200,
			},
		},
		required: ['file'],
	},
	MULTIPLE_IMAGE_FILES: {
		type: 'object',
		properties: {
			files: {
				type: 'array',
				items: {
					type: 'string',
					format: 'binary',
				},
				description: 'Arquivos de imagem (maximo 10)',
			},
		},
		required: ['files'],
	},
	CHAPTER_PAGES_UPLOAD: {
		type: 'object',
		properties: {
			pages: {
				type: 'array',
				items: {
					type: 'string',
					format: 'binary',
				},
				description: 'Arquivos de paginas (maximo 100)',
			},
			indices: {
				type: 'string',
				description: 'Array JSON com os indices das paginas',
				example: '[1,2,3,4,5]',
			},
		},
		required: ['pages', 'indices'],
	},
	DOCUMENT_FILE_WITH_OPTIONAL_TITLE: {
		type: 'object',
		properties: {
			file: {
				type: 'string',
				format: 'binary',
				description: 'Arquivo do documento (PDF ou EPUB, maximo 50MB)',
			},
			title: {
				type: 'string',
				description: 'Titulo opcional do capitulo',
				maxLength: 500,
			},
		},
		required: ['file'],
	},
	SINGLE_IMAGE_FILE: {
		type: 'object',
		properties: {
			file: {
				type: 'string',
				format: 'binary',
			},
		},
		required: ['file'],
	},
};
