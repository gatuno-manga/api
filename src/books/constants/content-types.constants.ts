import { DocumentFormat } from '../enum/document-format.enum';

/**
 * Mimetypes aceitos para upload de documentos
 */
export const ALLOWED_DOCUMENT_MIMETYPES = [
	'application/pdf',
	'application/epub+zip',
	'application/x-epub+zip',
];

/**
 * Tamanho máximo de documento em bytes (50MB)
 */
export const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024;

/**
 * Mapeamento de mimetype para DocumentFormat
 */
export const MIMETYPE_TO_FORMAT: Record<string, DocumentFormat> = {
	'application/pdf': DocumentFormat.PDF,
	'application/epub+zip': DocumentFormat.EPUB,
	'application/x-epub+zip': DocumentFormat.EPUB,
};

/**
 * Mapeamento de DocumentFormat para extensão de arquivo
 */
export const FORMAT_TO_EXTENSION: Record<DocumentFormat, string> = {
	[DocumentFormat.PDF]: '.pdf',
	[DocumentFormat.EPUB]: '.epub',
};
