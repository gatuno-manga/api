import { Test, type TestingModule } from '@nestjs/testing';
import * as sharp from 'sharp';
import { SharpAdapter } from './sharp.adapter';

// Mock do sharp
jest.mock('sharp');

describe('SharpAdapter', () => {
	let adapter: SharpAdapter;
	let mockSharp: any;

	beforeEach(async () => {
		// Setup mock
		mockSharp = {
			webp: jest.fn().mockReturnThis(),
			toBuffer: jest
				.fn()
				.mockResolvedValue(Buffer.from('compressed-webp-data')),
		};
		(sharp as any).mockReturnValue(mockSharp);

		const module: TestingModule = await Test.createTestingModule({
			providers: [SharpAdapter],
		}).compile();

		adapter = module.get<SharpAdapter>(SharpAdapter);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(adapter).toBeDefined();
	});

	describe('compress', () => {
		it('deve comprimir uma imagem para WebP', async () => {
			// Arrange
			const inputBuffer = Buffer.from('test-image-data');

			// Act
			const result = await adapter.compress(inputBuffer);

			// Assert
			expect(sharp).toHaveBeenCalledWith(inputBuffer);
			expect(mockSharp.webp).toHaveBeenCalledWith({
				lossless: false,
				quality: 80,
			});
			expect(mockSharp.toBuffer).toHaveBeenCalled();
			expect(result).toBeInstanceOf(Buffer);
		});

		it('deve retornar um buffer válido', async () => {
			// Arrange
			const testBuffer = Buffer.from('test-data');

			// Act
			const result = await adapter.compress(testBuffer);

			// Assert
			expect(result).toBeInstanceOf(Buffer);
			expect(result.length).toBeGreaterThan(0);
		});

		it('deve lançar erro quando sharp falhar', async () => {
			// Arrange
			const invalidBuffer = Buffer.from('invalid-data');
			mockSharp.toBuffer.mockRejectedValueOnce(
				new Error('Sharp processing failed'),
			);

			// Act & Assert
			await expect(adapter.compress(invalidBuffer)).rejects.toThrow(
				'Sharp processing failed',
			);
		});
	});

	describe('supports', () => {
		it('deve suportar formatos de imagem comuns', () => {
			expect(adapter.supports('.jpg')).toBe(true);
			expect(adapter.supports('.jpeg')).toBe(true);
			expect(adapter.supports('.png')).toBe(true);
			expect(adapter.supports('.webp')).toBe(true);
			expect(adapter.supports('.gif')).toBe(true);
		});

		it('deve ser case-insensitive', () => {
			expect(adapter.supports('.JPG')).toBe(true);
			expect(adapter.supports('.PNG')).toBe(true);
		});

		it('não deve suportar outros formatos', () => {
			expect(adapter.supports('.pdf')).toBe(false);
			expect(adapter.supports('.mp4')).toBe(false);
			expect(adapter.supports('.txt')).toBe(false);
		});
	});

	describe('getOutputExtension', () => {
		it('deve sempre retornar .webp', () => {
			expect(adapter.getOutputExtension('.jpg')).toBe('.webp');
			expect(adapter.getOutputExtension('.png')).toBe('.webp');
			expect(adapter.getOutputExtension('.gif')).toBe('.webp');
		});
	});

	describe('libvips cache desabilitado', () => {
		it('deve chamar sharp.cache(false) ao carregar o módulo para evitar vazamento de memória', () => {
			// sharp.cache(false) é chamado no escopo do módulo (fora de qualquer classe).
			// jest.isolateModules força a re-avaliação do módulo com o spy no lugar,
			// contornando o cache de módulo do Jest e o afterEach(() => clearAllMocks).
			jest.isolateModules(() => {
				const sharpMock = require('sharp');
				sharpMock.cache = jest.fn();
				require('./sharp.adapter'); // re-executa o módulo → chama sharp.cache(false)
				expect(sharpMock.cache).toHaveBeenCalledWith(false);
			});
		});
	});

	describe('getSupportedExtensions', () => {
		it('deve retornar lista de extensões suportadas', () => {
			const extensions = adapter.getSupportedExtensions();

			expect(Array.isArray(extensions)).toBe(true);
			expect(extensions.length).toBeGreaterThan(0);
			expect(extensions).toContain('.jpg');
			expect(extensions).toContain('.png');
			expect(extensions).toContain('.webp');
		});

		it('deve retornar cópia do array interno', () => {
			const extensions1 = adapter.getSupportedExtensions();
			const extensions2 = adapter.getSupportedExtensions();

			expect(extensions1).toEqual(extensions2);
			expect(extensions1).not.toBe(extensions2);
		});
	});
});
