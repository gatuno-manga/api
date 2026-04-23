export interface FileMetadata {
	filename: string;
	size: number;
	mtime: Date;
}

export interface StoragePort {
	/**
	 * Salva um buffer no storage e retorna o caminho público
	 */
	save(buffer: Buffer, fileKey: string, mimeType?: string): Promise<string>;

	/**
	 * Deleta um arquivo do storage
	 */
	delete(fileKey: string): Promise<void>;

	/**
	 * Verifica se um arquivo existe
	 */
	exists(fileKey: string): Promise<boolean>;

	/**
	 * Obtém metadados de um arquivo
	 */
	getStats(fileKey: string): Promise<FileMetadata>;

	/**
	 * Obtém o buffer de um arquivo
	 */
	getBuffer(fileKey: string): Promise<Buffer>;

	/**
	 * Lista todos os arquivos do storage de forma assíncrona (Streaming)
	 */
	listAllFiles(): AsyncGenerator<FileMetadata>;
}
