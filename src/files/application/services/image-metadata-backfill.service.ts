import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import type { EventPublisherPort } from '@files/application/ports/event-publisher.port';

@Injectable()
export class ImageMetadataBackfillService {
	private readonly logger = new Logger(ImageMetadataBackfillService.name);

	constructor(
		private readonly dataSource: DataSource,
		@Inject('EVENT_PUBLISHER_PORT')
		private readonly eventPublisher: EventPublisherPort,
	) {}

	async backfill(): Promise<{ totalProcessed: number }> {
		this.logger.log('🚀 Iniciando Backfill de Metadados de Imagens...');

		const tables = [
			{
				name: 'user_images',
				pathColumn: 'path',
				bucket: StorageBucket.USERS,
				query: "SELECT id, path FROM user_images WHERE (metadata IS NULL OR JSON_EXTRACT(metadata, '$.pHash') IS NULL) AND id > ? ORDER BY id ASC LIMIT 1000",
			},
			{
				name: 'covers',
				pathColumn: 'url',
				bucket: StorageBucket.BOOKS,
				query: "SELECT id, url as path FROM covers WHERE (metadata IS NULL OR JSON_EXTRACT(metadata, '$.pHash') IS NULL) AND id > ? ORDER BY id ASC LIMIT 1000",
			},
			{
				name: 'pages',
				pathColumn: 'path',
				bucket: StorageBucket.BOOKS,
				query: "SELECT id, path FROM pages WHERE (metadata IS NULL OR JSON_EXTRACT(metadata, '$.pHash') IS NULL) AND id > ? ORDER BY id ASC LIMIT 1000",
			},
		];

		let totalProcessed = 0;

		for (const table of tables) {
			this.logger.log(`📦 Processando tabela: ${table.name}`);

			let lastId: string | number = '';
			let hasMore = true;

			while (hasMore) {
				const records = await this.dataSource.query(table.query, [
					lastId,
				]);

				if (records.length === 0) {
					if (lastId === '') {
						this.logger.log(
							`   ✅ Todos os registros de ${table.name} já possuem metadados completos.`,
						);
					}
					hasMore = false;
					continue;
				}

				this.logger.log(
					`   -> Processando lote de ${records.length} registros (ID > ${lastId || 'início'})...`,
				);

				for (const record of records) {
					const fullPath = record.path; // Ex: "books/ab/uuid.webp"

					// Extrair targetPath (remover o bucket do início)
					const targetPath = fullPath.substring(
						table.bucket.length + 1,
					);

					try {
						await this.eventPublisher.publishImageProcessingRequest(
							{
								rawPath: fullPath,
								targetBucket: table.bucket,
								targetPath: targetPath,
								isBackfill: true,
							},
						);
						totalProcessed++;

						if (totalProcessed % 100 === 0) {
							this.logger.log(
								`   ⏳ Processados ${totalProcessed} registros no total...`,
							);
						}
					} catch (err) {
						this.logger.error(
							`   ❌ Erro ao publicar ${fullPath}: ${err.message}`,
						);
					}
					lastId = record.id;
				}

				if (records.length < 1000) {
					hasMore = false;
				}
			}
		}

		this.logger.log(
			`\n🎉 Backfill finalizado! Total de ${totalProcessed} solicitações enviadas ao Kafka.`,
		);

		return { totalProcessed };
	}
}
