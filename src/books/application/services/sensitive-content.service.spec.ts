import { I_BOOK_REPOSITORY } from '@books/application/ports/book-repository.interface';
import { I_SENSITIVE_CONTENT_REPOSITORY } from '@books/application/ports/sensitive-content-repository.interface';
import { SensitiveContent } from '@books/domain/entities/sensitive-content';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SensitiveContentService } from './sensitive-content.service';

describe('SensitiveContentService', () => {
	let service: SensitiveContentService;

	const mockSensitiveContentRepository = {
		findAll: jest.fn(),
		findById: jest.fn(),
		findByNameOrAlias: jest.fn(),
		save: jest.fn(),
		remove: jest.fn(),
		findByIds: jest.fn(),
		replaceReferences: jest.fn(),
		deleteByIds: jest.fn(),
	};

	const mockBookRepository = {};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SensitiveContentService,
				{
					provide: I_SENSITIVE_CONTENT_REPOSITORY,
					useValue: mockSensitiveContentRepository,
				},
				{
					provide: I_BOOK_REPOSITORY,
					useValue: mockBookRepository,
				},
			],
		}).compile();

		service = module.get<SensitiveContentService>(SensitiveContentService);
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('create', () => {
		it('should return existing sensitive content if found by name or alias', async () => {
			const existing = new SensitiveContent();
			existing.id = '1';
			existing.name = 'Gore';
			mockSensitiveContentRepository.findByNameOrAlias.mockResolvedValue(
				existing,
			);

			const result = await service.create({ name: 'Gore' });

			expect(result).toEqual(existing);
			expect(mockSensitiveContentRepository.save).not.toHaveBeenCalled();
		});

		it('should create and save new sensitive content if not found', async () => {
			mockSensitiveContentRepository.findByNameOrAlias.mockResolvedValue(
				null,
			);
			const saved = new SensitiveContent();
			saved.id = '2';
			saved.name = 'Violence';
			mockSensitiveContentRepository.save.mockResolvedValue(saved);

			const result = await service.create(
				{
					name: 'Violence',
					weight: 5,
				},
				10, // maxWeightSensitiveContent
			);

			expect(result).toEqual(saved);
			expect(mockSensitiveContentRepository.save).toHaveBeenCalled();
		});

		it('should throw ForbiddenException if weight is greater than maxWeight', async () => {
			await expect(
				service.create({ name: 'Gore', weight: 10 }, 5),
			).rejects.toThrow(ForbiddenException);
		});
	});

	describe('update', () => {
		it('should update and save sensitive content', async () => {
			const existing = new SensitiveContent();
			existing.id = '1';
			existing.name = 'Gore';
			existing.weight = 0;
			mockSensitiveContentRepository.findById.mockResolvedValue(existing);
			mockSensitiveContentRepository.save.mockResolvedValue(existing);

			const result = await service.update(
				'1',
				{ name: 'Gore updated', weight: 5 },
				10, // maxWeightSensitiveContent
			);

			expect(result.name).toBe('Gore updated');
			expect(result.weight).toBe(5);
			expect(mockSensitiveContentRepository.save).toHaveBeenCalledWith(
				existing,
			);
		});

		it('should throw ForbiddenException if weight is greater than maxWeight', async () => {
			await expect(
				service.update('1', { name: 'Gore', weight: 10 }, 5),
			).rejects.toThrow(ForbiddenException);
		});
	});

	describe('updateMultiple', () => {
		it('should update and save multiple sensitive contents', async () => {
			const existing1 = new SensitiveContent();
			existing1.id = '1';
			existing1.name = 'Tag1';
			existing1.weight = 0;

			const existing2 = new SensitiveContent();
			existing2.id = '2';
			existing2.name = 'Tag2';
			existing2.weight = 0;

			mockSensitiveContentRepository.findById
				.mockResolvedValueOnce(existing1)
				.mockResolvedValueOnce(existing2);

			mockSensitiveContentRepository.save
				.mockResolvedValueOnce(existing1)
				.mockResolvedValueOnce(existing2);

			const result = await service.updateMultiple(
				[
					{ id: '1', name: 'Tag1 updated', weight: 5 },
					{ id: '2', name: 'Tag2 updated', weight: 2 },
				],
				10, // maxWeightSensitiveContent
			);

			expect(result).toHaveLength(2);
			expect(result[0].name).toBe('Tag1 updated');
			expect(result[1].name).toBe('Tag2 updated');
			expect(mockSensitiveContentRepository.save).toHaveBeenCalledTimes(
				2,
			);
		});

		it('should throw ForbiddenException if any item has weight greater than maxWeight', async () => {
			await expect(
				service.updateMultiple(
					[
						{ id: '1', name: 'Tag1 updated', weight: 5 },
						{ id: '2', name: 'Tag2 updated', weight: 10 },
					],
					5, // maxWeightSensitiveContent
				),
			).rejects.toThrow(ForbiddenException);
		});
	});

	describe('mergeSensitiveContent', () => {
		it('should throw NotFoundException if target does not exist', async () => {
			mockSensitiveContentRepository.findById.mockResolvedValue(null);

			await expect(
				service.mergeSensitiveContent('targetId', ['copyId']),
			).rejects.toThrow(NotFoundException);
		});

		it('should return target directly if validCopyIds is empty', async () => {
			const target = new SensitiveContent();
			target.id = 'targetId';
			mockSensitiveContentRepository.findById.mockResolvedValue(target);

			const result = await service.mergeSensitiveContent('targetId', [
				'targetId',
			]); // self id is filtered out

			expect(result).toEqual(target);
			expect(
				mockSensitiveContentRepository.findByIds,
			).not.toHaveBeenCalled();
		});

		it('should merge correctly, update aliases, replace references and delete old ones', async () => {
			const target = new SensitiveContent();
			target.id = 'targetId';
			target.name = 'NewName';
			target.aliases = ['alias1'];

			const copy1 = new SensitiveContent();
			copy1.id = 'copy1';
			copy1.name = 'OldName1';
			copy1.aliases = ['alias2'];

			const copy2 = new SensitiveContent();
			copy2.id = 'copy2';
			copy2.name = 'OldName2';
			copy2.aliases = null;

			mockSensitiveContentRepository.findById.mockResolvedValue(target);
			mockSensitiveContentRepository.findByIds.mockResolvedValue([
				copy1,
				copy2,
			]);
			mockSensitiveContentRepository.replaceReferences.mockResolvedValue(
				undefined,
			);
			mockSensitiveContentRepository.deleteByIds.mockResolvedValue(
				undefined,
			);
			mockSensitiveContentRepository.save.mockImplementation((t) =>
				Promise.resolve(t),
			);

			const result = await service.mergeSensitiveContent('targetId', [
				'copy1',
				'copy2',
			]);

			expect(result.aliases).toEqual(
				expect.arrayContaining([
					'alias1',
					'OldName1',
					'alias2',
					'OldName2',
				]),
			);
			expect(result.aliases).not.toContain('NewName');

			expect(
				mockSensitiveContentRepository.replaceReferences,
			).toHaveBeenCalledWith(['copy1', 'copy2'], 'targetId');
			expect(
				mockSensitiveContentRepository.deleteByIds,
			).toHaveBeenCalledWith(['copy1', 'copy2']);
			expect(mockSensitiveContentRepository.save).toHaveBeenCalledWith(
				target,
			);
		});
	});
});
