import { Injectable, Logger, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { FileCompressorFactory } from '../../infrastructure/adapters/file-compressor.factory';
import { StoragePort } from '../ports/storage.port';

@Injectable()
export class FilesService {
	private readonly logger = new Logger(FilesService.name);

	constructor(
		private readonly compressorFactory: FileCompressorFactory,
		@Inject('STORAGE_PORT') private readonly storagePort: StoragePort,
	) {}

	private getPublicPath(fileKey: string): string {
		return `/data/${fileKey}`;
	}

	/**
	 * Returns the compressor factory for external use (e.g., NetworkInterceptor)
	 */
	getCompressorFactory(): FileCompressorFactory {
		return this.compressorFactory;
	}

	async compressFile(
		base64Data: string,
		extension: string,
	): Promise<{ buffer: Buffer; extension: string }> {
		const buffer = Buffer.from(base64Data, 'base64');
		return await this.compressorFactory.compress(buffer, extension);
	}

	/**
	 * Implementação interna de salvamento com sharding (2 caracteres) no S3
	 * @private
	 */
	private async saveFileInternal(
		buffer: Buffer,
		extension: string,
	): Promise<string> {
		const uuid = uuidv4();
		const shard = uuid.substring(0, 2);
		const fileName = `${uuid}${extension}`;
		const fileKey = `${shard}/${fileName}`;

		let mimeType = 'application/octet-stream';
		if (extension === '.webp') mimeType = 'image/webp';
		if (extension === '.jpg' || extension === '.jpeg')
			mimeType = 'image/jpeg';
		if (extension === '.png') mimeType = 'image/png';

		return await this.storagePort.save(buffer, fileKey, mimeType);
	}

	/**
	 * Salva um arquivo que já foi comprimido (sem recompressão)
	 * @param buffer Buffer contendo os dados já comprimidos
	 * @param extension Extensão final do arquivo (ex: '.webp')
	 * @returns Caminho público do arquivo salvo
	 */
	async savePreCompressedFile(
		buffer: Buffer,
		extension: string,
	): Promise<string> {
		return this.saveFileInternal(buffer, extension);
	}

	/**
	 * Salva um arquivo a partir de um Buffer (mais performático)
	 * @param buffer Buffer contendo os dados do arquivo
	 * @param extension Extensão do arquivo (ex: '.jpg', '.png')
	 * @returns Caminho público do arquivo salvo
	 */
	async saveBufferFile(buffer: Buffer, extension: string): Promise<string> {
		let fileBuffer: Buffer;
		let finalExtension = extension;

		if (this.compressorFactory.hasCompressor(extension)) {
			try {
				const result = await this.compressorFactory.compress(
					buffer,
					extension,
				);
				fileBuffer = result.buffer;
				finalExtension = result.extension;
				this.logger.log(
					`Arquivo comprimido: ${extension} -> ${finalExtension}`,
				);
			} catch (error) {
				this.logger.error(
					'Erro ao comprimir arquivo, salvando original:',
					error,
				);
				fileBuffer = buffer;
			}
		} else {
			this.logger.debug(
				`Nenhum compressor disponível para ${extension}, salvando original`,
			);
			fileBuffer = buffer;
		}

		return this.saveFileInternal(fileBuffer, finalExtension);
	}

	/**
	 * Salva um arquivo a partir de uma string base64
	 * @deprecated Use saveBufferFile para melhor performance quando possível
	 * @param base64Data String base64 contendo os dados do arquivo
	 * @param extension Extensão do arquivo (ex: '.jpg', '.png')
	 * @returns Caminho público do arquivo salvo
	 */
	async saveBase64File(
		base64Data: string,
		extension: string,
	): Promise<string> {
		const buffer = Buffer.from(base64Data, 'base64');
		return this.saveBufferFile(buffer, extension);
	}

	/**
	 * Obtém o buffer de um arquivo do storage
	 * @param storedPath Caminho guardado no banco (key ou /data/key)
	 */
	async getFileBuffer(storedPath: string): Promise<Buffer> {
		const fileKey = storedPath.replace(/^\/data\//, '');
		return await this.storagePort.getBuffer(fileKey);
	}

	/**
	 * Deleta um arquivo do storage
	 * @param storedPath Caminho guardado no banco (pode ser a key ou /data/key)
	 */
	async deleteFile(storedPath: string): Promise<void> {
		try {
			// Normaliza a key removendo o prefixo /data/ se existir
			const fileKey = storedPath.replace(/^\/data\//, '');
			await this.storagePort.delete(fileKey);
			this.logger.log(`Arquivo deletado do Storage: ${fileKey}`);
		} catch (error) {
			this.logger.warn(`Erro ao deletar arquivo ${storedPath}:`, error);
		}
	}
}
