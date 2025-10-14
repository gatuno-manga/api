import { Test, TestingModule } from '@nestjs/testing';
import { FilesService } from './files.service';
import { FileCompressorFactory } from './factories/file-compressor.factory';

describe('FilesService', () => {
	let service: FilesService;
	let mockCompressorFactory: jest.Mocked<FileCompressorFactory>;

	beforeEach(async () => {
		mockCompressorFactory = {
			compress: jest.fn(),
			hasCompressor: jest.fn(),
			getCompressor: jest.fn(),
			registerCompressor: jest.fn(),
			registerCompressors: jest.fn(),
			getSupportedExtensions: jest.fn(),
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				FilesService,
				{
					provide: FileCompressorFactory,
					useValue: mockCompressorFactory,
				},
			],
		}).compile();

		service = module.get<FilesService>(FilesService);
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

	describe('saveBase64File', () => {
		it('deve salvar arquivo com compressão quando disponível', async () => {
			const base64Data = Buffer.from('test image').toString('base64');
			const extension = '.jpg';
			mockCompressorFactory.hasCompressor.mockReturnValue(true);
			mockCompressorFactory.compress.mockResolvedValue({
				buffer: Buffer.from('compressed'),
				extension: '.webp',
			});

			const result = await service.saveBase64File(base64Data, extension);

			expect(mockCompressorFactory.hasCompressor).toHaveBeenCalledWith(extension);
			expect(mockCompressorFactory.compress).toHaveBeenCalled();
			expect(result).toMatch(/^\/data\/.+\.webp$/);
		});

		it('deve salvar arquivo sem compressão quando não disponível', async () => {
			const base64Data = Buffer.from('test document').toString('base64');
			const extension = '.txt';
			mockCompressorFactory.hasCompressor.mockReturnValue(false);

			const result = await service.saveBase64File(base64Data, extension);

			expect(mockCompressorFactory.hasCompressor).toHaveBeenCalledWith(extension);
			expect(mockCompressorFactory.compress).not.toHaveBeenCalled();
			expect(result).toMatch(/^\/data\/.+\.txt$/);
		});
	});
});
