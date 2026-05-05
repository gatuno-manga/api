import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { FileCleanupService } from './file-cleanup.service';
import { Page } from '@books/infrastructure/database/entities/page.entity';
import { Cover } from '@books/infrastructure/database/entities/cover.entity';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { Chapter } from '@books/infrastructure/database/entities/chapter.entity';
import { StoragePort } from '@files/application/ports/storage.port';

describe('FileCleanupService (S3)', () => {
	let service: FileCleanupService;
	let mockStoragePort: jest.Mocked<StoragePort>;
	let mockPageRepository: any;
	let mockCoverRepository: any;
	let mockBookRepository: any;
	let mockChapterRepository: any;
	let mockConfigService: any;

	beforeEach(async () => {
		mockPageRepository = {
			find: jest.fn().mockResolvedValue([]),
			count: jest.fn().mockResolvedValue(0),
			remove: jest.fn().mockResolvedValue(undefined),
		};
		mockCoverRepository = {
			find: jest.fn().mockResolvedValue([]),
			count: jest.fn().mockResolvedValue(0),
			remove: jest.fn().mockResolvedValue(undefined),
		};
		mockBookRepository = {
			find: jest.fn().mockResolvedValue([]),
			count: jest.fn().mockResolvedValue(0),
			remove: jest.fn().mockResolvedValue(undefined),
		};
		mockChapterRepository = {
			find: jest.fn().mockResolvedValue([]),
			count: jest.fn().mockResolvedValue(0),
			remove: jest.fn().mockResolvedValue(undefined),
		};
		mockConfigService = {
			get: jest.fn().mockReturnValue(10),
		};
		mockStoragePort = {
			save: jest.fn(),
			delete: jest.fn(),
			exists: jest.fn(),
			getStats: jest.fn(),
			getBuffer: jest.fn(),
			listAllFiles: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				FileCleanupService,
				{
					provide: getRepositoryToken(Page),
					useValue: mockPageRepository,
				},
				{
					provide: getRepositoryToken(Cover),
					useValue: mockCoverRepository,
				},
				{
					provide: getRepositoryToken(Book),
					useValue: mockBookRepository,
				},
				{
					provide: getRepositoryToken(Chapter),
					useValue: mockChapterRepository,
				},
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: 'STORAGE_PORT', useValue: mockStoragePort },
			],
		}).compile();

		service = module.get<FileCleanupService>(FileCleanupService);
	});

	afterEach(async () => {
		jest.resetAllMocks();
	});

	it('deve encontrar arquivos órfãos no storage', async () => {
		// Mock files in storage
		const mockFiles = [
			{ filename: 'ab/file1.webp', size: 100, mtime: new Date() },
			{ filename: 'cd/file2.webp', size: 200, mtime: new Date() },
			{ filename: 'orphan.webp', size: 300, mtime: new Date() },
		];

		async function* mockListFiles() {
			for (const file of mockFiles) {
				yield file;
			}
		}
		mockStoragePort.listAllFiles.mockReturnValue(mockListFiles() as any);

		// Mock referenced files in DB
		mockPageRepository.find.mockResolvedValueOnce([
			{ path: '/data/ab/file1.webp' },
		]);
		mockCoverRepository.find.mockResolvedValueOnce([
			{ url: '/data/cd/file2.webp' },
		]);

		const orphans = await service.findOrphanFiles();

		expect(orphans.length).toBe(1);
		expect(orphans[0].filename).toBe('orphan.webp');
	});

	it('deve calcular estatísticas de armazenamento a partir do storage', async () => {
		const mockFiles = [
			{ filename: 'f1.webp', size: 3, mtime: new Date() },
			{ filename: 'ab/f2.webp', size: 4, mtime: new Date() },
		];

		async function* mockListFiles() {
			for (const file of mockFiles) {
				yield file;
			}
		}
		mockStoragePort.listAllFiles.mockReturnValue(mockListFiles() as any);

		const stats = await service.getStorageStatistics();

		expect(stats.totalFiles).toBe(2);
		expect(stats.totalSize).toBe(7);
	});

	it('deve identificar arquivos ausentes no storage', async () => {
		mockPageRepository.find
			.mockResolvedValueOnce([
				{ id: 1, path: '/data/exists.webp' },
				{ id: 2, path: '/data/missing.webp' },
			])
			.mockResolvedValueOnce([]); // Para quebrar o loop

		mockStoragePort.exists.mockImplementation(
			async (key) => key === 'exists.webp',
		);

		const missing = await service.findMissingFiles();

		expect(missing.length).toBe(1);
		expect(missing[0].entityId).toBe(2);
		expect(missing[0].expectedPath).toBe('/data/missing.webp');
	});
});
