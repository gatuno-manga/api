import { Test, type TestingModule } from '@nestjs/testing';
import { FixChapterService } from './fix-chapter.service';

describe('FixChapterService', () => {
	let service: FixChapterService;

	const mockFixChapterQueue = {
		add: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				FixChapterService,
				{
					provide: 'BullQueue_fix-chapter-queue',
					useValue: mockFixChapterQueue,
				},
			],
		}).compile();

		service = module.get<FixChapterService>(FixChapterService);
	});

	it('should enqueue chapter fix job', async () => {
		mockFixChapterQueue.add.mockResolvedValue(undefined);

		await service.addChapterToFixQueue('chapter-1');

		expect(mockFixChapterQueue.add).toHaveBeenCalledWith(
			'fix-chapter',
			{ chapterId: 'chapter-1' },
			{ jobId: 'fix-chapter-chapter-1' },
		);
	});

	it('should ignore duplicate job enqueue error', async () => {
		mockFixChapterQueue.add.mockRejectedValue(
			new Error('Job with this id already exists'),
		);

		await expect(
			service.addChapterToFixQueue('chapter-1'),
		).resolves.toBeUndefined();
	});

	it('should throw non-duplicate enqueue errors', async () => {
		mockFixChapterQueue.add.mockRejectedValue(new Error('queue offline'));

		await expect(service.addChapterToFixQueue('chapter-1')).rejects.toThrow(
			'queue offline',
		);
	});
});
