import { ElementScreenshot } from './element-screenshot';
import { Page, Locator } from 'playwright';

describe('ElementScreenshot', () => {
	let mockPage: jest.Mocked<Page>;
	let mockLocator: jest.Mocked<Locator>;

	beforeEach(() => {
		mockLocator = {
			waitFor: jest.fn().mockResolvedValue(undefined),
			scrollIntoViewIfNeeded: jest.fn().mockResolvedValue(undefined),
			screenshot: jest
				.fn()
				.mockResolvedValue(Buffer.from('fake-image-data')),
			evaluate: jest.fn().mockResolvedValue(undefined),
			boundingBox: jest
				.fn()
				.mockResolvedValue({ width: 100, height: 100, x: 0, y: 0 }),
			count: jest.fn().mockResolvedValue(3),
			nth: jest.fn().mockReturnThis(),
		} as unknown as jest.Mocked<Locator>;

		mockPage = {
			locator: jest.fn().mockReturnValue(mockLocator),
			waitForTimeout: jest.fn().mockResolvedValue(undefined),
			evaluate: jest.fn().mockResolvedValue(1000),
			click: jest.fn().mockResolvedValue(undefined),
			mouse: {
				wheel: jest.fn().mockResolvedValue(undefined),
			},
			keyboard: {
				press: jest.fn().mockResolvedValue(undefined),
			},
		} as unknown as jest.Mocked<Page>;
	});

	describe('getExtension', () => {
		it('should return .png by default (PNG format)', () => {
			const screenshot = new ElementScreenshot(mockPage);
			expect(screenshot.getExtension()).toBe('.png');
		});

		it('should return .jpg when format is jpeg', () => {
			const screenshot = new ElementScreenshot(mockPage, {
				format: 'jpeg',
			});
			expect(screenshot.getExtension()).toBe('.jpg');
		});
	});

	describe('getElementCount', () => {
		it('should return the number of matching elements', async () => {
			mockLocator.count.mockResolvedValue(5);
			const screenshot = new ElementScreenshot(mockPage, {
				selector: 'canvas',
			});

			const count = await screenshot.getElementCount();

			expect(count).toBe(5);
			expect(mockPage.locator).toHaveBeenCalledWith('canvas');
		});
	});

	describe('captureElement', () => {
		it('should capture screenshot of element with fast scroll', async () => {
			mockLocator.evaluate.mockResolvedValue(undefined);
			const screenshot = new ElementScreenshot(mockPage);
			const result = await screenshot.captureElement(mockLocator);

			expect(result).toBeInstanceOf(Buffer);
			// Verifica que fez scroll via evaluate
			expect(mockLocator.evaluate).toHaveBeenCalled();
			// Verifica boundingBox para filtrar elementos pequenos
			expect(mockLocator.boundingBox).toHaveBeenCalled();
			// Não deve mais chamar waitFor (otimização de velocidade)
			expect(mockLocator.waitFor).not.toHaveBeenCalled();
			expect(mockLocator.screenshot).toHaveBeenCalled();
		});

		it('should skip small elements (< minSize)', async () => {
			mockLocator.boundingBox.mockResolvedValue({
				width: 30,
				height: 30,
				x: 0,
				y: 0,
			});
			const screenshot = new ElementScreenshot(mockPage);
			const result = await screenshot.captureElement(mockLocator);

			expect(result).toBeNull();
			expect(mockLocator.screenshot).not.toHaveBeenCalled();
		});

		it('should return null on error when screenshot fails', async () => {
			mockLocator.evaluate.mockRejectedValue(
				new Error('Element detached'),
			);
			mockPage.evaluate.mockRejectedValue(new Error('Page error'));
			mockLocator.screenshot.mockRejectedValue(
				new Error('Screenshot failed'),
			);
			const screenshot = new ElementScreenshot(mockPage);

			const result = await screenshot.captureElement(mockLocator);

			expect(result).toBeNull();
		});
	});

	describe('captureElementByIndex', () => {
		it('should capture element by index', async () => {
			const screenshot = new ElementScreenshot(mockPage, {
				selector: 'img',
			});

			await screenshot.captureElementByIndex(1);

			expect(mockLocator.nth).toHaveBeenCalledWith(1);
		});

		it('should return null if index out of range', async () => {
			mockLocator.count.mockResolvedValue(2);
			const screenshot = new ElementScreenshot(mockPage, {
				selector: 'img',
			});

			const result = await screenshot.captureElementByIndex(5);

			expect(result).toBeNull();
		});
	});

	describe('captureAllElements', () => {
		it('should capture all matching elements with aggressive scroll', async () => {
			mockLocator.count.mockResolvedValue(3);
			const screenshot = new ElementScreenshot(mockPage, {
				selector: 'canvas',
			});

			const results = await screenshot.captureAllElements();

			// Deve ter feito scroll agressivo
			expect(mockPage.evaluate).toHaveBeenCalled();
			expect(results).toHaveLength(3);
			expect(mockLocator.nth).toHaveBeenCalledTimes(3);
		});
	});

	describe('captureAllAsBase64', () => {
		it('should return base64 strings', async () => {
			mockLocator.count.mockResolvedValue(2);
			mockLocator.boundingBox.mockResolvedValue({
				width: 100,
				height: 100,
				x: 0,
				y: 0,
			});
			const screenshot = new ElementScreenshot(mockPage, {
				selector: 'canvas',
			});

			const results = await screenshot.captureAllAsBase64();

			expect(results).toHaveLength(2);
			expect(typeof results[0]).toBe('string');
		});
	});

	describe('captureCanvasAsBase64', () => {
		it('should extract canvas data directly', async () => {
			mockPage.evaluate.mockResolvedValue('base64-data');
			const screenshot = new ElementScreenshot(mockPage);

			const result =
				await screenshot.captureCanvasAsBase64('canvas#main');

			expect(result).toBe('base64-data');
		});

		it('should fallback to screenshot if canvas extraction fails', async () => {
			mockPage.evaluate.mockResolvedValueOnce(null); // First call returns null
			mockLocator.boundingBox.mockResolvedValue({
				width: 100,
				height: 100,
				x: 0,
				y: 0,
			});
			const screenshot = new ElementScreenshot(mockPage, {
				selector: 'canvas',
			});

			const result =
				await screenshot.captureCanvasAsBase64('canvas#main');

			expect(result).not.toBeNull();
		});
	});

	describe('isCanvas', () => {
		it('should return true for canvas elements', async () => {
			mockLocator.evaluate.mockResolvedValue(true);
			const screenshot = new ElementScreenshot(mockPage);

			const result = await screenshot.isCanvas(mockLocator);

			expect(result).toBe(true);
		});

		it('should return false for non-canvas elements', async () => {
			mockLocator.evaluate.mockResolvedValue(false);
			const screenshot = new ElementScreenshot(mockPage);

			const result = await screenshot.isCanvas(mockLocator);

			expect(result).toBe(false);
		});
	});

	describe('options', () => {
		it('should use custom options and PNG format by default', async () => {
			const screenshot = new ElementScreenshot(mockPage, {
				selector: 'canvas.page',
				timeout: 5000,
			});

			await screenshot.captureElement(mockLocator);

			// Não deve chamar waitFor (removido na otimização)
			expect(mockLocator.waitFor).not.toHaveBeenCalled();
			// Deve usar PNG por padrão
			expect(mockLocator.screenshot).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'png',
				}),
			);
		});

		it('should use JPEG when specified', async () => {
			const screenshot = new ElementScreenshot(mockPage, {
				selector: 'canvas.page',
				format: 'jpeg',
				quality: 90,
			});

			await screenshot.captureElement(mockLocator);

			expect(mockLocator.screenshot).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'jpeg',
					quality: 90,
				}),
			);
		});
	});
});
