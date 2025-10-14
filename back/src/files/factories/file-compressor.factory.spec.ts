import { Test, TestingModule } from '@nestjs/testing';
import { FileCompressorFactory } from './file-compressor.factory';
import { IFileCompressor } from '../interfaces/file-compressor.interface';

describe('FileCompressorFactory', () => {
    let factory: FileCompressorFactory;
    let mockImageCompressor: IFileCompressor;
    let mockPdfCompressor: IFileCompressor;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [FileCompressorFactory],
        }).compile();

        factory = module.get<FileCompressorFactory>(FileCompressorFactory);

        // Mock compressors
        mockImageCompressor = {
            compress: jest.fn().mockResolvedValue(Buffer.from('compressed image')),
            supports: jest.fn((ext) => ['.jpg', '.png'].includes(ext)),
            getOutputExtension: jest.fn(() => '.webp'),
        };

        mockPdfCompressor = {
            compress: jest.fn().mockResolvedValue(Buffer.from('compressed pdf')),
            supports: jest.fn((ext) => ext === '.pdf'),
            getOutputExtension: jest.fn(() => '.pdf'),
        };
    });

    it('should be defined', () => {
        expect(factory).toBeDefined();
    });

    describe('registerCompressor', () => {
        it('deve registrar um compressor', () => {
            factory.registerCompressor(mockImageCompressor);
            expect(factory.getCompressor('.jpg')).toBe(mockImageCompressor);
        });
    });

    describe('registerCompressors', () => {
        it('deve registrar múltiplos compressors', () => {
            factory.registerCompressors([mockImageCompressor, mockPdfCompressor]);

            expect(factory.getCompressor('.jpg')).toBe(mockImageCompressor);
            expect(factory.getCompressor('.pdf')).toBe(mockPdfCompressor);
        });
    });

    describe('getCompressor', () => {
        beforeEach(() => {
            factory.registerCompressors([mockImageCompressor, mockPdfCompressor]);
        });

        it('deve retornar o compressor correto para imagens', () => {
            expect(factory.getCompressor('.jpg')).toBe(mockImageCompressor);
            expect(factory.getCompressor('.png')).toBe(mockImageCompressor);
        });

        it('deve retornar o compressor correto para PDFs', () => {
            expect(factory.getCompressor('.pdf')).toBe(mockPdfCompressor);
        });

        it('deve retornar null para extensões não suportadas', () => {
            expect(factory.getCompressor('.txt')).toBeNull();
            expect(factory.getCompressor('.doc')).toBeNull();
        });

        it('deve ser case-insensitive', () => {
            expect(factory.getCompressor('.JPG')).toBe(mockImageCompressor);
            expect(factory.getCompressor('.PDF')).toBe(mockPdfCompressor);
        });
    });

    describe('compress', () => {
        beforeEach(() => {
            factory.registerCompressors([mockImageCompressor, mockPdfCompressor]);
        });

        it('deve comprimir usando o compressor adequado', async () => {
            const buffer = Buffer.from('test image');
            const result = await factory.compress(buffer, '.jpg');

            expect(mockImageCompressor.compress).toHaveBeenCalledWith(buffer);
            expect(result.buffer.toString()).toBe('compressed image');
            expect(result.extension).toBe('.webp');
        });

        it('deve retornar buffer original se não houver compressor', async () => {
            const buffer = Buffer.from('test file');
            const result = await factory.compress(buffer, '.txt');

            expect(result.buffer).toBe(buffer);
            expect(result.extension).toBe('.txt');
        });

        it('deve retornar buffer original em caso de erro', async () => {
            const buffer = Buffer.from('test');
            mockImageCompressor.compress = jest.fn().mockRejectedValue(new Error('Compression failed'));

            const result = await factory.compress(buffer, '.jpg');

            expect(result.buffer).toBe(buffer);
            expect(result.extension).toBe('.jpg');
        });
    });

    describe('hasCompressor', () => {
        beforeEach(() => {
            factory.registerCompressors([mockImageCompressor, mockPdfCompressor]);
        });

        it('deve retornar true para extensões suportadas', () => {
            expect(factory.hasCompressor('.jpg')).toBe(true);
            expect(factory.hasCompressor('.pdf')).toBe(true);
        });

        it('deve retornar false para extensões não suportadas', () => {
            expect(factory.hasCompressor('.txt')).toBe(false);
            expect(factory.hasCompressor('.doc')).toBe(false);
        });
    });

    describe('getSupportedExtensions', () => {
        it('deve retornar array vazio sem compressores', () => {
            const extensions = factory.getSupportedExtensions();
            expect(extensions).toEqual([]);
        });

        it('deve retornar extensões de compressores registrados', () => {
            // Adiciona método getSupportedExtensions aos mocks
            mockImageCompressor.getSupportedExtensions = jest.fn(() => ['.jpg', '.png']);
            mockPdfCompressor.getSupportedExtensions = jest.fn(() => ['.pdf']);

            factory.registerCompressors([mockImageCompressor, mockPdfCompressor]);

            const extensions = factory.getSupportedExtensions();

            expect(extensions).toContain('.jpg');
            expect(extensions).toContain('.png');
            expect(extensions).toContain('.pdf');
            expect(extensions.length).toBe(3);
        });

        it('deve retornar array ordenado', () => {
            mockImageCompressor.getSupportedExtensions = jest.fn(() => ['.png', '.jpg']);
            factory.registerCompressor(mockImageCompressor);

            const extensions = factory.getSupportedExtensions();

            expect(extensions).toEqual(['.jpg', '.png']);
        });

        it('deve remover duplicatas', () => {
            const mockCompressor1 = {
                ...mockImageCompressor,
                getSupportedExtensions: jest.fn(() => ['.jpg', '.png']),
            };
            const mockCompressor2 = {
                ...mockPdfCompressor,
                getSupportedExtensions: jest.fn(() => ['.jpg', '.pdf']),
            };

            factory.registerCompressors([mockCompressor1, mockCompressor2]);

            const extensions = factory.getSupportedExtensions();

            expect(extensions.filter(ext => ext === '.jpg').length).toBe(1);
        });
    });
});
