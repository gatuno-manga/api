import { promises as fs } from 'node:fs';
import { PassThrough, Readable, pipeline } from 'node:stream';
import { promisify } from 'node:util';
import {
	Injectable,
	Logger,
	NotFoundException,
	StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AppConfigService } from 'src/app-config/app-config.service';
import { In, Repository } from 'typeorm';
import { Book } from '../entities/book.entity';
import { Chapter } from '../entities/chapter.entity';
import { DownloadCacheService } from './download-cache.service';
import {
	BookDownloadFormat,
	DownloadBookBodyDto,
} from './dto/download-book-body.dto';
import {
	ChapterDownloadFormat,
	DownloadChapterQueryDto,
} from './dto/download-chapter-query.dto';
import { DownloadStrategy } from './strategies/download.strategy';
import { PdfStrategy } from './strategies/pdf.strategy';
import { PdfsZipStrategy } from './strategies/pdfs-zip.strategy';
import { ZipStrategy } from './strategies/zip.strategy';

const pipelineAsync = promisify(pipeline);

@Injectable()
export class DownloadService {
	private readonly logger = new Logger(DownloadService.name);
	private readonly CACHE_THRESHOLD_BYTES: number;

	constructor(
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
		private readonly cacheService: DownloadCacheService,
		private readonly zipStrategy: ZipStrategy,
		private readonly pdfStrategy: PdfStrategy,
		private readonly pdfsZipStrategy: PdfsZipStrategy,
		private readonly configService: AppConfigService,
	) {
		// Converter MB para bytes
		const thresholdMB = this.configService.downloadCacheThresholdMB;
		this.CACHE_THRESHOLD_BYTES = thresholdMB * 1024 * 1024;
		this.logger.log(`Download cache threshold: ${thresholdMB}MB`);
	}

	/**
	 * Download de um capítulo individual
	 */
	async downloadChapter(
		chapterId: string,
		query: DownloadChapterQueryDto,
	): Promise<{
		file: StreamableFile;
		fileName: string;
		contentType: string;
	}> {
		this.logger.log(`Downloading chapter ${chapterId} as ${query.format}`);

		// Buscar capítulo com páginas e livro
		const chapter = await this.chapterRepository.findOne({
			where: { id: chapterId },
			relations: ['pages', 'book'],
		});

		if (!chapter) {
			throw new NotFoundException(
				`Chapter with id ${chapterId} not found`,
			);
		}

		if (!chapter.pages || chapter.pages.length === 0) {
			throw new NotFoundException(
				`Chapter ${chapterId} has no pages available`,
			);
		}

		// Selecionar estratégia baseada no formato
		const strategy =
			query.format === ChapterDownloadFormat.PDF
				? this.pdfStrategy
				: this.zipStrategy;

		const fileName = this.generateFileName(
			[chapter],
			strategy.getExtension(),
		);

		// Verificar cache usando stream
		const cachedStream = await this.cacheService.getStream(
			[chapterId],
			query.format,
			strategy.getExtension(),
		);

		if (cachedStream) {
			this.logger.log(`Returning cached file for chapter ${chapterId}`);
			return {
				file: new StreamableFile(cachedStream, {
					type: strategy.getContentType(),
					disposition: `attachment; filename="${fileName}"`,
				}),
				fileName,
				contentType: strategy.getContentType(),
			};
		}

		// Estimar tamanho
		const estimatedSize = this.estimateSize([chapter]);
		this.logger.log(
			`Estimated size: ${(estimatedSize / 1024 / 1024).toFixed(2)}MB`,
		);

		// Decidir estratégia: buffer (pequeno) ou streaming (grande)
		if (estimatedSize < this.CACHE_THRESHOLD_BYTES) {
			return this.downloadWithBufferCache(
				[chapter],
				strategy,
				[chapterId],
				query.format,
				fileName,
			);
		}
		return this.downloadWithStreamCache(
			[chapter],
			strategy,
			[chapterId],
			query.format,
			fileName,
		);
	}

