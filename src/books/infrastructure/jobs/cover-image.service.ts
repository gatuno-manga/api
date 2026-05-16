import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { FilesService } from '@files/application/services/files.service';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import { IsNull, Repository } from 'typeorm';
import { QueueCoverProcessorDto } from '@books/application/dto/queue-cover-processor.dto';
import { UrlImageDto } from '@books/application/dto/url-image.dto';
import { Cover } from '@books/infrastructure/database/entities/cover.entity';
import { createHash } from 'node:crypto';

const QUEUE_NAME = 'cover-image-queue';
const JOB_NAME = 'process-cover';

@Injectable()
export class CoverImageService {
	private readonly logger = new Logger(CoverImageService.name);

	constructor(
		@InjectQueue(QUEUE_NAME)
		private readonly coverImageQueue: Queue<QueueCoverProcessorDto>,
		@InjectRepository(Cover)
		private readonly coverRepository: Repository<Cover>,
		private readonly filesService: FilesService,
	) {}

	/**
	 * Adiciona um job de capa à fila.
	 * Usa jobId único com timestamp para permitir reprocessamento.
	 */
	public async addCoverToQueue(
		bookId: string,
		urlOrigin: string,
		covers: UrlImageDto[],
	): Promise<void> {
		const jobId = `cover-image-${bookId}-${Date.now()}`;

		try {
			await this.coverImageQueue.add(
				JOB_NAME,
				{ bookId, urlOrigin, covers },
				{ jobId },
			);
			this.logger.debug(
				`Adicionando job de capa (batch) para o livro: ${bookId}`,
			);
		} catch (error) {
			if (error.message?.includes('Job with this id already exists')) {
				this.logger.debug(
					`Job de capa para o livro ${bookId} já está na fila.`,
				);
			} else {
				throw error;
			}
		}
	}

	/**
	 * Adiciona um job de capa à fila por ID da capa.
	 */
	public async addCoverToQueueById(coverId: string): Promise<void> {
		const cover = await this.coverRepository.findOne({
			where: { id: coverId },
			relations: ['book'],
		});

		if (!cover) {
			this.logger.warn(`Capa com id ${coverId} não encontrada.`);
			return;
		}

		if (!cover.originalUrl) {
			this.logger.warn(`Capa ${coverId} não possui URL original.`);
			return;
		}

		const bookId = cover.book.id;
		const urlOrigin = cover.book.originalUrl?.[0] || '';
		const jobId = `cover-image-single-${coverId}-${Date.now()}`;

		try {
			await this.coverImageQueue.add(
				JOB_NAME,
				{
					bookId,
					urlOrigin,
					covers: [{ url: cover.originalUrl, title: cover.title }],
				},
				{ jobId },
			);
			this.logger.debug(
				`Adicionando job de capa individual para o livro: ${bookId} (Capa: ${coverId})`,
			);
		} catch (error) {
			this.logger.error(
				`Erro ao adicionar job para capa ${coverId}: ${error.message}`,
			);
			throw error;
		}
	}

	/**
	 * Calcula o hash SHA-256 de um arquivo no storage.
	 * O Scraper externo agora cuida de baixar as imagens, então a API só calcula hash de arquivos locais.
	 */
	async calculateLocalImageHash(storagePath: string): Promise<string> {
		try {
			const buffer = await this.filesService.getFileBuffer(
				storagePath,
				StorageBucket.BOOKS,
			);
			return createHash('sha256').update(buffer).digest('hex');
		} catch (error) {
			this.logger.error(
				`Failed to read image buffer from storage for hash: ${storagePath}`,
				error,
			);
			throw error;
		}
	}

	/**
	 * Recalcula hashes de capas que não possuem imageHash.
	 */
	async recalculateMissingCoverHashes(): Promise<void> {
		const covers = await this.coverRepository.find({
			where: { imageHash: IsNull() },
		});

		if (covers.length === 0) return;

		this.logger.debug(
			`Iniciando recalculo de hash para ${covers.length} capas.`,
		);

		for (const cover of covers) {
			if (cover.url && !cover.url.startsWith('http')) {
				try {
					const hash = await this.calculateLocalImageHash(cover.url);
					await this.coverRepository.update(cover.id, {
						imageHash: hash,
					});
				} catch (error) {
					// Ignora erros individuais
				}
			}
		}
	}
}
