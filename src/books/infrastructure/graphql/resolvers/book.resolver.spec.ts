import { Test, TestingModule } from '@nestjs/testing';
import { BookResolver } from './book.resolver';
import { CoverResolver, PageResolver } from './media.resolver';
import { BooksService } from '@books/application/services/books.service';
import { ChapterService } from '@books/application/services/chapter.service';
import { ChapterCommentsService } from '@books/application/services/chapter-comments.service';
import { AuthorsService } from '@books/application/services/authors.service';
import { TagsService } from '@books/application/services/tags.service';
import { BookDataLoaderService } from '@books/application/services/book-dataloader.service';
import { MediaUrlService } from 'src/common/services/media-url.service';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CoverModel } from '../models/book.model';
import { PageModel } from '../models/page.model';

describe('Media Resolvers', () => {
	let coverResolver: CoverResolver;
	let pageResolver: PageResolver;
	let mediaUrlService: MediaUrlService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CoverResolver,
				PageResolver,
				{
					provide: MediaUrlService,
					useValue: {
						resolveUrl: jest.fn((path) => `http://s3.com/${path}`),
					},
				},
			],
		}).compile();

		coverResolver = module.get<CoverResolver>(CoverResolver);
		pageResolver = module.get<PageResolver>(PageResolver);
		mediaUrlService = module.get<MediaUrlService>(MediaUrlService);
	});

	it('CoverResolver should resolve cover URLs', () => {
		const mockCover = { url: 'path/to/cover.jpg' } as CoverModel;
		const result = coverResolver.resolveUrl(mockCover);

		expect(result).toBe('http://s3.com/path/to/cover.jpg');
		expect(mediaUrlService.resolveUrl).toHaveBeenCalledWith(
			'path/to/cover.jpg',
			StorageBucket.BOOKS,
		);
	});

	it('PageResolver should resolve page paths', () => {
		const mockPage = { path: 'path/to/page.jpg' } as PageModel;
		const result = pageResolver.resolvePath(mockPage);

		expect(result).toBe('http://s3.com/path/to/page.jpg');
		expect(mediaUrlService.resolveUrl).toHaveBeenCalledWith(
			'path/to/page.jpg',
			StorageBucket.BOOKS,
		);
	});
});

describe('BookResolver', () => {
	let resolver: BookResolver;
	let dataLoaderService: BookDataLoaderService;
	let mediaUrlService: MediaUrlService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BookResolver,
				{
					provide: BooksService,
					useValue: {},
				},
				{
					provide: ChapterService,
					useValue: {},
				},
				{
					provide: ChapterCommentsService,
					useValue: {},
				},
				{
					provide: AuthorsService,
					useValue: {},
				},
				{
					provide: TagsService,
					useValue: {},
				},
				{
					provide: BookDataLoaderService,
					useValue: {
						coversLoader: {
							load: jest.fn(),
						},
					},
				},
				{
					provide: MediaUrlService,
					useValue: {
						resolveUrl: jest.fn((path) => `http://s3.com/${path}`),
					},
				},
				{
					provide: CACHE_MANAGER,
					useValue: {
						get: jest.fn(),
						set: jest.fn(),
					},
				},
			],
		}).compile();

		resolver = module.get<BookResolver>(BookResolver);
		dataLoaderService = module.get<BookDataLoaderService>(
			BookDataLoaderService,
		);
		mediaUrlService = module.get<MediaUrlService>(MediaUrlService);
	});

	it('should return cover data in getBookCovers', async () => {
		const mockCovers = [
			{
				id: 'cover-1',
				url: 'path/to/cover1.jpg',
				selected: true,
				metadata: {},
			},
		];

		(dataLoaderService.coversLoader.load as jest.Mock).mockResolvedValue(
			mockCovers,
		);

		const result = await resolver.getBookCovers({ id: '1' } as any);

		expect(result[0].url).toBe('path/to/cover1.jpg');
	});

	it('should resolve the main cover URL in getBookCover', async () => {
		const result = await resolver.getBookCover({
			cover: 'path/to/main.jpg',
		} as any);

		expect(result).toBe('http://s3.com/path/to/main.jpg');
		expect(mediaUrlService.resolveUrl).toHaveBeenCalledWith(
			'path/to/main.jpg',
			StorageBucket.BOOKS,
		);
	});
});
