import { Test, type TestingModule } from '@nestjs/testing';
import { FileCompressorFactory } from '../../infrastructure/adapters/file-compressor.factory';
import { StoragePort } from '../ports/storage.port';
import { FilesService } from './files.service';

describe('FilesService', () => {
	let service: FilesService;
	let mockCompressorFactory: jest.Mocked<FileCompressorFactory>;
	let mockStoragePort: jest.Mocked<StoragePort>;

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
			listAllFiles: jest.fn(),
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
			],
		}).compile();

		service = module.get<FilesService>(FilesService);

		mockStoragePort.save.mockImplementation(
			async (buffer: Buffer, fileKey: string) => `/data/${fileKey}`,
		);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('compressFile', () => {
		it('deve comprimir um arquivo usando a factory', async () => {
			const base64Data = Buffer.from('test file').toString('base64');
			const extension = '.jpg';
			const compressedBuffer = Buffer.from('compressed');
			mockCompressorFactory.compress.mockResolvedValue({
				buffer: compressedBuffer,
				extension: '.webp',
			});

			const result = await service.compressFile(base64Data, extension);

			expect(mockCompressorFactory.compress).toHaveBeenCalledWith(
				Buffer.from(base64Data, 'base64'),
				extension,
			);
			expect(result.buffer).toBe(compressedBuffer);
			expect(result.extension).toBe('.webp');
		});
	});

	describe('saveBufferFile', () => {
		it('deve salvar arquivo com compressão quando disponível', async () => {
			const buffer = Buffer.from('test image');
			const extension = '.jpg';
			mockCompressorFactory.hasCompressor.mockReturnValue(true);
			mockCompressorFactory.compress.mockResolvedValue({
				buffer: Buffer.from('compressed'),
				extension: '.webp',
			});

			const result = await service.saveBufferFile(buffer, extension);

			expect(mockCompressorFactory.hasCompressor).toHaveBeenCalledWith(
				extension,
			);
			expect(mockCompressorFactory.compress).toHaveBeenCalledWith(
				buffer,
				extension,
			);
			expect(mockStoragePort.save).toHaveBeenCalled();
			expect(result).toMatch(/^\/data\/.+\/.+\.webp$/);
		});

		it('deve salvar arquivo sem compressão quando não disponível', async () => {
			const buffer = Buffer.from('test document');
			const extension = '.txt';
			mockCompressorFactory.hasCompressor.mockReturnValue(false);

			const result = await service.saveBufferFile(buffer, extension);

			expect(mockCompressorFactory.hasCompressor).toHaveBeenCalledWith(
				extension,
			);
			expect(mockCompressorFactory.compress).not.toHaveBeenCalled();
			expect(mockStoragePort.save).toHaveBeenCalled();
			expect(result).toMatch(/^\/data\/.+\/.+\.txt$/);
		});

		it('deve fazer fallback para buffer original quando compressão falha', async () => {
			const buffer = Buffer.from('test image');
			const extension = '.jpg';
			mockCompressorFactory.hasCompressor.mockReturnValue(true);
			mockCompressorFactory.compress.mockRejectedValue(
				new Error('Compression failed'),
			);

			const result = await service.saveBufferFile(buffer, extension);

			expect(mockCompressorFactory.hasCompressor).toHaveBeenCalledWith(
				extension,
			);
			expect(mockCompressorFactory.compress).toHaveBeenCalled();
			expect(mockStoragePort.save).toHaveBeenCalledWith(
				buffer,
				expect.any(String),
				expect.any(String),
			);
			expect(result).toMatch(/^\/data\/.+\/.+\.jpg$/);
		});

		it('deve gerar UUID único para cada arquivo', async () => {
			const buffer = Buffer.from('test');
			const extension = '.png';
			mockCompressorFactory.hasCompressor.mockReturnValue(false);

			const result1 = await service.saveBufferFile(buffer, extension);
			const result2 = await service.saveBufferFile(buffer, extension);

			expect(result1).not.toBe(result2);
			expect(result1).toMatch(/^\/data\/.+\/.+\.png$/);
			expect(result2).toMatch(/^\/data\/.+\/.+\.png$/);
		});
	});

	describe('saveBase64File', () => {
		it('deve converter base64 para buffer e chamar saveBufferFile', async () => {
			const base64Data = Buffer.from('test image').toString('base64');
			const extension = '.jpg';
			mockCompressorFactory.hasCompressor.mockReturnValue(true);
			mockCompressorFactory.compress.mockResolvedValue({
				buffer: Buffer.from('compressed'),
				extension: '.webp',
			});

			const result = await service.saveBase64File(base64Data, extension);

			expect(mockCompressorFactory.hasCompressor).toHaveBeenCalledWith(
				extension,
			);
			expect(mockCompressorFactory.compress).toHaveBeenCalledWith(
				Buffer.from(base64Data, 'base64'),
				extension,
			);
			expect(mockStoragePort.save).toHaveBeenCalled();
			expect(result).toMatch(/^\/data\/.+\/.+\.webp$/);
		});

		it('deve salvar arquivo sem compressão quando não disponível', async () => {
			const base64Data = Buffer.from('test document').toString('base64');
			const extension = '.txt';
			mockCompressorFactory.hasCompressor.mockReturnValue(false);

			const result = await service.saveBase64File(base64Data, extension);

			expect(mockCompressorFactory.hasCompressor).toHaveBeenCalledWith(
				extension,
			);
			expect(mockCompressorFactory.compress).not.toHaveBeenCalled();
			expect(mockStoragePort.save).toHaveBeenCalled();
			expect(result).toMatch(/^\/data\/.+\/.+\.txt$/);
		});
	});

	describe('deleteFile', () => {
		it('deve chamar storagePort.delete com o fileKey correto', async () => {
			const publicPath = '/data/ab/uuid.webp';
			await service.deleteFile(publicPath);

			expect(mockStoragePort.delete).toHaveBeenCalledWith('ab/uuid.webp');
		});
	});
});