	/**
	 * Download de um livro com capítulos selecionados
	 */
	async downloadBook(
		bookId: string,
		dto: DownloadBookBodyDto,
	): Promise<{
		file: StreamableFile;
		fileName: string;
		contentType: string;
	}> {
		const requestedIds = dto.chapterIds || [];
		const downloadAll = requestedIds.length === 0;
		this.logger.log(
			`Downloading book ${bookId} with ${downloadAll ? 'all' : requestedIds.length} chapters as ${dto.format}`,
		);

		// Buscar livro
		const book = await this.bookRepository.findOne({
			where: { id: bookId },
		});

		if (!book) {
			throw new NotFoundException(`Book with id ${bookId} not found`);
		}

		// Buscar capítulos (todos ou selecionados)
		let chapters: Chapter[];
		if (downloadAll) {
			// Buscar todos os capítulos do livro
			chapters = await this.chapterRepository.find({
				where: { book: { id: bookId } },
				relations: ['pages'],
				order: { index: 'ASC' },
			});
		} else {
			// Buscar capítulos selecionados
			chapters = await this.chapterRepository.find({
				where: {
					id: In(requestedIds),
					book: { id: bookId },
				},
				relations: ['pages'],
				order: { index: 'ASC' },
			});

			if (chapters.length !== requestedIds.length) {
				this.logger.warn(
					`Requested ${requestedIds.length} chapters, but only ${chapters.length} were found`,
				);
			}
		}

		// Verificar se há páginas
		const totalPages = chapters.reduce(
			(sum, ch) => sum + (ch.pages?.length || 0),
			0,
		);
		if (totalPages === 0) {
			throw new NotFoundException(
				'No pages available for the selected chapters',
			);
		}

		// Determinar estratégia baseada no formato
		let strategy: ZipStrategy | PdfsZipStrategy;
		let formatKey: string;

		if (dto.format === BookDownloadFormat.PDFS_ZIP) {
			// ZIP de PDFs: gerar PDF para cada capítulo e empacotar
			formatKey = 'pdfs_zip';
			strategy = this.pdfsZipStrategy;
			this.logger.log('Using PDFs ZIP strategy');
		} else {
			// ZIP de imagens
			formatKey = 'images_zip';
			strategy = this.zipStrategy;
		}

		// Obter IDs dos capítulos para cache
		const chapterIdsForCache = chapters.map((ch) => ch.id);

		const fileName = this.generateFileName(
			chapters,
			strategy.getExtension(),
			book.title,
		);

		// Verificar cache usando stream
		const cachedStream = await this.cacheService.getStream(
			chapterIdsForCache,
			formatKey,
			strategy.getExtension(),
		);

		if (cachedStream) {
			this.logger.log(`Returning cached file for book ${bookId}`);
			return {
				file: new StreamableFile(cachedStream, {
					type: strategy.getContentType(),
					disposition: `attachment; filename="${fileName}"`,
				}),
				fileName,
				contentType: strategy.getContentType(),
			};
		}

		// Estimar tamanho
		const estimatedSize = this.estimateSize(chapters);
		this.logger.log(
			`Estimated size: ${(estimatedSize / 1024 / 1024).toFixed(2)}MB for ${chapters.length} chapters`,
		);

		// Decidir estratégia: buffer (pequeno) ou streaming (grande)
		if (estimatedSize < this.CACHE_THRESHOLD_BYTES) {
			return this.downloadWithBufferCache(
				chapters,
				strategy,
				chapterIdsForCache,
				formatKey,
				fileName,
			);
		}
		return this.downloadWithStreamCache(
			chapters,
			strategy,
			chapterIdsForCache,
			formatKey,
			fileName,
		);
	}

	/**
	 * Gera um nome de arquivo descritivo
	 */
	private generateFileName(
		chapters: Chapter[],
		extension: string,
		bookTitle?: string,
	): string {
		if (chapters.length === 1) {
			const chapter = chapters[0];
			const sanitized = this.sanitizeFileName(
				`Cap_${chapter.index}_${chapter.title}`,
			);
			return `${sanitized}.${extension}`;
		}

		const sanitized = this.sanitizeFileName(bookTitle || 'Full_Book');
		return `${sanitized}_${chapters.length}_cap.${extension}`;
	}

	/**
	 * Remove caracteres inválidos de nomes de arquivo
	 */
	private sanitizeFileName(name: string): string {
		// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional sanitization of control characters
		return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
	}

	/**
	 * Converte um stream em buffer
	 */
	private async streamToBuffer(stream: Readable): Promise<Buffer> {
		const chunks: Uint8Array[] = [];
		for await (const chunk of stream) {
			chunks.push(Buffer.from(chunk));
		}
		return Buffer.concat(chunks);
	}

