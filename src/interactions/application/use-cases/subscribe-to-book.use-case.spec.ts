import { SubscriptionRepository } from '@/interactions/application/ports/subscription-repository.port';
import { Subscription } from '@/interactions/domain/entities/subscription';
import { IBookRepository } from '@books/application/ports/book-repository.interface';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserAccessPolicyService } from 'src/users/application/use-cases/user-access-policy.service';
import { SubscribeToBookUseCase } from './subscribe-to-book.use-case';

describe('SubscribeToBookUseCase', () => {
	let useCase: SubscribeToBookUseCase;
	let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
	let bookRepository: jest.Mocked<IBookRepository>;
	let userAccessPolicyService: jest.Mocked<UserAccessPolicyService>;

	const mockUserId = '12345678-1234-4234-a234-123456789012';
	const mockBookId = '87654321-1234-4234-a234-123456789012';
	const mockMaxWeight = 18;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SubscribeToBookUseCase,
				{
					provide: 'SubscriptionRepository',
					useValue: {
						save: jest.fn(),
					},
				},
				{
					provide: 'IBookRepository',
					useValue: {
						findById: jest.fn(),
					},
				},
				{
					provide: UserAccessPolicyService,
					useValue: {
						evaluateAccessForBook: jest.fn(),
					},
				},
			],
		}).compile();

		useCase = module.get<SubscribeToBookUseCase>(SubscribeToBookUseCase);
		subscriptionRepository = module.get('SubscriptionRepository');
		bookRepository = module.get('IBookRepository');
		userAccessPolicyService = module.get(UserAccessPolicyService);
	});

	it('should be defined', () => {
		expect(useCase).toBeDefined();
	});

	it('should throw NotFoundException if book does not exist', async () => {
		bookRepository.findById.mockResolvedValueOnce(null);

		await expect(
			useCase.execute(mockUserId, mockBookId, mockMaxWeight),
		).rejects.toThrow(NotFoundException);

		expect(bookRepository.findById).toHaveBeenCalledWith(mockBookId, [
			'tags',
			'sensitiveContent',
		]);
		expect(
			userAccessPolicyService.evaluateAccessForBook,
		).not.toHaveBeenCalled();
	});

	it('should throw ForbiddenException if user access policy blocks the book', async () => {
		const mockBook = {
			id: mockBookId,
			tags: [],
			sensitiveContent: [],
		} as any;

		bookRepository.findById.mockResolvedValueOnce(mockBook);
		userAccessPolicyService.evaluateAccessForBook.mockResolvedValueOnce({
			blocked: true,
			effectiveMaxWeightSensitiveContent: mockMaxWeight,
		});

		await expect(
			useCase.execute(mockUserId, mockBookId, mockMaxWeight),
		).rejects.toThrow(ForbiddenException);

		expect(
			userAccessPolicyService.evaluateAccessForBook,
		).toHaveBeenCalledWith({
			userId: mockUserId,
			bookId: mockBookId,
			bookTagIds: [],
			bookSensitiveContentIds: [],
			bookSensitiveContentWeights: [],
			baseMaxWeightSensitiveContent: mockMaxWeight,
		});
		expect(subscriptionRepository.save).not.toHaveBeenCalled();
	});

	it('should save subscription when book exists and policy allows access', async () => {
		const mockBook = {
			id: mockBookId,
			tags: [{ id: 'tag-1' }],
			sensitiveContent: [{ id: 'sc-1', weight: 18 }],
		} as any;

		bookRepository.findById.mockResolvedValueOnce(mockBook);
		userAccessPolicyService.evaluateAccessForBook.mockResolvedValueOnce({
			blocked: false,
			effectiveMaxWeightSensitiveContent: mockMaxWeight,
		});

		await useCase.execute(mockUserId, mockBookId, mockMaxWeight);

		expect(
			userAccessPolicyService.evaluateAccessForBook,
		).toHaveBeenCalledWith({
			userId: mockUserId,
			bookId: mockBookId,
			bookTagIds: ['tag-1'],
			bookSensitiveContentIds: ['sc-1'],
			bookSensitiveContentWeights: [18],
			baseMaxWeightSensitiveContent: mockMaxWeight,
		});

		expect(subscriptionRepository.save).toHaveBeenCalledTimes(1);
		const savedSubscription = subscriptionRepository.save.mock.calls[0][0];

		// Verificando propriedades do objeto de domínio salvo
		expect(savedSubscription).toBeInstanceOf(Subscription);
		const snapshot = savedSubscription.toSnapshot();
		expect(snapshot.userId).toBe(mockUserId);
		expect(snapshot.bookId).toBe(mockBookId);
	});
});
