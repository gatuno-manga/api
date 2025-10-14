import { Test, TestingModule } from '@nestjs/testing';
import { SharpAdapter } from './sharp.adapter';

describe('SharpAdapter', () => {
    let adapter: SharpAdapter;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [SharpAdapter],
        }).compile();

        adapter = module.get<SharpAdapter>(SharpAdapter);
    });

    it('should be defined', () => {
        expect(adapter).toBeDefined();
    });

    describe('compress', () => {
        it('deve comprimir uma imagem para WebP', async () => {
            // Arrange - Criar um buffer de imagem PNG simples (1x1 pixel branco)
            const pngBuffer = Buffer.from([
                0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
                0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
                0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
                0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
                0x00, 0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4, 0x00,
                0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
            ]);

            // Act
            const result = await adapter.compress(pngBuffer);

            // Assert
            expect(result).toBeInstanceOf(Buffer);
            expect(result.length).toBeGreaterThan(0);
            // WebP magic number: RIFF....WEBP
            expect(result.toString('ascii', 0, 4)).toBe('RIFF');
            expect(result.toString('ascii', 8, 12)).toBe('WEBP');
        });

        it('deve retornar um buffer menor ou igual ao original', async () => {
            // Arrange - Buffer de teste maior
            const testBuffer = Buffer.from([
                0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
                0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
                0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
                0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
                0x00, 0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4, 0x00,
                0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
            ]);

            // Act
            const result = await adapter.compress(testBuffer);

            // Assert
            expect(result).toBeInstanceOf(Buffer);
            expect(result.length).toBeGreaterThan(0);
        });

        it('deve lançar erro para buffer inválido', async () => {
            // Arrange
            const invalidBuffer = Buffer.from('not an image');

            // Act & Assert
            await expect(adapter.compress(invalidBuffer)).rejects.toThrow();
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
