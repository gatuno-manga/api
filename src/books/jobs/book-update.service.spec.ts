import { Test, type TestingModule } from '@nestjs/testing';
import { BookUpdateJobService } from './book-update.service';

describe('BookUpdateJobService', () => {
	let service: BookUpdateJobService;

	const mockBookUpdateQueue = {
		getJob: jest.fn(),
		add: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BookUpdateJobService,
				{
					provide: 'BullQueue_book-update-queue',
					useValue: mockBookUpdateQueue,
				},
			],
		}).compile();

		service = module.get<BookUpdateJobService>(BookUpdateJobService);
	});

	it('should enqueue a new job when no previous job exists', async () => {
		mockBookUpdateQueue.getJob.mockResolvedValue(null);
		mockBookUpdateQueue.add.mockResolvedValue(undefined);

		await service.addBookToUpdateQueue('book-1');

		expect(mockBookUpdateQueue.add).toHaveBeenCalledWith(
			'update-book',
			{ bookId: 'book-1' },
			{ jobId: 'book-update-book-1' },
		);
	});

	it('should remove completed job before re-enqueueing', async () => {
		const existingJob = {
			getState: jest.fn().mockResolvedValue('completed'),
			remove: jest.fn().mockResolvedValue(undefined),
		};
		mockBookUpdateQueue.getJob.mockResolvedValue(existingJob);
		mockBookUpdateQueue.add.mockResolvedValue(undefined);

		await service.addBookToUpdateQueue('book-1');

		expect(existingJob.remove).toHaveBeenCalled();
		expect(mockBookUpdateQueue.add).toHaveBeenCalled();
	});

	it('should skip enqueue when existing job is active', async () => {
		const existingJob = {
			getState: jest.fn().mockResolvedValue('active'),
			remove: jest.fn(),
		};
		mockBookUpdateQueue.getJob.mockResolvedValue(existingJob);

		await service.addBookToUpdateQueue('book-1');

		expect(mockBookUpdateQueue.add).not.toHaveBeenCalled();
		expect(existingJob.remove).not.toHaveBeenCalled();
	});

	it('should throw when queue add fails with non-duplicate error', async () => {
		mockBookUpdateQueue.getJob.mockResolvedValue(null);
		mockBookUpdateQueue.add.mockRejectedValue(new Error('queue failure'));

		await expect(service.addBookToUpdateQueue('book-1')).rejects.toThrow(
			'queue failure',
		);
	});

	it('should enqueue multiple books sequentially', async () => {
		const addBookSpy = jest
			.spyOn(service, 'addBookToUpdateQueue')
			.mockResolvedValue(undefined);

		await service.addBooksToUpdateQueue(['book-1', 'book-2', 'book-3']);

		expect(addBookSpy).toHaveBeenNthCalledWith(1, 'book-1');
		expect(addBookSpy).toHaveBeenNthCalledWith(2, 'book-2');
		expect(addBookSpy).toHaveBeenNthCalledWith(3, 'book-3');
		expect(addBookSpy).toHaveBeenCalledTimes(3);
	});
});
