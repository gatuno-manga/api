import { Test, TestingModule } from '@nestjs/testing';
import {
	HandleImageProcessingCompletedUseCase,
	IMAGE_UPDATE_STRATEGIES,
} from './handle-image-processing-completed.use-case';
import { StorageBucket } from '../../../common/enum/storage-bucket.enum';
import { ImageUpdateStrategy } from '../strategies/image-update/image-update.strategy';

describe('HandleImageProcessingCompletedUseCase', () => {
	let useCase: HandleImageProcessingCompletedUseCase;
	let mockBooksStrategy: ImageUpdateStrategy;
	let mockUsersStrategy: ImageUpdateStrategy;

	beforeEach(async () => {
		mockBooksStrategy = {
			supports: jest
				.fn()
				.mockImplementation((bucket) => bucket === StorageBucket.BOOKS),
			updateBatch: jest.fn().mockResolvedValue(undefined),
		};

		mockUsersStrategy = {
			supports: jest
				.fn()
				.mockImplementation((bucket) => bucket === StorageBucket.USERS),
			updateBatch: jest.fn().mockResolvedValue(undefined),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				HandleImageProcessingCompletedUseCase,
				{
					provide: IMAGE_UPDATE_STRATEGIES,
					useValue: [mockBooksStrategy, mockUsersStrategy],
				},
			],
		}).compile();

		useCase = module.get<HandleImageProcessingCompletedUseCase>(
			HandleImageProcessingCompletedUseCase,
		);
	});

	it('deve chamar a estratégia de livros quando o bucket for BOOKS', async () => {
		const event = {
			rawPath: 'raw/path.jpg',
			targetBucket: StorageBucket.BOOKS,
			targetPath: 'processed/path.jpg',
		};

		await useCase.executeBatch([event]);

		expect(mockBooksStrategy.updateBatch).toHaveBeenCalledWith([event]);
		expect(mockUsersStrategy.updateBatch).not.toHaveBeenCalled();
	});

	it('deve agrupar eventos por bucket e chamar as estratégias corretas', async () => {
		const bookEvent = {
			rawPath: 'raw/book.jpg',
			targetBucket: StorageBucket.BOOKS,
			targetPath: 'processed/book.jpg',
		};
		const userEvent = {
			rawPath: 'raw/user.jpg',
			targetBucket: StorageBucket.USERS,
			targetPath: 'processed/user.jpg',
		};

		await useCase.executeBatch([bookEvent, userEvent]);

		expect(mockBooksStrategy.updateBatch).toHaveBeenCalledWith([bookEvent]);
		expect(mockUsersStrategy.updateBatch).toHaveBeenCalledWith([userEvent]);
	});

	it('deve logar um aviso quando nenhuma estratégia suportar o bucket', async () => {
		const event = {
			rawPath: 'raw/other.jpg',
			targetBucket: 'UNKNOWN' as any,
			targetPath: 'processed/other.jpg',
		};

		const loggerSpy = jest.spyOn((useCase as any).logger, 'warn');

		await useCase.executeBatch([event]);

		expect(mockBooksStrategy.updateBatch).not.toHaveBeenCalled();
		expect(mockUsersStrategy.updateBatch).not.toHaveBeenCalled();
		expect(loggerSpy).toHaveBeenCalledWith(
			expect.stringContaining('Nenhuma estratégia encontrada'),
		);
	});
});
