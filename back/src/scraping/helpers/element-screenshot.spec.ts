import { ElementScreenshot } from './element-screenshot';
import { Page, Locator } from 'playwright';

describe('ElementScreenshot', () => {
    let mockPage: jest.Mocked<Page>;
    let mockLocator: jest.Mocked<Locator>;

    beforeEach(() => {
        mockLocator = {
            waitFor: jest.fn().mockResolvedValue(undefined),
            scrollIntoViewIfNeeded: jest.fn().mockResolvedValue(undefined),
            screenshot: jest.fn().mockResolvedValue(Buffer.from('fake-image-data')),
            evaluate: jest.fn().mockResolvedValue(false),
            count: jest.fn().mockResolvedValue(3),
            nth: jest.fn().mockReturnThis(),
        } as unknown as jest.Mocked<Locator>;

        mockPage = {
            locator: jest.fn().mockReturnValue(mockLocator),
            waitForTimeout: jest.fn().mockResolvedValue(undefined),
            evaluate: jest.fn().mockResolvedValue(null),
        } as unknown as jest.Mocked<Page>;
    });

    describe('getExtension', () => {
        it('should always return .png', () => {
            const screenshot = new ElementScreenshot(mockPage);
            expect(screenshot.getExtension()).toBe('.png');
        });

        it('should return .png regardless of options', () => {
            const screenshot = new ElementScreenshot(mockPage, { selector: 'canvas' });
            expect(screenshot.getExtension()).toBe('.png');
        });
    });

    describe('getElementCount', () => {
        it('should return the number of matching elements', async () => {
            mockLocator.count.mockResolvedValue(5);
            const screenshot = new ElementScreenshot(mockPage, { selector: 'canvas' });

            const count = await screenshot.getElementCount();

            expect(count).toBe(5);
            expect(mockPage.locator).toHaveBeenCalledWith('canvas');
        });
    });

    describe('captureElement', () => {
        it('should capture screenshot of element', async () => {
            const screenshot = new ElementScreenshot(mockPage);
            const result = await screenshot.captureElement(mockLocator);

            expect(result).toBeInstanceOf(Buffer);
            expect(mockLocator.waitFor).toHaveBeenCalledWith({
                state: 'visible',
                timeout: 10000,
            });
            expect(mockLocator.scrollIntoViewIfNeeded).toHaveBeenCalled();
            expect(mockLocator.screenshot).toHaveBeenCalled();
        });

        it('should return null on error', async () => {
            mockLocator.waitFor.mockRejectedValue(new Error('Timeout'));
            const screenshot = new ElementScreenshot(mockPage);

            const result = await screenshot.captureElement(mockLocator);

            expect(result).toBeNull();
        });
    });

    describe('captureElementByIndex', () => {
        it('should capture element by index', async () => {
            const screenshot = new ElementScreenshot(mockPage, { selector: 'img' });

            await screenshot.captureElementByIndex(1);

            expect(mockLocator.nth).toHaveBeenCalledWith(1);
        });

        it('should return null if index out of range', async () => {
            mockLocator.count.mockResolvedValue(2);
            const screenshot = new ElementScreenshot(mockPage, { selector: 'img' });

            const result = await screenshot.captureElementByIndex(5);

            expect(result).toBeNull();
        });
    });

    describe('captureAllElements', () => {
        it('should capture all matching elements', async () => {
            mockLocator.count.mockResolvedValue(3);
            const screenshot = new ElementScreenshot(mockPage, { selector: 'canvas' });

            const results = await screenshot.captureAllElements();

            expect(results).toHaveLength(3);
            expect(mockLocator.nth).toHaveBeenCalledTimes(3);
        });
    });

    describe('captureAllAsBase64', () => {
        it('should return base64 strings', async () => {
            mockLocator.count.mockResolvedValue(2);
            const screenshot = new ElementScreenshot(mockPage, { selector: 'canvas' });

            const results = await screenshot.captureAllAsBase64();

            expect(results).toHaveLength(2);
            expect(typeof results[0]).toBe('string');
        });
    });

    describe('captureCanvasAsBase64', () => {
        it('should extract canvas data directly', async () => {
            mockPage.evaluate.mockResolvedValue('base64-data');
            const screenshot = new ElementScreenshot(mockPage);

            const result = await screenshot.captureCanvasAsBase64('canvas#main');

            expect(result).toBe('base64-data');
        });

        it('should fallback to screenshot if canvas extraction fails', async () => {
            mockPage.evaluate.mockResolvedValue(null);
            const screenshot = new ElementScreenshot(mockPage, { selector: 'canvas' });

            const result = await screenshot.captureCanvasAsBase64('canvas#main');

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
        it('should use custom timeout option', async () => {
            const screenshot = new ElementScreenshot(mockPage, {
                selector: 'canvas.page',
                timeout: 5000,
            });

            await screenshot.captureElement(mockLocator);

            expect(mockLocator.waitFor).toHaveBeenCalledWith({
                state: 'visible',
                timeout: 5000,
            });
            expect(mockLocator.screenshot).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'png',
                }),
            );
        });
    });
});
