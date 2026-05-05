import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { CurrentUserDto } from '@auth/application/dto/current-user.dto';
import { ReadingProgressService } from '@users/application/use-cases/reading-progress.service';
import { SavedPagesService } from '@users/application/use-cases/saved-pages.service';
import {
	ChapterCommentNode,
	ChapterCommentsService,
} from '@books/application/services/chapter-comments.service';
import { SyncRequestDto } from '@/sync/infrastructure/http/dto/sync-request.dto';
import { ISyncResult } from '@/sync/application/types/sync-result.interface';
import { SyncResponseDto } from '@users/infrastructure/http/dto/reading-progress.dto';

@Injectable()
export class ProcessSyncUseCase {
	private readonly logger = new Logger(ProcessSyncUseCase.name);

	constructor(private readonly moduleRef: ModuleRef) {}

	private get readingProgressService(): ReadingProgressService {
		return this.moduleRef.get(ReadingProgressService, { strict: false });
	}

	private get savedPagesService(): SavedPagesService {
		return this.moduleRef.get(SavedPagesService, { strict: false });
	}

	private get chapterCommentsService(): ChapterCommentsService {
		return this.moduleRef.get(ChapterCommentsService, { strict: false });
	}

	async execute(
		user: CurrentUserDto,
		dto: SyncRequestDto,
	): Promise<ISyncResult> {
		this.logger.log(
			`Iniciando sincronização unificada para o usuário: ${user.userId}`,
		);

		let readingProgress: SyncResponseDto;
		const syncedComments: ChapterCommentNode[] = [];

		// 1. Sincronizar progresso de leitura
		if (dto.readingProgress) {
			readingProgress = await this.readingProgressService.syncProgress(
				user.userId,
				{
					progress: dto.readingProgress,
					lastSyncAt: dto.lastSyncAt
						? new Date(dto.lastSyncAt)
						: undefined,
				},
			);
		} else {
			readingProgress = {
				synced: await this.readingProgressService.getAllProgress(
					user.userId,
				),
				conflicts: [],
				lastSyncAt: new Date(),
			};
		}

		// 2. Sincronizar páginas salvas
		if (dto.savedPages) {
			for (const savedPage of dto.savedPages) {
				try {
					await this.savedPagesService.savePage(
						savedPage,
						user.userId,
					);
				} catch (error) {
					// Ignora erros de "já existe" na sincronização
					const message =
						error instanceof Error
							? error.message
							: 'Unknown error';
					this.logger.debug(
						`Página já salva ou erro na sync: ${message}`,
					);
				}
			}
		}
		const savedPages = await this.savedPagesService.getSavedPages(
			user.userId,
		);

		// 3. Sincronizar comentários (apenas upload de novos por enquanto)
		if (dto.comments) {
			for (const commentDto of dto.comments) {
				try {
					if (commentDto.parentId) {
						const reply =
							await this.chapterCommentsService.createReply(
								commentDto.chapterId,
								commentDto.parentId,
								{
									content: commentDto.content,
									isPublic: commentDto.isPublic,
								},
								user,
							);
						syncedComments.push(reply);
					} else {
						const comment =
							await this.chapterCommentsService.createComment(
								commentDto.chapterId,
								{
									content: commentDto.content,
									isPublic: commentDto.isPublic,
								},
								user,
							);
						syncedComments.push(comment);
					}
				} catch (error) {
					const message =
						error instanceof Error
							? error.message
							: 'Unknown error';
					this.logger.error(
						`Erro ao sincronizar comentário: ${message}`,
					);
				}
			}
		}

		return {
			readingProgress,
			savedPages,
			comments: syncedComments,
			syncedAt: new Date(),
		};
	}
}
