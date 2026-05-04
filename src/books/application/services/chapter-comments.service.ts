import {
	BadRequestException,
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { StorageBucket } from 'src/common/enum/storage-bucket.enum';
import { MediaUrlService } from 'src/common/services/media-url.service';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { RolesEnum } from '../../../users/domain/enums/roles.enum';
import { User } from '../../../users/domain/entities/user';
import { CursorPageDto } from 'src/common/pagination/cursor-page.dto';
import { MetadataPageDto } from 'src/common/pagination/metadata-page.dto';
import { PageDto } from 'src/common/pagination/page.dto';
import { ChapterComment } from '../../domain/entities/chapter-comment';
import { Chapter } from '../../domain/entities/chapter';
import { CreateChapterCommentDto } from '../dto/create-chapter-comment.dto';
import { ChapterCommentsPageOptionsDto } from '../dto/chapter-comments-page-options.dto';
import { UpdateChapterCommentDto } from '../dto/update-chapter-comment.dto';
import {
	I_CHAPTER_COMMENT_REPOSITORY,
	IChapterCommentRepository,
} from '../ports/chapter-comment-repository.interface';
import {
	I_CHAPTER_REPOSITORY,
	IChapterRepository,
} from '../ports/chapter-repository.interface';
import {
	I_USER_REPOSITORY,
	IUserRepository,
} from '../../../users/application/ports/user-repository.interface';

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

@Injectable()
export class ChapterCommentsService {
	constructor(
		@Inject(I_CHAPTER_COMMENT_REPOSITORY)
		private readonly chapterCommentRepository: IChapterCommentRepository,
		@Inject(I_CHAPTER_REPOSITORY)
		private readonly chapterRepository: IChapterRepository,
		@Inject(I_USER_REPOSITORY)
		private readonly userRepository: IUserRepository,
		private readonly mediaUrlService: MediaUrlService,
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
			return new CursorPageDto([], null, false);
		}

		const total = await this.chapterCommentRepository.countRoots(
			chapterId,
			viewer,
		);
		const roots =
			await this.chapterCommentRepository.findRootsWithPagination(
				chapterId,
				options,
				viewer,
			);

		if (!roots.length) {
			const metadata: MetadataPageDto = {
				total,
				page: options.page,
				lastPage: Math.max(1, Math.ceil(total / options.limit)),
			};
			return new PageDto([], metadata);
		}

		const descendants =
			await this.chapterCommentRepository.findDescendantsByRoots(
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
			page: options.page,
			lastPage: Math.max(1, Math.ceil(total / options.limit)),
		};
		return new PageDto(data, metadata);
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
			id: uuidv7(),
			chapter: { id: chapterId } as unknown as Chapter,
			user: { id: user.userId } as unknown as User,
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

		const parentComment =
			await this.chapterCommentRepository.findById(parentId);

		if (!parentComment) {
			throw new NotFoundException('Parent comment not found');
		}

		if (parentComment.deletedAt) {
			throw new BadRequestException('Cannot reply to a deleted comment');
		}

		const reply = this.chapterCommentRepository.create({
			id: uuidv7(),
			chapter: { id: chapterId } as unknown as Chapter,
			parent: { id: parentId } as unknown as ChapterComment,
			user: { id: user.userId } as unknown as User,
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
		const comment = await this.chapterCommentRepository.findById(
			commentId,
			['user', 'chapter', 'parent'],
		);

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
		const comment = await this.chapterCommentRepository.findById(
			commentId,
			['user'],
		);

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
		const exists = await this.chapterRepository.exists(chapterId);

		if (!exists) {
			throw new NotFoundException('Chapter not found');
		}
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
			profileImageUrl: this.mediaUrlService.resolveUrl(
				comment.user?.profilePicture?.path || null,
				StorageBucket.USERS,
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

	private async resolveUserIdentity(
		userId: string,
		fallback?: string,
	): Promise<{ userName: string; profileImageUrl: string }> {
		const user = await this.userRepository.findById(userId);

		const userName = user?.userName?.trim() || fallback?.trim() || userId;
		const profileImageUrl = this.mediaUrlService.resolveUrl(
			user?.profilePicture?.path || null,
			StorageBucket.USERS,
		);

		return { userName, profileImageUrl };
	}
}
