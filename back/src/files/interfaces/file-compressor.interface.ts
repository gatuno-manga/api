export interface IFileCompressor {
    /**
     * Comprime um arquivo recebido como Buffer
     * @param buffer Buffer do arquivo a ser comprimido
     * @returns Promise com o Buffer do arquivo comprimido
     */
    compress(buffer: Buffer): Promise<Buffer>;

    /**
     * Verifica se o compressor suporta o tipo de arquivo
     * @param extension Extensão do arquivo (ex: '.pdf', '.mp4', '.jpg')
     * @returns true se o compressor suporta o tipo de arquivo
     */
    supports(extension: string): boolean;

    /**
     * Retorna a extensão do arquivo comprimido
     * @param originalExtension Extensão original do arquivo
     * @returns Extensão do arquivo após compressão
     */
    getOutputExtension(originalExtension: string): string;

    /**
     * Lista todas as extensões suportadas por este compressor (opcional)
     * @returns Array de extensões suportadas
     */
    getSupportedExtensions?(): string[];
}
