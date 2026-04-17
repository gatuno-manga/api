import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { AppConfigService } from 'src/app-config/app-config.service';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { RolesEnum } from 'src/users/enum/roles.enum';
import { User } from 'src/users/entities/user.entity';
import { CursorPageDto } from 'src/pages/cursor-page.dto';
import {
	decodeCursorPayload,
	encodeCursorPayload,
} from 'src/pages/cursor.utils';
import { MetadataPageDto } from 'src/pages/metadata-page.dto';
import { PageDto } from 'src/pages/page.dto';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { ChapterComment } from '../entities/chapter-comment.entity';
import { Chapter } from '../entities/chapter.entity';
import { CreateChapterCommentDto } from './dto/create-chapter-comment.dto';
import { ChapterCommentsPageOptionsDto } from './dto/chapter-comments-page-options.dto';
import { UpdateChapterCommentDto } from './dto/update-chapter-comment.dto';

export type ChapterCommentNode = {
	id: string;
	chapterId: string;
	userId: string;
	userName: string;
	profileImageUrl: string;
	parentId: string | null;
	content: string;
	isPublic: boolean;
	isDeleted: boolean;
	createdAt: Date;
	updatedAt: Date;
	replies: ChapterCommentNode[];
};

type ChapterCommentsCursorPayload = {
	createdAt: string;
	id: string;
};

@Injectable()
export class ChapterCommentsService {
	constructor(
		@InjectRepository(ChapterComment)
		private readonly chapterCommentRepository: Repository<ChapterComment>,
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		private readonly appConfig: AppConfigService,
	) {}

	async listChapterComments(
		chapterId: string,
		options: ChapterCommentsPageOptionsDto,
		viewer?: CurrentUserDto,
	): Promise<
		PageDto<ChapterCommentNode> | CursorPageDto<ChapterCommentNode>
	> {
		await this.ensureChapterExists(chapterId);

		if (options.cursor) {
			return this.listChapterCommentsByCursor(chapterId, options, viewer);
		}

		return this.listChapterCommentsByPage(chapterId, options, viewer);
	}