	/**
	 * Estima o tamanho do arquivo baseado nas páginas
	 */
	private estimateSize(chapters: Chapter[]): number {
		const totalPages = chapters.reduce(
			(sum, ch) => sum + (ch.pages?.length || 0),
			0,
		);
		const avgPageSize = 2 * 1024 * 1024; // 2MB por página (estimativa conservadora)
		return totalPages * avgPageSize;
	}

	/**
	 * Download com estratégia de buffer (arquivos pequenos)
	 */
	private async downloadWithBufferCache(
		chapters: Chapter[],
		strategy: DownloadStrategy,
		cacheKey: string[],
		formatKey: string,
		fileName: string,
	): Promise<{
		file: StreamableFile;
		fileName: string;
		contentType: string;
	}> {
		this.logger.log('Using buffer cache strategy');

		// Gerar arquivo
		const bookTitle = chapters[0]?.book?.title || 'Livro';
		const file = await strategy.generate(chapters, bookTitle);

		// Converter para buffer
		const buffer = await this.streamToBuffer(file.getStream());

		// Cachear (fire-and-forget)
		this.cacheService
			.set(cacheKey, formatKey, strategy.getExtension(), buffer)
			.catch((err) =>
				this.logger.error(`Cache save failed: ${err.message}`),
			);

		// Retornar buffer
		const stream = Readable.from(buffer);
		return {
			file: new StreamableFile(stream, {
				type: strategy.getContentType(),
				disposition: `attachment; filename="${fileName}"`,
			}),
			fileName,
			contentType: strategy.getContentType(),
		};
	}

	/**
	 * Download com estratégia de streaming (arquivos grandes)
	 */
	private async downloadWithStreamCache(
		chapters: Chapter[],
		strategy: DownloadStrategy,
		cacheKey: string[],
		formatKey: string,
		fileName: string,
	): Promise<{
		file: StreamableFile;
		fileName: string;
		contentType: string;
	}> {
		this.logger.log('Using streaming cache strategy');

		// Gerar stream do arquivo
		const bookTitle = chapters[0]?.book?.title || 'Livro';
		const file = await strategy.generate(chapters, bookTitle);
		const sourceStream = file.getStream();

		// Criar streams duplicados: um para cliente, outro para cache
		const toClient = new PassThrough();
		const toCache = new PassThrough();

		// Configurar error handling
		sourceStream.on('error', (err) => {
			this.logger.error(`Stream generation failed: ${err.message}`);
			toClient.destroy(err);
			toCache.destroy(err);
		});

		// Duplicar stream
		sourceStream.pipe(toClient);
		sourceStream.pipe(toCache);

		// Salvar no cache em background
		this.saveToCacheAsync(
			cacheKey,
			formatKey,
			strategy.getExtension(),
			toCache,
		).catch((err) =>
			this.logger.error(`Async cache save failed: ${err.message}`),
		);

		// Retornar stream para cliente
		return {
			file: new StreamableFile(toClient, {
				type: strategy.getContentType(),
				disposition: `attachment; filename="${fileName}"`,
			}),
			fileName,
			contentType: strategy.getContentType(),
		};
	}

	/**
	 * Salva stream no cache de forma assíncrona
	 */
	private async saveToCacheAsync(
		cacheKey: string[],
		format: string,
		extension: string,
		stream: Readable,
	): Promise<void> {
		const key = this.cacheService.generateCacheKey(cacheKey, format);
		const filePath = this.cacheService.getCacheFilePath(key, extension);
		const tempPath = `${filePath}.tmp`;

		try {
			// Criar write stream para arquivo temporário
			const fileStream = (await import('node:fs')).createWriteStream(
				tempPath,
			);

			// Pipeline: stream -> arquivo temporário
			await pipelineAsync(stream, fileStream);

			// Renomear para arquivo final (atômico)
			await fs.rename(tempPath, filePath);

			// Registrar no Redis
			const redisKey = `${this.cacheService.REDIS_PREFIX}${key}`;
			const ttl = this.cacheService.TTL_SECONDS;
			await this.cacheService.redis.set(redisKey, filePath, 'EX', ttl);

			this.logger.log(`Async cache saved: ${key}`);
		} catch (error) {
			// Limpar arquivo temporário se falhou
			await fs.unlink(tempPath).catch(() => {});
			throw error;
		}
	}
}
