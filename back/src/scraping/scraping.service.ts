import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import {
	Builder,
	Browser,
	Capabilities,
	WebDriver,
} from 'selenium-webdriver';
import * as path from 'path';
import * as fs from 'fs';
import { AppConfigService } from 'src/app-config/app-config.service';
import { FilesService } from 'src/files/files.service';
import { WebsiteService } from './website.service';
import chromeOptionsConfig from './config/chromeOptionsConfig';

class ScrapingUtils {
	static readScript(scriptPath: string): string {
		return fs.readFileSync(path.resolve(__dirname, scriptPath), 'utf8');
	}
}
@Injectable()
export class ScrapingService implements OnApplicationShutdown {
	private readonly logger = new Logger(ScrapingService.name);
	private downloadDir = path.resolve('/usr/src/app/data');
	private drivers: Set<WebDriver> = new Set();

	constructor(
		private readonly appConfigService: AppConfigService,
		private readonly filesService: FilesService,
		private readonly webSiteService: WebsiteService,
	) {}

	// Funções utilitárias e de baixo nível primeiro
	private async removeDriver(driver: WebDriver) {
		if (this.drivers.has(driver)) {
			this.drivers.delete(driver);
		}
		await driver.quit();
	}

	private async fetchImageAsBase64(
		driver: WebDriver,
		imageUrl: string,
	): Promise<string | null> {
		try {
			const script = ScrapingUtils.readScript('scripts/fetchImageAsBase64.js');
			const base64String = await driver.executeAsyncScript(script, imageUrl);
			return base64String as string | null;
		} catch (error) {
			this.logger.error(
				`Falha ao executar script de download para ${imageUrl}`,
				error,
			);
			return null;
		}
	}

	private async waitForAllImagesLoaded(
		driver: WebDriver,
		selector = 'img',
		timeout = 60000,
	): Promise<void> {
		const pollInterval = 500;
		const maxTries = Math.ceil(timeout / pollInterval);
		let tries = 0;
		const script = ScrapingUtils.readScript('scripts/waitForAllImagesLoaded.js');
		while (tries < maxTries) {
			const allLoaded = await driver.executeScript<boolean>(script, selector);
			if (allLoaded) return;
			await driver.sleep(pollInterval);
			tries++;
		}
		throw new Error(
			'Timeout esperando todas as imagens carregarem (inclusive as que falharam)',
		);
	}

	private async getImageUrls(
		driver: WebDriver,
		selector = 'img',
	): Promise<string[]> {
		const script = ScrapingUtils.readScript('scripts/getImageUrls.js');
		return await driver.executeScript<string[]>(script, selector);
	}

	async failedImageUrls(
		driver: WebDriver,
		selector = 'img',
	): Promise<string[]> {
		const script = ScrapingUtils.readScript('scripts/failedImageUrls.js');
		return await driver.executeScript<string[]>(script, selector);
	}

	private async getWebsiteConfig(url: string): Promise<{ selector: string; preScript: string; ignoreFiles: string[] }> {
		let selector = 'img';
		let preScript = ``;
		let ignoreFiles: string[] = [];
		const domain = new URL(url).hostname;
		const website = await this.webSiteService.getByUrl(domain);
		if (website) {
			selector = website.selector || selector;
			preScript = website.preScript || preScript;
			ignoreFiles = website.ignoreFiles || [];
		}
		return { selector, preScript, ignoreFiles };
	}

	private async waitForPageTitle(driver: WebDriver): Promise<void> {
		await driver.wait(
			() => driver.getTitle().then((title) => title.length > 0),
			10000,
		);
	}

	private async scrollAndWait(
		driver: WebDriver,
		selector: string
	): Promise<{ processedImageCount: number; failedImageCount: number; failedImages: string[]; }> {
		const scrollScript = ScrapingUtils.readScript('scripts/scrollAndWait.js');
		const result = await driver.executeAsyncScript(scrollScript, selector);
		const { processedImageCount, failedImageCount, failedImages } = result as {
			processedImageCount: number;
			failedImageCount: number;
			failedImages: string[];
		};
		return { processedImageCount, failedImageCount, failedImages };
	}