	private async listChapterCommentsByPage(
		chapterId: string,
		options: ChapterCommentsPageOptionsDto,
		viewer?: CurrentUserDto,
	): Promise<PageDto<ChapterCommentNode>> {
		const countQuery = this.chapterCommentRepository
			.createQueryBuilder('comment')
			.withDeleted()
			.where('comment.chapter_id = :chapterId', { chapterId })
			.andWhere('comment.parent_id IS NULL');

		this.applyVisibilityFilter(countQuery, viewer, 'comment');
		const total = await countQuery.getCount();

		const page = options.page;
		const limit = options.limit;
		const rootsQuery = this.chapterCommentRepository
			.createQueryBuilder('comment')
			.leftJoinAndSelect('comment.chapter', 'chapter')
			.leftJoinAndSelect('comment.user', 'user')
			.leftJoinAndSelect('comment.parent', 'parent')
			.withDeleted()
			.where('comment.chapter_id = :chapterId', { chapterId })
			.andWhere('comment.parent_id IS NULL')
			.orderBy('comment.createdAt', 'DESC')
			.addOrderBy('comment.id', 'DESC')
			.skip((page - 1) * limit)
			.take(limit);

		this.applyVisibilityFilter(rootsQuery, viewer, 'comment');
		const roots = await rootsQuery.getMany();

		if (!roots.length) {
			const metadata: MetadataPageDto = {
				total,
				page,
				lastPage: Math.max(1, Math.ceil(total / limit)),
			};
			return new PageDto([], metadata);
		}

		const descendants = await this.loadDescendantsByRoots(
			chapterId,
			roots.map((root) => root.id),
			options.maxDepth,
			viewer,
		);

		const nodesMap = new Map<string, ChapterCommentNode>();
		for (const comment of [...roots, ...descendants]) {
			nodesMap.set(comment.id, this.mapEntityToNode(comment));
		}

		for (const node of nodesMap.values()) {
			if (!node.parentId) {
				continue;
			}
			const parentNode = nodesMap.get(node.parentId);
			if (parentNode) {
				parentNode.replies.push(node);
			}
		}

		for (const node of nodesMap.values()) {
			node.replies.sort(
				(a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
			);
		}

		const data = roots
			.map((root) => nodesMap.get(root.id))
			.filter((root): root is ChapterCommentNode => Boolean(root));

		const metadata: MetadataPageDto = {
			total,
			page,
			lastPage: Math.max(1, Math.ceil(total / limit)),
		};
		return new PageDto(data, metadata);
	}

	private async listChapterCommentsByCursor(
		chapterId: string,
		options: ChapterCommentsPageOptionsDto,
		viewer?: CurrentUserDto,
	): Promise<CursorPageDto<ChapterCommentNode>> {
		const limit = options.limit;
		const rootsQuery = this.chapterCommentRepository
			.createQueryBuilder('comment')
			.leftJoinAndSelect('comment.chapter', 'chapter')
			.leftJoinAndSelect('comment.user', 'user')
			.leftJoinAndSelect('comment.parent', 'parent')
			.withDeleted()
			.where('comment.chapter_id = :chapterId', { chapterId })
			.andWhere('comment.parent_id IS NULL')
			.orderBy('comment.createdAt', 'DESC')
			.addOrderBy('comment.id', 'DESC')
			.take(limit + 1);

		this.applyVisibilityFilter(rootsQuery, viewer, 'comment');

		const decodedCursor = decodeCursorPayload<ChapterCommentsCursorPayload>(
			options.cursor,
		);

		if (
			decodedCursor &&
			typeof decodedCursor.createdAt === 'string' &&
			typeof decodedCursor.id === 'string'
		) {
			const parsedDate = new Date(decodedCursor.createdAt);
			if (!Number.isNaN(parsedDate.getTime())) {
				rootsQuery.andWhere(
					`(
						comment.createdAt < :cursorCreatedAt
						OR (comment.createdAt = :cursorCreatedAt AND comment.id < :cursorId)
					)`,
					{
						cursorCreatedAt: parsedDate,
						cursorId: decodedCursor.id,
					},
				);
			}
		}

		const roots = await rootsQuery.getMany();
		const hasNextPage = roots.length > limit;
		const currentRoots = hasNextPage ? roots.slice(0, limit) : roots;

		if (!currentRoots.length) {
			return new CursorPageDto([], null, false);
		}

		const descendants = await this.loadDescendantsByRoots(
			chapterId,
			currentRoots.map((root) => root.id),
			options.maxDepth,
			viewer,
		);

		const nodesMap = new Map<string, ChapterCommentNode>();
		for (const comment of [...currentRoots, ...descendants]) {
			nodesMap.set(comment.id, this.mapEntityToNode(comment));
		}

		for (const node of nodesMap.values()) {
			if (!node.parentId) {
				continue;
			}
			const parentNode = nodesMap.get(node.parentId);
			if (parentNode) {
				parentNode.replies.push(node);
			}
		}

		for (const node of nodesMap.values()) {
			node.replies.sort(
				(a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
			);
		}

		const data = currentRoots
			.map((root) => nodesMap.get(root.id))
			.filter((root): root is ChapterCommentNode => Boolean(root));
		const lastRoot = currentRoots[currentRoots.length - 1];
		const nextCursor =
			hasNextPage && lastRoot
				? encodeCursorPayload({
						createdAt: lastRoot.createdAt.toISOString(),
						id: lastRoot.id,
					})
				: null;

		return new CursorPageDto(data, nextCursor, hasNextPage);
	}

	async createComment(
		chapterId: string,
		dto: CreateChapterCommentDto,
		user: CurrentUserDto,
	): Promise<ChapterCommentNode> {
		await this.ensureChapterExists(chapterId);
		const userIdentity = await this.resolveUserIdentity(
			user.userId,
			user.username,
		);

		const comment = this.chapterCommentRepository.create({
			id: randomUUID(),
			chapter: { id: chapterId },
			user: { id: user.userId },
			userName: userIdentity.userName,
			content: dto.content.trim(),
			isPublic: dto.isPublic ?? true,
		});

		const saved = await this.chapterCommentRepository.save(comment);
		return {
			id: saved.id,
			chapterId,
			userId: user.userId,
			userName: userIdentity.userName,
			profileImageUrl: userIdentity.profileImageUrl,
			parentId: null,
			content: saved.content,
			isPublic: saved.isPublic,
			isDeleted: false,
			createdAt: saved.createdAt ?? new Date(),
			updatedAt: saved.updatedAt ?? new Date(),
			replies: [],
		};
	}

	async createReply(
		chapterId: string,
		parentId: string,
		dto: CreateChapterCommentDto,
		user: CurrentUserDto,
	): Promise<ChapterCommentNode> {
		await this.ensureChapterExists(chapterId);
		const userIdentity = await this.resolveUserIdentity(
			user.userId,
			user.username,
		);

		const parentComment = await this.chapterCommentRepository.findOne({
			where: {
				id: parentId,
				chapter: { id: chapterId },
			},
			withDeleted: true,
		});

		if (!parentComment) {
			throw new NotFoundException('Parent comment not found');
		}

		if (parentComment.deletedAt) {
			throw new BadRequestException('Cannot reply to a deleted comment');
		}

		const reply = this.chapterCommentRepository.create({
			id: randomUUID(),
			chapter: { id: chapterId },
			parent: { id: parentId },
			user: { id: user.userId },
			userName: userIdentity.userName,
			content: dto.content.trim(),
			isPublic: dto.isPublic ?? true,
		});

		const saved = await this.chapterCommentRepository.save(reply);
		return {
			id: saved.id,
			chapterId,
			userId: user.userId,
			userName: userIdentity.userName,
			profileImageUrl: userIdentity.profileImageUrl,
			parentId,
			content: saved.content,
			isPublic: saved.isPublic,
			isDeleted: false,
			createdAt: saved.createdAt ?? new Date(),
			updatedAt: saved.updatedAt ?? new Date(),
			replies: [],
		};
	}

	async updateComment(
		chapterId: string,
		commentId: string,
		dto: UpdateChapterCommentDto,
		user: CurrentUserDto,
	): Promise<ChapterCommentNode> {
		const comment = await this.chapterCommentRepository.findOne({
			where: {
				id: commentId,
				chapter: { id: chapterId },
			},
			relations: ['user', 'chapter', 'parent'],
			withDeleted: true,
		});

		if (!comment) {
			throw new NotFoundException('Comment not found');
		}

		if (comment.deletedAt) {
			throw new BadRequestException('Deleted comments cannot be edited');
		}

		this.assertCanManageComment(comment, user);
		comment.content = dto.content.trim();
		if (dto.isPublic !== undefined) {
			comment.isPublic = dto.isPublic;
		}

		await this.chapterCommentRepository.save(comment);
		return this.mapEntityToNode(comment);
	}

	async deleteComment(
		chapterId: string,
		commentId: string,
		user: CurrentUserDto,
	): Promise<{ message: string }> {
		const comment = await this.chapterCommentRepository.findOne({
			where: {
				id: commentId,
				chapter: { id: chapterId },
			},
			relations: ['user'],
			withDeleted: true,
		});

		if (!comment) {
			throw new NotFoundException('Comment not found');
		}

		if (comment.deletedAt) {
			return { message: 'Comment already deleted' };
		}

		this.assertCanManageComment(comment, user);
		comment.content = '';

		await this.chapterCommentRepository.save(comment);
		await this.chapterCommentRepository.softRemove(comment);
		return { message: 'Comment deleted successfully' };
	}

	private async ensureChapterExists(chapterId: string): Promise<void> {
		const exists = await this.chapterRepository.exist({
			where: { id: chapterId },
		});

		if (!exists) {
			throw new NotFoundException('Chapter not found');
		}
	}

	private async getCommentNode(
		chapterId: string,
		commentId: string,
	): Promise<ChapterCommentNode> {
		const comment = await this.chapterCommentRepository.findOne({
			where: {
				id: commentId,
				chapter: { id: chapterId },
			},
			relations: ['chapter', 'user', 'parent'],
			withDeleted: true,
		});

		if (!comment) {
			throw new NotFoundException('Comment not found');
		}

		return this.mapEntityToNode(comment);
	}

	private assertCanManageComment(
		comment: ChapterComment,
		user: CurrentUserDto,
	): void {
		const isAdmin = user.roles.includes(RolesEnum.ADMIN);
		const isOwner = comment.user.id === user.userId;
		if (!isAdmin && !isOwner) {
			throw new ForbiddenException(
				'You do not have permission to modify this comment',
			);
		}
	}

	private mapEntityToNode(comment: ChapterComment): ChapterCommentNode {
		const isDeleted = Boolean(comment.deletedAt);
		return {
			id: comment.id,
			chapterId: comment.chapter.id,
			userId: comment.user.id,
			userName:
				comment.userName ||
				comment.user?.userName ||
				comment.user?.id ||
				'unknown-user',
			profileImageUrl: this.toAbsoluteMediaUrl(
				comment.user?.profileImagePath || null,
			),
			parentId: comment.parent?.id ?? null,
			content: isDeleted ? '[comentario removido]' : comment.content,
			isPublic: comment.isPublic,
			isDeleted,
			createdAt: comment.createdAt,
			updatedAt: comment.updatedAt,
			replies: [],
		};
	}

	private async loadDescendantsByRoots(
		chapterId: string,
		rootIds: string[],
		maxDepth: number,
		viewer?: CurrentUserDto,
	): Promise<ChapterComment[]> {
		const descendants: ChapterComment[] = [];
		let parentIds = [...rootIds];
		let depth = 1;

		while (parentIds.length > 0 && depth <= maxDepth) {
			const query = this.chapterCommentRepository
				.createQueryBuilder('comment')
				.leftJoinAndSelect('comment.chapter', 'chapter')
				.leftJoinAndSelect('comment.user', 'user')
				.leftJoinAndSelect('comment.parent', 'parent')
				.withDeleted()
				.where('comment.chapter_id = :chapterId', { chapterId })
				.andWhere('comment.parent_id IN (:...parentIds)', { parentIds })
				.orderBy('comment.createdAt', 'ASC');

			this.applyVisibilityFilter(query, viewer, 'comment');
			const batch = await query.getMany();

			if (!batch.length) {
				break;
			}

			descendants.push(...batch);
			parentIds = batch.map((comment) => comment.id);
			depth += 1;
		}

		return descendants;
	}

	private async resolveUserIdentity(
		userId: string,
		fallback?: string,
	): Promise<{ userName: string; profileImageUrl: string }> {
		const user = await this.userRepository.findOne({
			where: { id: userId },
		});

		const userName = user?.userName?.trim() || fallback?.trim() || userId;
		const profileImageUrl = this.toAbsoluteMediaUrl(
			user?.profileImagePath || null,
		);

		return { userName, profileImageUrl };
	}

	private toAbsoluteMediaUrl(url: string | null): string {
		if (
			!url ||
			url.startsWith('null') ||
			url.startsWith('undefined') ||
			url.startsWith('http')
		) {
			return url || '';
		}

		return `${this.appConfig.apiUrl}${url}`;
	}

	private applyVisibilityFilter(
		query: SelectQueryBuilder<ChapterComment>,
		viewer: CurrentUserDto | undefined,
		alias: string,
	): void {
		const isAdmin = Boolean(viewer?.roles?.includes(RolesEnum.ADMIN));
		if (isAdmin) {
			return;
		}

		if (viewer?.userId) {
			query.andWhere(
				new Brackets((qb) => {
					qb.where(`${alias}.isPublic = :isPublic`, {
						isPublic: true,
					}).orWhere(`${alias}.user_id = :viewerId`, {
						viewerId: viewer.userId,
					});
				}),
			);
			return;
		}

		query.andWhere(`${alias}.isPublic = :isPublic`, {
			isPublic: true,
		});
	}
}
