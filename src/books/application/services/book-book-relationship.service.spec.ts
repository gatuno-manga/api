import {
	NotFoundException,
	BadRequestException,
	ConflictException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import { AdminUsersService } from 'src/users/application/use-cases/admin-users.service';
import { BookRelationship } from '../../domain/entities/book-relationship';
import { Book } from '../../domain/entities/book';
import {
	BookBookRelationshipService,
	type RelatedBookItem,
} from './book-book-relationship.service';

import {
	I_BOOK_RELATIONSHIP_REPOSITORY,
	IBookRelationshipRepository,
} from '../ports/book-relationship-repository.interface';
import {
	I_BOOK_REPOSITORY,
	IBookRepository,
} from '../ports/book-repository.interface';

describe('BookBookRelationshipService', () => {
	let service: BookBookRelationshipService;

	const mockBookRelationshipRepository = {
		findOneBy: jest.fn(),
		save: jest.fn(),
		findById: jest.fn(),
		softDelete: jest.fn(),
		findRelationshipsByBookId: jest.fn(),
	} as unknown as jest.Mocked<IBookRelationshipRepository>;

	const mockBookRepository = {
		exists: jest.fn(),
		find: jest.fn(),
	} as unknown as jest.Mocked<IBookRepository>;

	const mockAdminUsersService = {
		evaluateAccessForBook: jest.fn(),
	} as unknown as jest.Mocked<AdminUsersService>;

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BookBookRelationshipService,
				{
					provide: I_BOOK_RELATIONSHIP_REPOSITORY,
					useValue: mockBookRelationshipRepository,
				},
				{
					provide: I_BOOK_REPOSITORY,
					useValue: mockBookRepository,
				},
				{
					provide: AdminUsersService,
					useValue: mockAdminUsersService,
				},
			],
		}).compile();

		service = module.get<BookBookRelationshipService>(
			BookBookRelationshipService,
		);
	});

	it('deve filtrar relacionamento quando política bloqueia conteúdo sensível', async () => {
		const sourceBookId = 'book-source';
		const targetBookId = 'book-spin-off';
		mockBookRepository.exists.mockResolvedValue(true);
		mockBookRelationshipRepository.findRelationshipsByBookId.mockResolvedValue(
			[
				{
					id: 'rel-1',
					sourceBookId,
					targetBookId,
					relationType: 'spin-off',
					isBidirectional: false,
					order: null,
					metadata: null,
					createdAt: new Date('2026-01-01T00:00:00.000Z'),
					targetBook: {
						id: targetBookId,
						tags: [],
						sensitiveContent: [{ id: 'sc-abuso', weight: 90 }],
					},
				} as any,
			],
		);

		mockAdminUsersService.evaluateAccessForBook.mockResolvedValue({
			blocked: true,
			effectiveMaxWeightSensitiveContent: 0,
		});

		const result = (await service.listRelationships(
			sourceBookId,
			{},
			0,
			'user-1',
		)) as { items: RelatedBookItem[]; total: number };

		expect(result.items).toEqual([]);
		expect(result.total).toBe(0);
		expect(
			mockAdminUsersService.evaluateAccessForBook,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-1',
				bookId: targetBookId,
				bookSensitiveContentIds: ['sc-abuso'],
			}),
		);
	});

	it('deve filtrar relacionamento quando peso sensível excede limite efetivo', async () => {
		const sourceBookId = 'book-source';
		const targetBookId = 'book-spin-off';
		mockBookRepository.exists.mockResolvedValue(true);
		mockBookRelationshipRepository.findRelationshipsByBookId.mockResolvedValue(
			[
				{
					id: 'rel-2',
					sourceBookId,
					targetBookId,
					relationType: 'spin-off',
					isBidirectional: false,
					order: null,
					metadata: null,
					createdAt: new Date('2026-01-02T00:00:00.000Z'),
					targetBook: {
						id: targetBookId,
						tags: [],
						sensitiveContent: [{ id: 'sc-abuso', weight: 70 }],
					},
				} as any,
			],
		);

		mockAdminUsersService.evaluateAccessForBook.mockResolvedValue({
			blocked: false,
			effectiveMaxWeightSensitiveContent: 10,
		});

		const result = (await service.listRelationships(
			sourceBookId,
			{},
			10,
			'user-2',
		)) as { items: RelatedBookItem[]; total: number };

		expect(result.items).toEqual([]);
		expect(result.total).toBe(0);
	});

	it('deve retornar relacionamento quando acesso e peso estão permitidos', async () => {
		const sourceBookId = 'book-source';
		const targetBookId = 'book-ok';
		mockBookRepository.exists.mockResolvedValue(true);
		mockBookRelationshipRepository.findRelationshipsByBookId.mockResolvedValue(
			[
				{
					id: 'rel-3',
					sourceBookId,
					targetBookId,
					relationType: 'sequence',
					isBidirectional: false,
					order: 1,
					metadata: { note: 'Parte 2' },
					createdAt: new Date('2026-01-03T00:00:00.000Z'),
					targetBook: {
						id: targetBookId,
						tags: [{ id: 'tag-1' }],
						sensitiveContent: [{ id: 'sc-light', weight: 5 }],
					},
				} as any,
			],
		);

		mockAdminUsersService.evaluateAccessForBook.mockResolvedValue({
			blocked: false,
			effectiveMaxWeightSensitiveContent: 20,
		});

		const result = (await service.listRelationships(
			sourceBookId,
			{},
			20,
			'user-3',
		)) as { items: RelatedBookItem[]; total: number };

		expect(result.items).toHaveLength(1);
		expect(result.items[0]).toEqual(
			expect.objectContaining({
				relationType: 'sequence',
				relatedBook: expect.objectContaining({ id: targetBookId }),
			}),
		);
	});

	it('deve lançar erro quando livro base não existe', async () => {
		mockBookRepository.exists.mockResolvedValue(false);

		await expect(
			service.listRelationships('missing-book', {}),
		).rejects.toThrow(NotFoundException);
	});
});
