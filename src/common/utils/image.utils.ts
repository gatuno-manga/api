import sharp from 'sharp';

/**
 * Extrai as dimensões (largura e altura) de um buffer de imagem.
 * @param buffer O buffer da imagem.
 * @returns Um objeto com largura e altura, ou undefined se não for possível extrair.
 */
export async function getImageDimensions(
	buffer: Buffer,
): Promise<{ width: number; height: number } | undefined> {
	try {
		const metadata = await sharp(buffer).metadata();

		if (metadata.width === undefined) {
			return undefined;
		}

		if (metadata.height === undefined) {
			return undefined;
		}

		return { width: metadata.width, height: metadata.height };
	} catch {
		return undefined;
	}
}
