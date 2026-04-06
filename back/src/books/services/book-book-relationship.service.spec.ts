import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminUsersService } from '../../users/admin-users.service';
import { BookRelationship } from '../entities/book-relationship.entity';
import { Book } from '../entities/book.entity';
import { BookBookRelationshipService } from './book-book-relationship.service';

describe('BookBookRelationshipService', () => {
	let service: BookBookRelationshipService;

	const queryBuilder: any = {
		leftJoinAndSelect: jest.fn(),
		where: jest.fn(),
		andWhere: jest.fn(),
		orderBy: jest.fn(),
		addOrderBy: jest.fn(),
		take: jest.fn(),
		skip: jest.fn(),
		getManyAndCount: jest.fn(),
	};

	const mockBookRelationshipRepository: any = {
		createQueryBuilder: jest.fn(),
	};

	const mockBookRepository: any = {
		exists: jest.fn(),
		find: jest.fn(),
	};

	const mockAdminUsersService: any = {
		evaluateAccessForBook: jest.fn(),
	};

	beforeEach(async () => {
		for (const method of Object.values(queryBuilder) as jest.Mock[]) {
			method.mockReset();
			method.mockReturnValue(queryBuilder);
		}
		queryBuilder.getManyAndCount.mockReset();

		mockBookRelationshipRepository.createQueryBuilder.mockReset();
		mockBookRelationshipRepository.createQueryBuilder.mockReturnValue(
			queryBuilder,
		);
		mockBookRepository.exists.mockReset();
		mockBookRepository.find.mockReset();
		mockAdminUsersService.evaluateAccessForBook.mockReset();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BookBookRelationshipService,
				{
					provide: getRepositoryToken(BookRelationship),
					useValue: mockBookRelationshipRepository,
				},
				{
					provide: getRepositoryToken(Book),
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
		queryBuilder.getManyAndCount.mockResolvedValue([
			[
				{
					id: 'rel-1',
					sourceBookId,
					targetBookId,
					relationType: 'spin-off',
					isBidirectional: false,
					order: null,
					metadata: null,
				},
			],
			1,
		]);
		mockBookRepository.find.mockResolvedValue([
			{
				id: targetBookId,
				tags: [],
				sensitiveContent: [{ id: 'sc-abuso', weight: 90 }],
			},
		]);
		mockAdminUsersService.evaluateAccessForBook.mockResolvedValue({
			blocked: true,
			effectiveMaxWeightSensitiveContent: 0,
		});

		const result = await service.listRelationships(
			sourceBookId,
			{},
			0,
			'user-1',
		);

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
		queryBuilder.getManyAndCount.mockResolvedValue([
			[
				{
					id: 'rel-2',
					sourceBookId,
					targetBookId,
					relationType: 'spin-off',
					isBidirectional: false,
					order: null,
					metadata: null,
				},
			],
			1,
		]);
		mockBookRepository.find.mockResolvedValue([
			{
				id: targetBookId,
				tags: [],
				sensitiveContent: [{ id: 'sc-abuso', weight: 70 }],
			},
		]);
		mockAdminUsersService.evaluateAccessForBook.mockResolvedValue({
			blocked: false,
			effectiveMaxWeightSensitiveContent: 10,
		});

		const result = await service.listRelationships(
			sourceBookId,
			{},
			10,
			'user-2',
		);

		expect(result.items).toEqual([]);
		expect(result.total).toBe(0);
	});

	it('deve retornar relacionamento quando acesso e peso estão permitidos', async () => {
		const sourceBookId = 'book-source';
		const targetBookId = 'book-ok';
		mockBookRepository.exists.mockResolvedValue(true);
		queryBuilder.getManyAndCount.mockResolvedValue([
			[
				{
					id: 'rel-3',
					sourceBookId,
					targetBookId,
					relationType: 'sequence',
					isBidirectional: false,
					order: 1,
					metadata: { note: 'Parte 2' },
				},
			],
			1,
		]);
		mockBookRepository.find.mockResolvedValue([
			{
				id: targetBookId,
				tags: [{ id: 'tag-1' }],
				sensitiveContent: [{ id: 'sc-light', weight: 5 }],
			},
		]);
		mockAdminUsersService.evaluateAccessForBook.mockResolvedValue({
			blocked: false,
			effectiveMaxWeightSensitiveContent: 20,
		});

		const result = await service.listRelationships(
			sourceBookId,
			{},
			20,
			'user-3',
		);

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
