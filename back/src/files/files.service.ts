import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { FileCompressorFactory } from './factories/file-compressor.factory';

@Injectable()
export class FilesService {
	private downloadDir = path.resolve('/usr/src/app/data');
	private readonly logger = new Logger(FilesService.name);

	constructor(
		private readonly compressorFactory: FileCompressorFactory,
	) {}

	private getPublicPath(fileName: string): string {
		return `/data/${fileName}`;
	}

	async compressFile(
		base64Data: string,
		extension: string,
	): Promise<{ buffer: Buffer; extension: string }> {
		const buffer = Buffer.from(base64Data, 'base64');
		return await this.compressorFactory.compress(buffer, extension);
	}

	/**
	 * Salva um arquivo a partir de um Buffer (mais performático)
	 * @param buffer Buffer contendo os dados do arquivo
	 * @param extension Extensão do arquivo (ex: '.jpg', '.png')
	 * @returns Caminho público do arquivo salvo
	 */
	async saveBufferFile(
		buffer: Buffer,
		extension: string,
	): Promise<string> {
		let fileBuffer: Buffer;
		let finalExtension = extension;

		if (this.compressorFactory.hasCompressor(extension)) {
			try {
				const result = await this.compressorFactory.compress(buffer, extension);
				fileBuffer = result.buffer;
				finalExtension = result.extension;
				this.logger.log(
					`Arquivo comprimido: ${extension} -> ${finalExtension}`,
				);
			} catch (error) {
				this.logger.error(
					'Erro ao comprimir arquivo, salvando original:',
					error,
				);
				fileBuffer = buffer;
			}
		} else {
			this.logger.debug(
				`Nenhum compressor disponível para ${extension}, salvando original`,
			);
			fileBuffer = buffer;
		}

		const fileName = `${uuidv4()}${finalExtension}`;
		const filePath = path.join(this.downloadDir, fileName);
		await fs.writeFile(filePath, fileBuffer);

		return this.getPublicPath(fileName);
	}

	/**
	 * Salva um arquivo a partir de uma string base64
	 * @deprecated Use saveBufferFile para melhor performance quando possível
	 * @param base64Data String base64 contendo os dados do arquivo
	 * @param extension Extensão do arquivo (ex: '.jpg', '.png')
	 * @returns Caminho público do arquivo salvo
	 */
	async saveBase64File(
		base64Data: string,
		extension: string,
	): Promise<string> {
		const buffer = Buffer.from(base64Data, 'base64');
		return this.saveBufferFile(buffer, extension);
	}

	/**
	 * Deleta um arquivo do sistema de arquivos
	 * @param publicPath Caminho público do arquivo (ex: '/data/arquivo.jpg')
	 */
	async deleteFile(publicPath: string): Promise<void> {
		try {
			// Converte o caminho público para o caminho real no filesystem
			const fileName = publicPath.replace('/data/', '');
			const filePath = path.join(this.downloadDir, fileName);
			await fs.unlink(filePath);
			this.logger.log(`Arquivo deletado: ${filePath}`);
		} catch (error) {
			this.logger.warn(`Erro ao deletar arquivo ${publicPath}:`, error);
			// Não lança erro para não interromper operações em cascata
		}
	}
}
