import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { ScrapingService } from 'src/scraping/scraping.service';
import { IsNull, Repository } from 'typeorm';
import { QueueCoverProcessorDto } from '../dto/queue-cover-processor.dto';
import { UrlImageDto } from '../dto/url-image.dto';
import { Cover } from '../entitys/cover.entity';

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
		private readonly scrapingService: ScrapingService,
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
	 * Calcula o hash SHA-256 do conteúdo de uma imagem.
	 * Suporta tanto URLs HTTP/HTTPS quanto caminhos de arquivo locais.
	 * @param imageSource URL ou caminho local da imagem
	 * @param refererUrl URL de origem para usar como referer (opcional)
	 * @returns Hash da imagem em hexadecimal
	 */
	async calculateImageHash(
		imageSource: string,
		refererUrl?: string,
	): Promise<string> {
		let buffer: Buffer;

		if (
			imageSource.startsWith('http://') ||
			imageSource.startsWith('https://')
		) {
			const pageUrl = refererUrl || new URL(imageSource).origin;

			try {
				buffer = await this.scrapingService.fetchImageBuffer(
					pageUrl,
					imageSource,
				);
			} catch (error) {
				this.logger.error(
					`Failed to download image for hash calculation: ${imageSource} (referer: ${pageUrl})`,
					error,
				);
				throw error;
			}
		} else {
			const realPath = imageSource.startsWith('/data/')
				? imageSource.replace('/data/', '/usr/src/app/data/')
				: imageSource;

			buffer = await readFile(realPath);
		}

		return createHash('sha256').update(buffer).digest('hex');
	}

	/**
	 * Recalcula o hash das capas existentes que ainda não têm imageHash preenchido.
	 * Isso é necessário para capas que foram cadastradas antes da implementação do sistema de deduplicação.
	 */
	async recalculateMissingCoverHashes(): Promise<void> {
		const coversWithoutHash = await this.coverRepository.find({
			where: { imageHash: IsNull() },
			relations: ['book'],
		});

		if (coversWithoutHash.length === 0) {
			this.logger.debug('No covers without hash found');
			return;
		}

		this.logger.log(
			`Found ${coversWithoutHash.length} covers without hash. Recalculating...`,
		);

		let successCount = 0;
		let errorCount = 0;

		for (const cover of coversWithoutHash) {
			try {
				const refererUrl = cover.book?.originalUrl?.[0];
				const imageHash = await this.calculateImageHash(
					cover.url,
					refererUrl,
				);
				cover.imageHash = imageHash;
				await this.coverRepository.save(cover);
				successCount++;
			} catch (error) {
				this.logger.warn(
					`Failed to calculate hash for cover ${cover.id} (${cover.url}): ${error.message}`,
				);
				errorCount++;
			}
		}

		this.logger.log(
			`Cover hash recalculation complete: ${successCount} success, ${errorCount} errors`,
		);
	}
}
