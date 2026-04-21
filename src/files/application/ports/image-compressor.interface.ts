export interface IImageCompressor {
	/**
	 * Comprime uma imagem recebida como Buffer
	 * @param buffer Buffer da imagem a ser comprimida
	 * @returns Promise com o Buffer da imagem comprimida
	 */
	compress(buffer: Buffer): Promise<Buffer>;
}
