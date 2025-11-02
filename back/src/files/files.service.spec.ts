import { Test, TestingModule } from '@nestjs/testing';
import { FilesService } from './files.service';
import { FileCompressorFactory } from './factories/file-compressor.factory';
import * as fs from 'fs/promises';

// Mock do fs
jest.mock('fs/promises');

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

		// Mock do fs.writeFile para não escrever arquivos realmente
		(fs.writeFile as jest.Mock).mockResolvedValue(undefined);
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

			expect(mockCompressorFactory.hasCompressor).toHaveBeenCalledWith(extension);
			expect(mockCompressorFactory.compress).toHaveBeenCalledWith(buffer, extension);
			expect(fs.writeFile).toHaveBeenCalled();
			expect(result).toMatch(/^\/data\/.+\.webp$/);
		});

		it('deve salvar arquivo sem compressão quando não disponível', async () => {
			const buffer = Buffer.from('test document');
			const extension = '.txt';
			mockCompressorFactory.hasCompressor.mockReturnValue(false);

			const result = await service.saveBufferFile(buffer, extension);

			expect(mockCompressorFactory.hasCompressor).toHaveBeenCalledWith(extension);
			expect(mockCompressorFactory.compress).not.toHaveBeenCalled();
			expect(fs.writeFile).toHaveBeenCalled();
			expect(result).toMatch(/^\/data\/.+\.txt$/);
		});

		it('deve fazer fallback para buffer original quando compressão falha', async () => {
			const buffer = Buffer.from('test image');
			const extension = '.jpg';
			mockCompressorFactory.hasCompressor.mockReturnValue(true);
			mockCompressorFactory.compress.mockRejectedValue(new Error('Compression failed'));

			const result = await service.saveBufferFile(buffer, extension);

			expect(mockCompressorFactory.hasCompressor).toHaveBeenCalledWith(extension);
			expect(mockCompressorFactory.compress).toHaveBeenCalled();
			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.any(String),
				buffer
			);
			expect(result).toMatch(/^\/data\/.+\.jpg$/);
		});

		it('deve gerar UUID único para cada arquivo', async () => {
			const buffer = Buffer.from('test');
			const extension = '.png';
			mockCompressorFactory.hasCompressor.mockReturnValue(false);

			const result1 = await service.saveBufferFile(buffer, extension);
			const result2 = await service.saveBufferFile(buffer, extension);

			expect(result1).not.toBe(result2);
			expect(result1).toMatch(/^\/data\/.+\.png$/);
			expect(result2).toMatch(/^\/data\/.+\.png$/);
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

			expect(mockCompressorFactory.hasCompressor).toHaveBeenCalledWith(extension);
			expect(mockCompressorFactory.compress).toHaveBeenCalledWith(
				Buffer.from(base64Data, 'base64'),
				extension
			);
			expect(fs.writeFile).toHaveBeenCalled();
			expect(result).toMatch(/^\/data\/.+\.webp$/);
		});

		it('deve salvar arquivo sem compressão quando não disponível', async () => {
			const base64Data = Buffer.from('test document').toString('base64');
			const extension = '.txt';
			mockCompressorFactory.hasCompressor.mockReturnValue(false);

			const result = await service.saveBase64File(base64Data, extension);

			expect(mockCompressorFactory.hasCompressor).toHaveBeenCalledWith(extension);
			expect(mockCompressorFactory.compress).not.toHaveBeenCalled();
			expect(fs.writeFile).toHaveBeenCalled();
			expect(result).toMatch(/^\/data\/.+\.txt$/);
		});

		it('deve manter compatibilidade com código legado', async () => {
			const testData = 'test image data';
			const base64Data = Buffer.from(testData).toString('base64');
			const extension = '.jpg';
			mockCompressorFactory.hasCompressor.mockReturnValue(false);

			const result = await service.saveBase64File(base64Data, extension);

			// Verifica que o arquivo foi escrito com o conteúdo correto
			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.any(String),
				Buffer.from(testData)
			);
			expect(result).toMatch(/^\/data\/.+\.jpg$/);
		});
	});
});
