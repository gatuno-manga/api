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

@Injectable()
export class ScrapingService implements OnApplicationShutdown {
	private readonly logger = new Logger(ScrapingService.name);
	private downloadDir = path.resolve('/usr/src/app/data');
	private drivers: WebDriver[] = [];

	constructor(
		private readonly appConfigService: AppConfigService,
		private readonly filesService: FilesService,
		private readonly webSiteService: WebsiteService,
	) {}

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
		this.drivers.push(driver);
		return driver;
	}

	private async removeDriver(driver: WebDriver) {
		const idx = this.drivers.indexOf(driver);
		if (idx > -1)
			this.drivers.splice(idx, 1);
		await driver.quit()
	}

	private async fetchImageAsBase64(
		driver: WebDriver,
		imageUrl: string,
	): Promise<string | null> {
		try {
			const script = fs.readFileSync(path.resolve(__dirname, 'scripts/fetchImageAsBase64.js'), 'utf8');
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
		const script = fs.readFileSync(path.resolve(__dirname, 'scripts/waitForAllImagesLoaded.js'), 'utf8');
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
		const script = fs.readFileSync(path.resolve(__dirname, 'scripts/getImageUrls.js'), 'utf8');
		return await driver.executeScript<string[]>(script, selector);
	}

	async failedImageUrls(
		driver: WebDriver,
		selector = 'img',
	): Promise<string[]> {
		const script = fs.readFileSync(path.resolve(__dirname, 'scripts/failedImageUrls.js'), 'utf8');
		return await driver.executeScript<string[]>(script, selector);
	}

	async scrapePages(url: string): Promise<string[]> {
		const driver = await this.createInstance();
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
		try {
			await driver.get(url);
			await driver.wait(
				() => driver.getTitle().then((title) => title.length > 0),
				10000,
			);
			await driver.executeScript(preScript);
			await driver.sleep(3000);

			const scrollScript = fs.readFileSync(path.resolve(__dirname, 'scripts/scrollAndWait.js'), 'utf8');
			await driver.executeAsyncScript(scrollScript);

			await driver.sleep(500);
			await this.waitForAllImagesLoaded(driver, selector);

			const failedUrls = await this.failedImageUrls(driver, selector);
			const imageUrls = await this.getImageUrls(driver, selector);

			this.logger.log(
				`Encontradas ${imageUrls.length} URLs de imagem válidas. Iniciando downloads.`,
			);

			const successfulPaths = await Promise.all(
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
		this.drivers.forEach((driver) => {
			this.removeDriver(driver);
		});
	}
}
