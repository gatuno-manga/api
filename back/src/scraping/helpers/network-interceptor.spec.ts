import { NetworkInterceptor, UrlFilterConfig } from './network-interceptor';

describe('NetworkInterceptor', () => {
	let mockPage: any;

	beforeEach(() => {
		mockPage = {
			on: jest.fn(),
			route: jest.fn(),
		};
	});

	describe('URL Filtering', () => {
		it('should accept URL when no filters configured', () => {
			const interceptor = new NetworkInterceptor(mockPage);
			const result = interceptor['shouldAcceptUrl'](
				'https://example.com/image.jpg',
			);
			expect(result).toBe(true);
		});

		it('should reject URL matching blacklist term', () => {
			const config: UrlFilterConfig = {
				blacklistTerms: ['logo', 'icon', 'ads'],
				whitelistTerms: [],
			};
			const interceptor = new NetworkInterceptor(mockPage, config);

			expect(
				interceptor['shouldAcceptUrl']('https://example.com/logo.png'),
			).toBe(false);
			expect(
				interceptor['shouldAcceptUrl'](
					'https://example.com/icon-small.svg',
				),
			).toBe(false);
			expect(
				interceptor['shouldAcceptUrl'](
					'https://ads.example.com/banner.jpg',
				),
			).toBe(false);
		});

		it('should accept URL not matching blacklist', () => {
			const config: UrlFilterConfig = {
				blacklistTerms: ['logo', 'icon'],
				whitelistTerms: [],
			};
			const interceptor = new NetworkInterceptor(mockPage, config);

			expect(
				interceptor['shouldAcceptUrl'](
					'https://cdn.example.com/chapter1/page1.jpg',
				),
			).toBe(true);
		});

		it('should accept URL matching whitelist', () => {
			const config: UrlFilterConfig = {
				blacklistTerms: [],
				whitelistTerms: ['cdn.example.com', 'uploads/chapters'],
			};
			const interceptor = new NetworkInterceptor(mockPage, config);

			expect(
				interceptor['shouldAcceptUrl'](
					'https://cdn.example.com/image.jpg',
				),
			).toBe(true);
			expect(
				interceptor['shouldAcceptUrl'](
					'https://example.com/uploads/chapters/page1.jpg',
				),
			).toBe(true);
		});

		it('should reject URL not matching whitelist when configured', () => {
			const config: UrlFilterConfig = {
				blacklistTerms: [],
				whitelistTerms: ['cdn.example.com'],
			};
			const interceptor = new NetworkInterceptor(mockPage, config);

			expect(
				interceptor['shouldAcceptUrl']('https://other.com/image.jpg'),
			).toBe(false);
		});

		it('should apply blacklist before whitelist', () => {
			const config: UrlFilterConfig = {
				blacklistTerms: ['logo'],
				whitelistTerms: ['cdn.example.com'],
			};
			const interceptor = new NetworkInterceptor(mockPage, config);

			// Even though it matches whitelist, blacklist should reject it
			expect(
				interceptor['shouldAcceptUrl'](
					'https://cdn.example.com/logo.png',
				),
			).toBe(false);
		});

		it('should be case insensitive', () => {
			const config: UrlFilterConfig = {
				blacklistTerms: ['LOGO', 'Icon'],
				whitelistTerms: [],
			};
			const interceptor = new NetworkInterceptor(mockPage, config);

			expect(
				interceptor['shouldAcceptUrl']('https://example.com/logo.png'),
			).toBe(false);
			expect(
				interceptor['shouldAcceptUrl']('https://example.com/ICON.svg'),
			).toBe(false);
		});
	});

	describe('Cache operations', () => {
		it('should return undefined for non-cached URL', () => {
			const interceptor = new NetworkInterceptor(mockPage);
			expect(
				interceptor.getCachedImage('https://example.com/image.jpg'),
			).toBeUndefined();
		});

		it('should check if image exists in cache', () => {
			const interceptor = new NetworkInterceptor(mockPage);
			expect(interceptor.hasImage('https://example.com/image.jpg')).toBe(
				false,
			);
		});

		it('should return empty stats initially', () => {
			const interceptor = new NetworkInterceptor(mockPage);
			const stats = interceptor.getStats();
			expect(stats.count).toBe(0);
			expect(stats.totalBytes).toBe(0);
		});

		it('should clear cache', () => {
			const interceptor = new NetworkInterceptor(mockPage);
			interceptor.clearCache();
			expect(interceptor.getCachedUrls()).toEqual([]);
		});
	});

	describe('Extension detection', () => {
		it('should return .jpg as default extension', () => {
			const interceptor = new NetworkInterceptor(mockPage);
			expect(interceptor.getExtension('https://example.com/image')).toBe(
				'.jpg',
			);
		});

		it('should detect .png from URL', () => {
			const interceptor = new NetworkInterceptor(mockPage);
			expect(
				interceptor.getExtension('https://example.com/image.png'),
			).toBe('.png');
		});

		it('should detect .webp from URL', () => {
			const interceptor = new NetworkInterceptor(mockPage);
			expect(
				interceptor.getExtension('https://example.com/image.webp'),
			).toBe('.webp');
		});

		it('should detect .gif from URL', () => {
			const interceptor = new NetworkInterceptor(mockPage);
			expect(
				interceptor.getExtension('https://example.com/animation.gif'),
			).toBe('.gif');
		});
	});

	describe('Interception lifecycle', () => {
		it('should start interception', async () => {
			const interceptor = new NetworkInterceptor(mockPage);
			await interceptor.startInterception();
			expect(mockPage.on).toHaveBeenCalledWith(
				'response',
				expect.any(Function),
			);
		});

		it('should not start interception twice', async () => {
			const interceptor = new NetworkInterceptor(mockPage);
			await interceptor.startInterception();
			await interceptor.startInterception();
			expect(mockPage.on).toHaveBeenCalledTimes(1);
		});

		it('should stop interception', () => {
			const interceptor = new NetworkInterceptor(mockPage);
			interceptor.stopInterception();
			expect(interceptor['isIntercepting']).toBe(false);
		});
	});

	describe('Buffer operations', () => {
		it('should return null for non-cached URL when getting buffer', () => {
			const interceptor = new NetworkInterceptor(mockPage);
			expect(
				interceptor.getCachedImageAsBuffer(
					'https://example.com/image.jpg',
				),
			).toBeNull();
		});

		it('should return null for non-cached URL when getting base64', () => {
			const interceptor = new NetworkInterceptor(mockPage);
			expect(
				interceptor.getCachedImageAsBase64(
					'https://example.com/image.jpg',
				),
			).toBeNull();
		});
	});

	describe('Compression', () => {
		it('should initialize without compressor', () => {
			const interceptor = new NetworkInterceptor(mockPage);
			expect(interceptor['compressor']).toBeUndefined();
		});

		it('should initialize with compressor', () => {
			const mockCompressor = {
				compress: jest.fn(),
				getOutputExtension: jest.fn(),
			};
			const interceptor = new NetworkInterceptor(
				mockPage,
				{ blacklistTerms: [], whitelistTerms: [] },
				mockCompressor,
			);
			expect(interceptor['compressor']).toBe(mockCompressor);
		});

		it('should report compressed count in stats', () => {
			const interceptor = new NetworkInterceptor(mockPage);
			const stats = interceptor.getStats();
			expect(stats).toHaveProperty('compressedCount');
			expect(stats.compressedCount).toBe(0);
		});

		it('should check if image is compressed', () => {
			const interceptor = new NetworkInterceptor(mockPage);
			expect(
				interceptor.isCompressed('https://example.com/image.jpg'),
			).toBe(false);
		});

		it('should wait for compressions (no-op when empty)', async () => {
			const interceptor = new NetworkInterceptor(mockPage);
			await expect(
				interceptor.waitForCompressions(),
			).resolves.not.toThrow();
		});
	});
});
