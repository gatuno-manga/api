import { Test, type TestingModule } from '@nestjs/testing';
import { FileCompressorFactory } from '@files/infrastructure/adapters/file-compressor.factory';
import { StoragePort } from '@files/application/ports/storage.port';
import { FilesService } from './files.service';
import { StorageBucket } from '@common/enum/storage-bucket.enum';

describe('FilesService', () => {
	let service: FilesService;
	let mockCompressorFactory: jest.Mocked<FileCompressorFactory>;
	let mockStoragePort: jest.Mocked<StoragePort>;
	let mockEventPublisher: any;

	beforeEach(async () => {
		mockCompressorFactory = {
			compress: jest.fn(),
			hasCompressor: jest.fn(),
			getCompressor: jest.fn(),
			registerCompressor: jest.fn(),
			registerCompressors: jest.fn(),
			getSupportedExtensions: jest.fn(),
		} as any;

		mockStoragePort = {
			save: jest.fn(),
			delete: jest.fn(),
			exists: jest.fn(),
			getStats: jest.fn(),
			getBuffer: jest.fn(),
			listAllFiles: jest.fn(),
		};

		mockEventPublisher = {
			publishImageProcessingRequest: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				FilesService,
				{
					provide: FileCompressorFactory,
					useValue: mockCompressorFactory,
				},
				{
					provide: 'STORAGE_PORT',
					useValue: mockStoragePort,
				},
				{
					provide: 'EVENT_PUBLISHER_PORT',
					useValue: mockEventPublisher,
				},
			],
		}).compile();

		service = module.get<FilesService>(FilesService);

		mockStoragePort.save.mockImplementation(
			async (
				buffer: Buffer,
				fileKey: string,
				mimeType: string,
				bucket?: string,
			) => fileKey,
		);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('saveBufferFile', () => {
		it('deve salvar arquivo raw no bucket processing e publicar evento Kafka', async () => {
			const buffer = Buffer.from('test image');
			const extension = '.jpg';
			const bucket = StorageBucket.BOOKS;

			const result = await service.saveBufferFile(
				buffer,
				extension,
				bucket,
			);

			// Verifica se salvou no bucket processing
			expect(mockStoragePort.save).toHaveBeenCalledWith(
				buffer,
				expect.any(String),
				'image/jpeg',
				StorageBucket.PROCESSING,
			);

			// Verifica se publicou o evento Kafka
			expect(
				mockEventPublisher.publishImageProcessingRequest,
			).toHaveBeenCalledWith({
				rawPath: expect.stringMatching(/^processing\/.+\/.+\.jpg$/),
				targetBucket: bucket,
				targetPath: expect.stringMatching(/^.+\/.+\.webp$/),
			});

			// Verifica o retorno (deve ser o caminho no bucket processing)
			expect(result).toMatch(/^processing\/.+\/.+\.jpg$/);
		});

		it('deve gerar UUID único para cada arquivo', async () => {
			const buffer = Buffer.from('test');
			const extension = '.png';

			const result1 = await service.saveBufferFile(buffer, extension);
			const result2 = await service.saveBufferFile(buffer, extension);

			expect(result1).not.toBe(result2);
			expect(result1).toMatch(/^processing\/.+\/.+\.png$/);
			expect(result2).toMatch(/^processing\/.+\/.+\.png$/);
		});
	});

	describe('saveBase64File', () => {
		it('deve converter base64 para buffer e chamar saveBufferFile', async () => {
			const base64Data = Buffer.from('test image').toString('base64');
			const extension = '.jpg';

			const result = await service.saveBase64File(base64Data, extension);

			expect(mockStoragePort.save).toHaveBeenCalledWith(
				Buffer.from(base64Data, 'base64'),
				expect.any(String),
				'image/jpeg',
				StorageBucket.PROCESSING,
			);
			expect(
				mockEventPublisher.publishImageProcessingRequest,
			).toHaveBeenCalled();
			expect(result).toMatch(/^processing\/.+\/.+\.jpg$/);
		});
	});

	describe('deleteFile', () => {
		it('deve chamar storagePort.delete com o fileKey correto quando bucket é fornecido', async () => {
			const publicPath = 'books/ab/uuid.webp';
			await service.deleteFile(publicPath, StorageBucket.BOOKS);

			expect(mockStoragePort.delete).toHaveBeenCalledWith(
				'ab/uuid.webp',
				StorageBucket.BOOKS,
			);
		});

		it('deve lidar com caminhos do bucket processing', async () => {
			const publicPath = 'processing/ab/uuid.jpg';
			await service.deleteFile(publicPath, StorageBucket.PROCESSING);

			expect(mockStoragePort.delete).toHaveBeenCalledWith(
				'ab/uuid.jpg',
				StorageBucket.PROCESSING,
			);
		});
	});
});
