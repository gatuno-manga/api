import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Not, Repository } from 'typeorm';
import { Chapter } from '../entitys/chapter.entity';
import { ContentType } from '../enum/content-type.enum';
import { ScrapingStatus } from '../enum/scrapingStatus.enum';

const QUEUE_NAME = 'chapter-scraping';
const JOB_NAME = 'process-chapter';

@Injectable()
export class ChapterScrapingService {
	private readonly logger = new Logger(ChapterScrapingService.name);

	constructor(
		@InjectQueue(QUEUE_NAME)
		private readonly chapterScrapingQueue: Queue<string>,
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
	) {}

	/**
	 * Adiciona um capítulo à fila de scraping.
	 * Remove jobs antigos (completados/falhos) antes de adicionar para permitir reprocessamento.
	 */
	public async addChapterToQueue(chapterId: string): Promise<void> {
		const jobId = `chapter-scraping-${chapterId}`;

		try {
			// Remove job anterior se existir (completado ou falho)
			const existingJob = await this.chapterScrapingQueue.getJob(jobId);
			if (existingJob) {
				const state = await existingJob.getState();
				if (state === 'completed' || state === 'failed') {
					await existingJob.remove();
					this.logger.debug(
						`Job anterior removido para capítulo: ${chapterId} (estado: ${state})`,
					);
				} else if (
					state === 'active' ||
					state === 'waiting' ||
					state === 'delayed'
				) {
					this.logger.debug(
						`Job para capítulo ${chapterId} já está ${state}, ignorando`,
					);
					return;
				}
			}

			await this.chapterScrapingQueue.add(JOB_NAME, chapterId, { jobId });
			this.logger.debug(`Adicionando job para o capítulo: ${chapterId}`);
		} catch (error) {
			// Job com mesmo ID já existe na fila
			if (error.message?.includes('Job with this id already exists')) {
				this.logger.debug(
					`Job para o capítulo ${chapterId} já está na fila.`,
				);
			} else {
				this.logger.error(
					`Erro ao adicionar job para capítulo ${chapterId}: ${error.message}`,
				);
				throw error;
			}
		}
	}

	public async scheduleAllPendingChapters(): Promise<void> {
		this.logger.log(
			'Buscando todos os capítulos pendentes para enfileirar...',
		);

		// Apenas capítulos do tipo IMAGE precisam de scraping
		// Capítulos TEXT e DOCUMENT têm conteúdo enviado manualmente
		const pendingChapters = await this.chapterRepository.find({
			where: {
				scrapingStatus: Not(ScrapingStatus.READY),
				contentType: ContentType.IMAGE,
			},
			select: ['id'],
		});

		for (const chapter of pendingChapters) {
			await this.addChapterToQueue(chapter.id);
		}

		this.logger.log(
			`${pendingChapters.length} capítulos pendentes foram adicionados à fila.`,
		);
	}
}
