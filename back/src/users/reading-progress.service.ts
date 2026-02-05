import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { ReadingProgress } from './entitys/reading-progress.entity';
import {
	SaveReadingProgressDto,
	ReadingProgressResponseDto,
	SyncReadingProgressDto,
	SyncResponseDto,
	BulkReadingProgressDto,
} from './dto/reading-progress.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ReadingProgressService {
	private readonly logger = new Logger(ReadingProgressService.name);

	constructor(
		@InjectRepository(ReadingProgress)
		private readonly progressRepository: Repository<ReadingProgress>,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Salva ou atualiza o progresso de leitura de um capítulo
	 */
	async saveProgress(
		userId: string,
		dto: SaveReadingProgressDto,
	): Promise<ReadingProgressResponseDto> {
		let progress = await this.progressRepository.findOne({
			where: { userId, chapterId: dto.chapterId },
		});

		if (progress) {
			// Atualiza apenas se o novo índice for maior ou se for marcado como completo
			if (dto.pageIndex > progress.pageIndex || dto.completed) {
				progress.pageIndex = dto.pageIndex;
				progress.totalPages = dto.totalPages ?? progress.totalPages;
				progress.completed = dto.completed ?? progress.completed;
			}
		} else {
			progress = this.progressRepository.create({
				userId,
				chapterId: dto.chapterId,
				bookId: dto.bookId,
				pageIndex: dto.pageIndex,
				totalPages: dto.totalPages ?? 0,
				completed: dto.completed ?? false,
			});
		}

		const saved = await this.progressRepository.save(progress);

		// Emite evento para sincronização via WebSocket
		this.eventEmitter.emit('reading.progress.updated', {
			userId,
			progress: this.toResponseDto(saved),
		});

		this.logger.debug(
			`Progresso salvo: user=${userId}, chapter=${dto.chapterId}, page=${dto.pageIndex}`,
		);

		return this.toResponseDto(saved);
	}

	/**
	 * Obtém o progresso de um capítulo específico
	 */
	async getProgress(
		userId: string,
		chapterId: string,
	): Promise<ReadingProgressResponseDto | null> {
		const progress = await this.progressRepository.findOne({
			where: { userId, chapterId },
		});

		return progress ? this.toResponseDto(progress) : null;
	}

	/**
	 * Obtém todo o progresso de leitura de um livro
	 */
	async getBookProgress(
		userId: string,
		bookId: string,
	): Promise<BulkReadingProgressDto> {
		const progressList = await this.progressRepository.find({
			where: { userId, bookId },
			order: { updatedAt: 'DESC' },
		});

		return {
			bookId,
			progress: progressList.map((p) => this.toResponseDto(p)),
		};
	}

	/**
	 * Obtém todo o progresso de leitura do usuário
	 */
	async getAllProgress(
		userId: string,
	): Promise<ReadingProgressResponseDto[]> {
		const progressList = await this.progressRepository.find({
			where: { userId },
			order: { updatedAt: 'DESC' },
		});

		return progressList.map((p) => this.toResponseDto(p));
	}

	/**
	 * Sincroniza progresso local com o servidor
	 * Implementa estratégia de "last write wins" com detecção de conflitos
	 */
	async syncProgress(
		userId: string,
		dto: SyncReadingProgressDto,
	): Promise<SyncResponseDto> {
		const synced: ReadingProgressResponseDto[] = [];
		const conflicts: SyncResponseDto['conflicts'] = [];
		const lastSyncAt = new Date();

		if (dto.progress.length === 0) {
			const allRemote = await this.getAllProgress(userId);
			return { synced: allRemote, conflicts: [], lastSyncAt };
		}

		// Busca todos os registros existentes de uma vez para otimizar
		const chapterIds = dto.progress.map((p) => p.chapterId);
		const existingRemoteProgress = await this.progressRepository.find({
			where: { userId, chapterId: In(chapterIds) },
		});

		const remoteMap = new Map(
			existingRemoteProgress.map((p) => [p.chapterId, p]),
		);

		for (const localProgress of dto.progress) {
			const remoteProgress = remoteMap.get(localProgress.chapterId);

			if (!remoteProgress) {
				// Não existe no servidor, salva
				const saved = await this.saveProgress(userId, localProgress);
				synced.push(saved);
			} else if (dto.lastSyncAt) {
				// Verifica conflito baseado na data de última sincronização
				const remoteUpdatedAt = new Date(remoteProgress.updatedAt);
				const lastSyncDate = new Date(dto.lastSyncAt);

				if (remoteUpdatedAt > lastSyncDate) {
					// Servidor foi atualizado após última sincronização do cliente
					if (localProgress.pageIndex !== remoteProgress.pageIndex) {
						conflicts.push({
							local: localProgress,
							remote: this.toResponseDto(remoteProgress),
						});
					} else {
						synced.push(this.toResponseDto(remoteProgress));
					}
				} else {
					// Cliente é mais recente ou igual
					const saved = await this.saveProgress(
						userId,
						localProgress,
					);
					synced.push(saved);
				}
			} else {
				// Sem data de última sincronização, usa "maior página vence"
				if (localProgress.pageIndex >= remoteProgress.pageIndex) {
					const saved = await this.saveProgress(
						userId,
						localProgress,
					);
					synced.push(saved);
				} else {
					synced.push(this.toResponseDto(remoteProgress));
				}
			}
		}

		// Busca progresso remoto que não foi enviado pelo cliente
		const remoteOnly = await this.progressRepository.find({
			where: {
				userId,
				chapterId: Not(In(chapterIds)),
			},
		});

		synced.push(...remoteOnly.map((r) => this.toResponseDto(r)));

		this.logger.log(
			`Sincronização concluída: user=${userId}, synced=${synced.length}, conflicts=${conflicts.length}`,
		);

		return { synced, conflicts, lastSyncAt };
	}

	/**
	 * Remove progresso de um capítulo
	 */
	async deleteProgress(userId: string, chapterId: string): Promise<void> {
		await this.progressRepository.delete({ userId, chapterId });

		this.eventEmitter.emit('reading.progress.deleted', {
			userId,
			chapterId,
		});

		this.logger.debug(
			`Progresso removido: user=${userId}, chapter=${chapterId}`,
		);
	}

	/**
	 * Remove todo progresso de um livro
	 */
	async deleteBookProgress(userId: string, bookId: string): Promise<void> {
		await this.progressRepository.delete({ userId, bookId });

		this.eventEmitter.emit('reading.progress.book.deleted', {
			userId,
			bookId,
		});

		this.logger.debug(
			`Progresso do livro removido: user=${userId}, book=${bookId}`,
		);
	}

	private toResponseDto(
		progress: ReadingProgress,
	): ReadingProgressResponseDto {
		return {
			id: progress.id,
			chapterId: progress.chapterId,
			bookId: progress.bookId,
			pageIndex: progress.pageIndex,
			totalPages: progress.totalPages,
			completed: progress.completed,
			updatedAt: progress.updatedAt,
		};
	}
}
