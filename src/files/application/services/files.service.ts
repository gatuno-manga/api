import { Injectable, Logger, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { StorageBucket } from '../../../common/enum/storage-bucket.enum';
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
		bucket?: StorageBucket,
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

		return await this.storagePort.save(buffer, fileKey, mimeType, bucket);
	}

	/**
	 * Salva um arquivo que já foi comprimido (sem recompressão)
	 * @param buffer Buffer contendo os dados já comprimidos
	 * @param extension Extensão final do arquivo (ex: '.webp')
	 * @param bucket Bucket opcional para salvar o arquivo
	 * @returns Caminho público do arquivo salvo
	 */
	async savePreCompressedFile(
		buffer: Buffer,
		extension: string,
		bucket?: StorageBucket,
	): Promise<string> {
		return this.saveFileInternal(buffer, extension, bucket);
	}

	/**
	 * Salva um arquivo a partir de um Buffer (mais performático)
	 * @param buffer Buffer contendo os dados do arquivo
	 * @param extension Extensão do arquivo (ex: '.jpg', '.png')
	 * @param bucket Bucket opcional para salvar o arquivo
	 * @returns Caminho público do arquivo salvo
	 */
	async saveBufferFile(
		buffer: Buffer,
		extension: string,
		bucket?: StorageBucket,
	): Promise<string> {
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

		return this.saveFileInternal(fileBuffer, finalExtension, bucket);
	}

	/**
	 * Salva um arquivo a partir de uma string base64
	 * @deprecated Use saveBufferFile para melhor performance quando possível
	 * @param base64Data String base64 contendo os dados do arquivo
	 * @param extension Extensão do arquivo (ex: '.jpg', '.png')
	 * @param bucket Bucket opcional para salvar o arquivo
	 * @returns Caminho público do arquivo salvo
	 */
	async saveBase64File(
		base64Data: string,
		extension: string,
		bucket?: StorageBucket,
	): Promise<string> {
		const buffer = Buffer.from(base64Data, 'base64');
		return this.saveBufferFile(buffer, extension, bucket);
	}

	/**
	 * Obtém o buffer de um arquivo do storage
	 * @param storedPath Caminho guardado no banco (key ou /data/key)
	 * @param bucket Bucket opcional
	 */
	async getFileBuffer(
		storedPath: string,
		bucket?: StorageBucket,
	): Promise<Buffer> {
		const fileKey = this.extractKey(storedPath, bucket);
		return await this.storagePort.getBuffer(fileKey, bucket);
	}

	/**
	 * Deleta um arquivo do storage
	 * @param storedPath Caminho guardado no banco (pode ser a key ou /data/key)
	 * @param bucket Bucket opcional
	 */
	async deleteFile(
		storedPath: string,
		bucket?: StorageBucket,
	): Promise<void> {
		try {
			const fileKey = this.extractKey(storedPath, bucket);
			await this.storagePort.delete(fileKey, bucket);
			this.logger.log(
				`Arquivo deletado do Storage: ${fileKey} em ${bucket || 'default'}`,
			);
		} catch (error) {
			this.logger.warn(`Erro ao deletar arquivo ${storedPath}:`, error);
		}
	}

	/**
	 * Extrai a chave do arquivo removendo prefixos de bucket e legacy data
	 * @private
	 */
	private extractKey(path: string, bucket?: string): string {
		let key = path.replace(/^\/?(api\/)?data\//, '').replace(/^\//, '');

		if (bucket && key.startsWith(`${bucket}/`)) {
			key = key.replace(`${bucket}/`, '');
		}

		return key;
	}
}