	private async downloadImages(
		driver: WebDriver,
		imageUrls: string[],
		failedUrls: string[],
		ignoreFiles: string[],
	): Promise<(string | null)[]> {
		return Promise.all(
			imageUrls.map(async (imageUrl) => {
				if (failedUrls.includes(imageUrl)) {
					this.logger.warn(
						`Imagem falhou ao carregar: ${imageUrl}`,
					);
					return 'null';
				}
				if (ignoreFiles && ignoreFiles.includes(imageUrl)) {
					this.logger.warn(
						`Imagem ignorada por configuração: ${imageUrl}`,
					);
					return null;
				}
				const base64Data = await this.fetchImageAsBase64(
					driver,
					imageUrl,
				);
				if (!base64Data) return 'null';

				const extension =
					path.extname(new URL(imageUrl).pathname) || '.jpg';
				return this.filesService.saveBase64File(
					base64Data,
					extension,
				);
			}),
		);
	}

	async createInstance() {
		const chromeCapabilities = Capabilities.chrome();
		const chromeOptions = {
			...chromeOptionsConfig,
			prefs: {
				...chromeOptionsConfig.prefs,
				'download.default_directory': this.downloadDir,
			},
		};
		chromeCapabilities.set('goog:chromeOptions', chromeOptions);

		const driver = await new Builder()
			.usingServer(this.appConfigService.seleniumUrl)
			.forBrowser(Browser.CHROME)
			.withCapabilities(chromeCapabilities)
			.build();
		await driver.manage().setTimeouts({
			script: 1_200_000,
			pageLoad: 1_200_000
		});
		this.drivers.add(driver);
		return driver;
	}

	async scrapePages(url: string, pages = 0): Promise<string[] | void> {
		const driver = await this.createInstance();
		try {
			const { selector, preScript, ignoreFiles } = await this.getWebsiteConfig(url);

			await driver.get(url);
			await this.waitForPageTitle(driver);

			if (preScript) {
				await driver.executeScript(preScript);
				await driver.sleep(3000);
			}

			await this.scrollAndWait(driver, selector);
			const failedUrls = await this.failedImageUrls(driver, selector);
			const imageUrls = await this.getImageUrls(driver, selector);

			if (imageUrls.length <= pages) {
				return [];
			}

			this.logger.log(
				`Encontradas ${imageUrls.length} URLs de imagem válidas. Iniciando downloads.`,
			);

			const successfulPaths = await this.downloadImages(
				driver,
				imageUrls,
				failedUrls,
				ignoreFiles,
			);

			return successfulPaths.filter(Boolean) as string[];
		} catch (error) {
			this.logger.error(
				'Ocorreu um erro durante o processo de scraping.',
				error,
			);
			throw error;
		} finally {
			await this.removeDriver(driver);
		}
	}

	async scrapeSingleImage(url: string, imageUrl: string): Promise<string> {
		const driver = await this.createInstance();
		try {
			await driver.get(url);

			const base64Data = await this.fetchImageAsBase64(driver, imageUrl);
			if (!base64Data) {
				throw new Error(`Falha ao baixar a imagem: ${imageUrl}`);
			}

			const extension =
				path.extname(new URL(imageUrl).pathname) || '.jpg';
			return this.filesService.saveBase64File(base64Data, extension);
		} catch (error) {
			this.logger.error(
				'Ocorreu um erro durante o processo de scraping.',
				error,
			);
			throw error;
		} finally {
			await this.removeDriver(driver);
		}
	}

	async onApplicationShutdown(signal: string) {
		// Garante que todos os drivers sejam fechados
		for (const driver of this.drivers) {
			await this.removeDriver(driver);
		}
	}
}
