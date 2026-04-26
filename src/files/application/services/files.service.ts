import { Injectable, Logger, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { StorageBucket } from '../../../common/enum/storage-bucket.enum';
import { FileCompressorFactory } from '../../infrastructure/adapters/file-compressor.factory';
import { StoragePort } from '../ports/storage.port';
import { EventPublisherPort } from '../ports/event-publisher.port';

@Injectable()
export class FilesService {
	private readonly logger = new Logger(FilesService.name);

	constructor(
		private readonly compressorFactory: FileCompressorFactory,
		@Inject('STORAGE_PORT') private readonly storagePort: StoragePort,
		@Inject('EVENT_PUBLISHER_PORT')
		private readonly eventPublisher: EventPublisherPort,
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

	/**
	 * @deprecated O microserviço Go agora lida com a compressão
	 */
	async compressFile(
		base64Data: string,
		extension: string,
	): Promise<{ buffer: Buffer; extension: string }> {
		const buffer = Buffer.from(base64Data, 'base64');
		return await this.compressorFactory.compress(buffer, extension);
	}

	/**
	 * Implementação centralizada de salvamento com processamento assíncrono via Kafka
	 * @private
	 */
	private async saveFileInternal(
		buffer: Buffer,
		extension: string,
		targetBucket: StorageBucket = StorageBucket.BOOKS,
	): Promise<string> {
		const cleanExtension = extension.startsWith('.')
			? extension
			: `.${extension}`;
		const uuid = uuidv4();
		const shard = uuid.substring(0, 2);

		// 1. Salva o arquivo ORIGINAL no bucket de processamento
		const rawFileName = `${uuid}${cleanExtension}`;
		const rawKey = `${shard}/${rawFileName}`;

		let mimeType = 'application/octet-stream';
		if (cleanExtension === '.jpg' || cleanExtension === '.jpeg')
			mimeType = 'image/jpeg';
		if (cleanExtension === '.png') mimeType = 'image/png';
		if (cleanExtension === '.webp') mimeType = 'image/webp';

		await this.storagePort.save(
			buffer,
			rawKey,
			mimeType,
			StorageBucket.PROCESSING,
		);

		// 2. Prepara os dados para o Kafka
		const targetFileName = `${uuid}.webp`;
		const targetKey = `${shard}/${targetFileName}`;

		await this.eventPublisher.publishImageProcessingRequest({
			rawPath: `processing/${rawKey}`,
			targetBucket: targetBucket,
			targetPath: targetKey,
		});

		this.logger.log(
			`[KAFKA] Evento enviado: processing/${rawKey} -> ${targetBucket}/${targetKey}`,
		);

		// 3. RETORNO CRÍTICO:
		// Retornamos o caminho iniciando com "processing/" para que o banco saiba que
		// a imagem ainda não está no bucket final.
		// O front-end usará a URL /api/data/processing/${shard}/${filename}
		return `processing/${rawKey}`;
	}

	/**
	 * Salva um arquivo que supostamente já foi comprimido
	 */
	async savePreCompressedFile(
		buffer: Buffer,
		extension: string,
		bucket?: StorageBucket,
	): Promise<string> {
		return this.saveFileInternal(buffer, extension, bucket);
	}

	/**
	 * Salva um arquivo a partir de um Buffer
	 */
	async saveBufferFile(
		buffer: Buffer,
		extension: string,
		bucket: StorageBucket = StorageBucket.BOOKS,
	): Promise<string> {
		return this.saveFileInternal(buffer, extension, bucket);
	}

	/**
	 * Salva um arquivo a partir de uma string base64
	 */
	async saveBase64File(
		base64Data: string,
		extension: string,
		bucket?: StorageBucket,
	): Promise<string> {
		const buffer = Buffer.from(base64Data, 'base64');
		return this.saveFileInternal(buffer, extension, bucket);
	}

	/**
	 * Obtém o buffer de um arquivo do storage com detecção automática de bucket e fallback
	 */
	async getFileBuffer(
		storedPath: string,
		bucket?: StorageBucket,
	): Promise<Buffer> {
		const isProcessing = storedPath.includes('processing/');
		const fileKey = this.extractKey(storedPath, bucket);

		// 1. Tentar o bucket explicitamente solicitado ou detectado pelo path
		const primaryBucket =
			bucket ||
			(isProcessing ? StorageBucket.PROCESSING : StorageBucket.BOOKS);

		try {
			return await this.storagePort.getBuffer(fileKey, primaryBucket);
		} catch (error) {
			// 2. Fallback: Se falhou no BOOKS, tentar no PROCESSING (e vice-versa)
			const fallbackBucket =
				primaryBucket === StorageBucket.BOOKS
					? StorageBucket.PROCESSING
					: StorageBucket.BOOKS;

			try {
				this.logger.debug(
					`File not found in ${primaryBucket}, trying fallback ${fallbackBucket}: ${fileKey}`,
				);
				return await this.storagePort.getBuffer(
					fileKey,
					fallbackBucket,
				);
			} catch (fallbackError) {
				// 3. Última tentativa: Bucket default (sem especificar bucket no adapter)
				try {
					this.logger.debug(
						`File not found in ${fallbackBucket}, trying default bucket: ${fileKey}`,
					);
					return await this.storagePort.getBuffer(fileKey);
				} catch (finalError) {
					this.logger.error(
						`Failed to retrieve file from any bucket: ${fileKey}`,
					);
					throw error; // Lança o erro original (ou o mais relevante)
				}
			}
		}
	}

	/**
	 * Deleta um arquivo do storage
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
	 * Extrai a chave do arquivo removendo prefixos de bucket e staging
	 * @private
	 */
	private extractKey(path: string, bucket?: string): string {
		// Remove prefixos comuns para pegar apenas a Key (shard/filename)
		let key = path.replace(/^\/?(api\/)?data\//, '').replace(/^\//, '');

		// Se o caminho salvo no banco começa com "processing/", removemos para a Key do S3
		if (key.startsWith('processing/')) {
			key = key.replace('processing/', '');
		}

		// Se houver um bucket específico (ex: "users/"), removemos também
		if (bucket && key.startsWith(`${bucket}/`)) {
			key = key.replace(`${bucket}/`, '');
		}

		return key;
	}
}
