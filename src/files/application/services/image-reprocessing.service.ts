import { AppConfigService } from '@/infrastructure/app-config/app-config.service';
import { COVER_VARIANT_WIDTHS } from '@books/domain/constants/cover.constants';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import type { EventPublisherPort } from '@files/application/ports/event-publisher.port';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface ReprocessRecord {
	id: string | number;
	path: string;
}

interface ReprocessTable {
	name: string;
	pathColumn: string;
	bucket: StorageBucket;
	/** Só capas recebem variantes por enquanto (ver cover.constants.ts). */
	widths?: number[];
}

const TABLES: ReprocessTable[] = [
	{ name: 'user_images', pathColumn: 'path', bucket: StorageBucket.USERS },
	{
		name: 'covers',
		pathColumn: 'url',
		bucket: StorageBucket.BOOKS,
		widths: COVER_VARIANT_WIDTHS,
	},
	{ name: 'pages', pathColumn: 'path', bucket: StorageBucket.BOOKS },
];

/**
 * Identifica e reenvia ao file-processor imagens que precisam de processamento:
 * uploads que nunca terminaram, imagens sem metadados e (só capas) imagens sem
 * variantes de resolução menor. Usado tanto pelo cron recorrente quanto pelo
 * endpoint admin de disparo manual.
 */
@Injectable()
export class ImageReprocessingService {
	private readonly logger = new Logger(ImageReprocessingService.name);

	constructor(
		private readonly dataSource: DataSource,
		@Inject('EVENT_PUBLISHER_PORT')
		private readonly eventPublisher: EventPublisherPort,
		private readonly appConfigService: AppConfigService,
	) {}

	/**
	 * Varre as 3 tabelas e reenfileira tudo que precisa de (re)processamento.
	 * Paginado por id e limitado a `batchSize` por tabela por execução, para
	 * não afogar o file-processor (que ainda é serial/1-CPU por imagem).
	 */
	async reprocessAll(): Promise<{ totalRequested: number }> {
		this.logger.log(
			'🚀 Iniciando varredura de reprocessamento de imagens...',
		);

		const batchSize = this.appConfigService.imageReprocessing.batchSize;
		let totalRequested = 0;

		for (const table of TABLES) {
			const stuck = await this.reprocessStuck(table, batchSize);
			const outdated = await this.reprocessOutdated(table, batchSize);
			totalRequested += stuck + outdated;
		}

		this.logger.log(
			`🎉 Varredura finalizada. Total de ${totalRequested} solicitações enviadas ao Kafka.`,
		);

		return { totalRequested };
	}

	/**
	 * Caso A: o raw ainda está em "processing/" e não terminou de virar a
	 * rendition final (falha, restart no meio, etc). Republica como processamento
	 * normal — o file-processor faz o encode e, se for capa, já gera as variantes.
	 */
	private async reprocessStuck(
		table: ReprocessTable,
		batchSize: number,
	): Promise<number> {
		const stuckThresholdHours =
			this.appConfigService.imageReprocessing.stuckThresholdHours;
		const stuckBefore = new Date();
		stuckBefore.setHours(stuckBefore.getHours() - stuckThresholdHours);

		const sql = [
			`SELECT id, ${table.pathColumn} as path FROM ${table.name}`,
			`WHERE ${table.pathColumn} LIKE 'processing/%' AND updatedAt < ?`,
			'ORDER BY id ASC LIMIT ?',
		].join(' ');

		const records: ReprocessRecord[] = await this.dataSource.query(sql, [
			stuckBefore,
			batchSize,
		]);

		let requested = 0;
		for (const record of records) {
			const rawKey = record.path.substring('processing/'.length);
			const targetPath = rawKey.replace(/\.[a-zA-Z0-9]+$/, '.webp');

			const published = await this.publish(table, {
				rawPath: record.path,
				targetPath,
				isBackfill: false,
			});
			if (published) requested++;
		}

		if (records.length > 0) {
			this.logger.log(
				`   -> [${table.name}] ${records.length} imagem(ns) travada(s) em processing/ reenviada(s).`,
			);
		}

		return requested;
	}

	/**
	 * Casos B e C: já está no bucket final, mas falta metadata (pHash) ou,
	 * exclusivamente para capas, faltam variantes de resolução menor.
	 * isBackfill:true evita reencodar a imagem original.
	 */
	private async reprocessOutdated(
		table: ReprocessTable,
		batchSize: number,
	): Promise<number> {
		const missingVariantsClause = table.widths
			? ` OR (variants IS NULL AND JSON_EXTRACT(metadata, '$.width') >= ${Math.min(...table.widths)})`
			: '';

		const sql = [
			`SELECT id, ${table.pathColumn} as path FROM ${table.name}`,
			`WHERE ${table.pathColumn} NOT LIKE 'processing/%'`,
			`AND ${table.pathColumn} NOT LIKE 'http%'`,
			`AND ((metadata IS NULL OR JSON_EXTRACT(metadata, '$.pHash') IS NULL)${missingVariantsClause})`,
			'ORDER BY id ASC LIMIT ?',
		].join(' ');

		const records: ReprocessRecord[] = await this.dataSource.query(sql, [
			batchSize,
		]);

		let requested = 0;
		for (const record of records) {
			const published = await this.publish(table, {
				rawPath: `${table.bucket}/${record.path}`,
				targetPath: record.path,
				isBackfill: true,
			});
			if (published) requested++;
		}

		if (records.length > 0) {
			this.logger.log(
				`   -> [${table.name}] ${records.length} imagem(ns) sem metadata/variantes reenviada(s).`,
			);
		}

		return requested;
	}

	private async publish(
		table: ReprocessTable,
		event: { rawPath: string; targetPath: string; isBackfill: boolean },
	): Promise<boolean> {
		try {
			await this.eventPublisher.publishImageProcessingRequest({
				rawPath: event.rawPath,
				targetBucket: table.bucket,
				targetPath: event.targetPath,
				isBackfill: event.isBackfill,
				widths: table.widths,
			});
			return true;
		} catch (err) {
			this.logger.error(
				`   ❌ Erro ao publicar ${event.rawPath}: ${err instanceof Error ? err.message : String(err)}`,
			);
			return false;
		}
	}

	/**
	 * Reprocessamento pontual de uma capa específica, para corrigir na hora sem
	 * esperar o cron.
	 */
	async reprocessCoverById(coverId: string): Promise<boolean> {
		const [cover]: ReprocessRecord[] = await this.dataSource.query(
			'SELECT id, url as path FROM covers WHERE id = ?',
			[coverId],
		);

		if (!cover) {
			this.logger.warn(
				`Capa ${coverId} não encontrada para reprocessar.`,
			);
			return false;
		}

		const coversTable = TABLES.find((t) => t.name === 'covers');
		if (!coversTable) {
			throw new Error('Configuração da tabela "covers" não encontrada.');
		}

		if (cover.path.startsWith('http')) {
			this.logger.warn(
				`Capa ${coverId} aponta para uma URL externa, não pode ser reprocessada.`,
			);
			return false;
		}

		if (cover.path.startsWith('processing/')) {
			const rawKey = cover.path.substring('processing/'.length);
			const targetPath = rawKey.replace(/\.[a-zA-Z0-9]+$/, '.webp');
			return this.publish(coversTable, {
				rawPath: cover.path,
				targetPath,
				isBackfill: false,
			});
		}

		return this.publish(coversTable, {
			rawPath: `${coversTable.bucket}/${cover.path}`,
			targetPath: cover.path,
			isBackfill: true,
		});
	}
}
