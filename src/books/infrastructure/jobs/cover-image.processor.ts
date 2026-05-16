import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';
import { ScrapingService } from '@scraping/application/services/scraping.service';
import { DataSource, In, Repository } from 'typeorm';
import { QueueCoverProcessorDto } from '@books/application/dto/queue-cover-processor.dto';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { Cover } from '@books/infrastructure/database/entities/cover.entity';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';

const QUEUE_NAME = 'cover-image-queue';
const JOB_NAME = 'process-cover';

@Processor(QUEUE_NAME, { lockDuration: 120000 })
export class CoverImageProcessor extends WorkerHost implements OnModuleInit {
	private readonly logger = new Logger(CoverImageProcessor.name);

	constructor(
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
		@InjectRepository(Cover)
		private readonly coverRepository: Repository<Cover>,
		private readonly scrapingService: ScrapingService,
		private readonly dataSource: DataSource,
		private readonly configService: AppConfigService,
		private readonly eventEmitter: EventEmitter2,
	) {
		super();
	}

	onModuleInit() {
		this.worker.concurrency =
			this.configService.queueConcurrency.coverImage;
	}

	@OnWorkerEvent('active')
	async onActive(job: Job<QueueCoverProcessorDto>) {
		const { covers, bookId } = job.data;
		if (!covers || covers.length === 0) return;

		const urls = covers.map((c) => c.url);

		try {
			await this.coverRepository
				.createQueryBuilder()
				.update(Cover)
				.set({
					scrapingStatus: ScrapingStatus.PROCESS,
					retries: () => 'retries + 1',
				})
				.where('bookId = :bookId', { bookId })
				.andWhere('originalUrl IN (:...urls)', { urls })
				.execute();
		} catch (error) {
			this.logger.error(
				`Erro ao atualizar status de processamento das capas: ${error.message}`,
			);
		}
	}

	async process(job: Job<QueueCoverProcessorDto>): Promise<void> {
		const { bookId, urlOrigin } = job.data;
		// support both legacy single-cover jobs and new batch jobs
		const jobData = job.data as QueueCoverProcessorDto & {
			cover?: { url: string; title?: string };
		};
		const covers: { url: string; title?: string }[] = jobData.covers?.length
			? jobData.covers
			: jobData.cover
				? [jobData.cover]
				: [];
		this.logger.debug(
			`Processando ${covers.length} capa(s) para o livro: ${bookId}`,
		);

		const book = await this.getBook(bookId);
		if (!book) {
			this.logger.warn(
				`Livro com id ${bookId} not found para processar capa.`,
			);
			return;
		}

		try {
			// group covers by hostname so we can scrape multiple images from the same site in one driver
			const groups = new Map<string, { covers: typeof covers }>();
			for (const c of covers) {
				try {
					const host = new URL(c.url).hostname;
					const g = groups.get(host) ?? { covers: [] };
					g.covers.push(c);
					groups.set(host, g);
				} catch (e) {
					this.logger.warn(`URL inválida para capa: ${c.url}`, e);
				}
			}

			for (const [host, group] of groups) {
				const imageUrls = group.covers.map((c) => c.url);
				try {
					const savedData =
						await this.scrapingService.scrapeMultipleImages(
							urlOrigin,
							imageUrls,
						);
					// savedData are in same order as imageUrls
					for (let i = 0; i < savedData.length; i++) {
						const data = savedData[i];
						const original = group.covers[i];

						// Busca a capa para atualizar status mesmo em falha
						const coverToUpdate =
							await this.coverRepository.findOne({
								where: {
									book: { id: book.id },
									originalUrl: original.url,
								},
							});

						if (!data || data.path === 'null') {
							this.logger.warn(
								`Falha ao salvar capa ${original.url} para livro ${book.title}`,
							);

							if (coverToUpdate) {
								coverToUpdate.scrapingStatus =
									ScrapingStatus.ERROR;
								await this.coverRepository.save(coverToUpdate);
							}
							continue;
						}

						// Procura uma capa existente pela originalUrl OU pelo pHash para deduplicação visual
						const queryBuilder = this.coverRepository
							.createQueryBuilder('cover')
							.innerJoin('cover.book', 'book')
							.where('book.id = :bookId', { bookId: book.id })
							.andWhere(
								'(cover.originalUrl = :url OR (JSON_EXTRACT(cover.metadata, "$.pHash") = :pHash AND cover.metadata IS NOT NULL))',
								{
									url: original.url,
									pHash:
										data.metadata?.pHash ||
										'NO_PHASH_MATCH',
								},
							);

						const existingCover = await queryBuilder.getOne();

						let savedCover: Cover;
						if (existingCover) {
							// Atualiza a capa existente com o caminho local e dimensões
							existingCover.url = data.path;
							existingCover.metadata = data.metadata;
							existingCover.scrapingStatus = ScrapingStatus.READY;
							savedCover =
								await this.coverRepository.save(existingCover);
							this.logger.log(
								`Capa atualizada para o livro: ${book.title}`,
							);
						} else {
							// Cria nova capa (fluxo legado)
							const coverBook = this.coverRepository.create({
								title: original.title || 'Cover Image',
								url: data.path,
								metadata: data.metadata,
								originalUrl: original.url,
								book: book,
								index: book.covers.length,
								selected: book.covers.length === 0,
								scrapingStatus: ScrapingStatus.READY,
							});
							savedCover =
								await this.coverRepository.save(coverBook);
							book.covers.push(savedCover); // Update in-memory list for subsequent iterations
							this.logger.log(
								`Capa salva para o livro: ${book.title}`,
							);
						}

						// Emite evento de capa processada
						this.eventEmitter.emit('cover.processed', {
							bookId: book.id,
							coverId: savedCover.id,
							url: data.path,
						});
					}
				} catch (err) {
					this.logger.warn(
						`Falha ao baixar capas do host ${host} para o livro: ${book.title}`,
						err,
					);

					// Marcar como erro para as capas deste host
					await this.coverRepository.update(
						{
							book: { id: book.id },
							originalUrl: In(imageUrls),
						},
						{ scrapingStatus: ScrapingStatus.ERROR },
					);
				}
			}
		} catch (err) {
			this.logger.warn(
				`Erro ao processar capas para o livro: ${book.title}`,
				err,
			);
		}
	}

	private async getBook(bookId: string) {
		return await this.dataSource.manager.findOne(Book, {
			where: { id: bookId },
			relations: ['covers'],
			comment: 'force_master',
		});
	}

	@OnWorkerEvent('failed')
	async onFailed(job: Job<QueueCoverProcessorDto>) {
		this.logger.error(
			`Job de capa com id ${job.id} FAILED!`,
			job.failedReason,
		);

		const { covers, bookId } = job.data;
		if (!covers || covers.length === 0) return;

		const urls = covers.map((c) => c.url);

		try {
			await this.coverRepository.update(
				{
					book: { id: bookId },
					originalUrl: In(urls),
				},
				{ scrapingStatus: ScrapingStatus.ERROR },
			);
		} catch (error) {
			this.logger.error(
				`Erro ao atualizar status de erro das capas: ${error.message}`,
			);
		}
	}
}
