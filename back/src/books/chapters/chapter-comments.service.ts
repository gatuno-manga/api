import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { RolesEnum } from 'src/users/enum/roles.enum';
import { User } from 'src/users/entities/user.entity';
import { MetadataPageDto } from 'src/pages/metadata-page.dto';
import { PageDto } from 'src/pages/page.dto';
import { In, IsNull, Repository } from 'typeorm';
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
	parentId: string | null;
	content: string;
	isDeleted: boolean;
	createdAt: Date;
	updatedAt: Date;
	replies: ChapterCommentNode[];
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
	) {}

	async listChapterComments(
		chapterId: string,
		options: ChapterCommentsPageOptionsDto,
	): Promise<PageDto<ChapterCommentNode>> {
		await this.ensureChapterExists(chapterId);

		const total = await this.chapterCommentRepository.count({
			where: {
				chapter: { id: chapterId },
				parent: IsNull(),
			},
			withDeleted: true,
		});

		const page = options.page;
		const limit = options.limit;
		const roots = await this.chapterCommentRepository.find({
			where: {
				chapter: { id: chapterId },
				parent: IsNull(),
			},
			relations: ['chapter', 'user', 'parent'],
			order: { createdAt: 'DESC' },
			skip: (page - 1) * limit,
			take: limit,
			withDeleted: true,
		});

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

	async createComment(
		chapterId: string,
		dto: CreateChapterCommentDto,
		user: CurrentUserDto,
	): Promise<ChapterCommentNode> {
		await this.ensureChapterExists(chapterId);

		const comment = this.chapterCommentRepository.create({
			id: randomUUID(),
			chapter: { id: chapterId },
			user: { id: user.userId },
			content: dto.content.trim(),
		});

		const saved = await this.chapterCommentRepository.save(comment);
		const userName = await this.resolveUserName(user.userId, user.username);
		return {
			id: saved.id,
			chapterId,
			userId: user.userId,
			userName,
			parentId: null,
			content: saved.content,
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
			content: dto.content.trim(),
		});

		const saved = await this.chapterCommentRepository.save(reply);
		const userName = await this.resolveUserName(user.userId, user.username);
		return {
			id: saved.id,
			chapterId,
			userId: user.userId,
			userName,
			parentId,
			content: saved.content,
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
			userName: comment.user.userName,
			parentId: comment.parent?.id ?? null,
			content: isDeleted ? '[comentario removido]' : comment.content,
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
	): Promise<ChapterComment[]> {
		const descendants: ChapterComment[] = [];
		let parentIds = [...rootIds];
		let depth = 1;

		while (parentIds.length > 0 && depth <= maxDepth) {
			const batch = await this.chapterCommentRepository.find({
				where: {
					chapter: { id: chapterId },
					parent: { id: In(parentIds) },
				},
				relations: ['chapter', 'user', 'parent'],
				order: { createdAt: 'ASC' },
				withDeleted: true,
			});

			if (!batch.length) {
				break;
			}

			descendants.push(...batch);
			parentIds = batch.map((comment) => comment.id);
			depth += 1;
		}

		return descendants;
	}

	private async resolveUserName(
		userId: string,
		fallback?: string,
	): Promise<string> {
		const user = await this.userRepository.findOne({
			where: { id: userId },
		});

		if (user?.userName?.trim()) {
			return user.userName;
		}

		return fallback?.trim() || userId;
	}
}
