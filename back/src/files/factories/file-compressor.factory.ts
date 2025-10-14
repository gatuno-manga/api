import { Injectable, Logger } from '@nestjs/common';
import { IFileCompressor } from '../interfaces/file-compressor.interface';

/**
 * Factory para selecionar o compressor adequado baseado no tipo de arquivo
 */
@Injectable()
export class FileCompressorFactory {
    private readonly logger = new Logger(FileCompressorFactory.name);
    private compressors: IFileCompressor[] = [];

    /**
     * Registra um compressor
     * @param compressor Implementação de IFileCompressor
     */
    registerCompressor(compressor: IFileCompressor): void {
        this.compressors.push(compressor);
    }

    /**
     * Registra múltiplos compressores
     * @param compressors Array de implementações de IFileCompressor
     */
    registerCompressors(compressors: IFileCompressor[]): void {
        this.compressors.push(...compressors);
    }

    /**
     * Seleciona o compressor adequado para o tipo de arquivo
     * @param extension Extensão do arquivo (ex: '.pdf', '.mp4', '.jpg')
     * @returns IFileCompressor adequado ou null se nenhum suportar
     */
    getCompressor(extension: string): IFileCompressor | null {
        const normalizedExtension = extension.toLowerCase();

        const compressor = this.compressors.find((c) =>
            c.supports(normalizedExtension),
        );

        if (!compressor) {
            this.logger.warn(
                `Nenhum compressor encontrado para extensão: ${extension}`,
            );
            return null;
        }

        this.logger.debug(
            `Compressor selecionado para ${extension}: ${compressor.constructor.name}`,
        );
        return compressor;
    }

    /**
     * Comprime um arquivo usando o compressor adequado
     * @param buffer Buffer do arquivo
     * @param extension Extensão do arquivo
     * @returns Objeto com buffer comprimido e nova extensão
     */
    async compress(
        buffer: Buffer,
        extension: string,
    ): Promise<{ buffer: Buffer; extension: string }> {
        const compressor = this.getCompressor(extension);

        if (!compressor) {
            return { buffer, extension };
        }

        try {
            const compressedBuffer = await compressor.compress(buffer);
            const outputExtension = compressor.getOutputExtension(extension);

            return {
                buffer: compressedBuffer,
                extension: outputExtension,
            };
        } catch (error) {
            this.logger.error(
                `Erro ao comprimir arquivo ${extension}:`,
                error,
            );
            return { buffer, extension };
        }
    }

    /**
     * Verifica se há um compressor disponível para o tipo de arquivo
     * @param extension Extensão do arquivo
     * @returns true se houver compressor disponível
     */
    hasCompressor(extension: string): boolean {
        return this.getCompressor(extension) !== null;
    }

    /**
     * Lista todas as extensões suportadas
     * @returns Array com todas as extensões suportadas
     */
    getSupportedExtensions(): string[] {
        const extensions = new Set<string>();

        // Coleta extensões de todos os compressores que implementam o método
        for (const compressor of this.compressors) {
            if (compressor.getSupportedExtensions) {
                const compressorExtensions = compressor.getSupportedExtensions();
                compressorExtensions.forEach((ext) => extensions.add(ext));
            }
        }

        return Array.from(extensions).sort();
    }
}
