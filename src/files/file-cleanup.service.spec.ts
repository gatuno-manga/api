import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { FileCleanupService } from './file-cleanup.service';
import { Page } from '../books/entities/page.entity';
import { Cover } from '../books/entities/cover.entity';
import { Book } from '../books/entities/book.entity';
import { Chapter } from '../books/entities/chapter.entity';

describe('FileCleanupService (Recursive)', () => {
	let service: FileCleanupService;
	const mockDownloadDir = path.resolve('/tmp/gatuno-test-cleanup');

	const mockPageRepository = {
		find: jest.fn().mockResolvedValue([]),
		count: jest.fn().mockResolvedValue(0),
	};
	const mockCoverRepository = {
		find: jest.fn().mockResolvedValue([]),
		count: jest.fn().mockResolvedValue(0),
	};
	const mockBookRepository = {
		find: jest.fn().mockResolvedValue([]),
		count: jest.fn().mockResolvedValue(0),
	};
	const mockChapterRepository = {
		find: jest.fn().mockResolvedValue([]),
		count: jest.fn().mockResolvedValue(0),
	};
	const mockConfigService = {
		get: jest.fn().mockReturnValue(10),
	};

	beforeEach(async () => {
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
			],
		}).compile();

		service = module.get<FileCleanupService>(FileCleanupService);
		// Override private downloadDir for testing
		(service as any).downloadDir = mockDownloadDir;

		// Create mock directories
		await fs.mkdir(mockDownloadDir, { recursive: true });
		await fs.mkdir(path.join(mockDownloadDir, 'ab'), { recursive: true });
		await fs.mkdir(path.join(mockDownloadDir, 'cd'), { recursive: true });
		await fs.mkdir(path.join(mockDownloadDir, 'cache'), {
			recursive: true,
		});
	});

	afterEach(async () => {
		await fs.rm(mockDownloadDir, { recursive: true, force: true });
		jest.clearAllMocks();
	});

	it('deve encontrar arquivos em subdiretórios recursivamente', async () => {
		// Arquivo na raiz
		await fs.writeFile(path.join(mockDownloadDir, 'raiz.webp'), 'data');
		// Arquivo no shard ab
		await fs.writeFile(
			path.join(mockDownloadDir, 'ab', 'file1.webp'),
			'data',
		);
		// Arquivo no shard cd
		await fs.writeFile(
			path.join(mockDownloadDir, 'cd', 'file2.webp'),
			'data',
		);
		// Arquivo no cache (deve ser ignorado)
		await fs.writeFile(
			path.join(mockDownloadDir, 'cache', 'temp.webp'),
			'data',
		);

		const orphans = await service.findOrphanFiles();

		// Deve encontrar 3 arquivos órfãos (raiz.webp, ab/file1.webp, cd/file2.webp)
		// Ignorando cache/temp.webp
		expect(orphans.length).toBe(3);
		const filenames = orphans.map((o) => o.filename);
		expect(filenames).toContain('raiz.webp');
		expect(filenames).toContain(path.join('ab', 'file1.webp'));
		expect(filenames).toContain(path.join('cd', 'file2.webp'));
		expect(filenames).not.toContain(path.join('cache', 'temp.webp'));
	});

	it('deve calcular estatísticas de armazenamento recursivamente', async () => {
		await fs.writeFile(path.join(mockDownloadDir, 'f1.webp'), '123'); // 3 bytes
		await fs.writeFile(path.join(mockDownloadDir, 'ab', 'f2.webp'), '4567'); // 4 bytes

		const stats = await service.getStorageStatistics();

		expect(stats.totalFiles).toBe(2);
		expect(stats.totalSize).toBe(7);
	});
});
