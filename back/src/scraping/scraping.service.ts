import { Injectable, Logger } from '@nestjs/common';
import {
	Builder,
	Browser,
	Capabilities,
	WebDriver,
	By,
	until,
} from 'selenium-webdriver';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { AppConfigService } from 'src/app-config/app-config.service';

@Injectable()
export class ScrapingService {
	private readonly logger = new Logger(ScrapingService.name);
	private downloadDir = path.resolve('/usr/src/app/data');

	constructor(private readonly appConfigService: AppConfigService) {}

	async createInstance() {
		const chromeCapabilities = Capabilities.chrome();
		chromeCapabilities.set('goog:chromeOptions', {
			prefs: {
				'download.default_directory': this.downloadDir,
				'download.prompt_for_download': false,
				directory_upgrade: true,
				'profile.default_content_settings.popups': 0,
				'profile.default_content_setting_values.notifications': 2,
				'profile.default_content_setting_values.geolocation': 2,
				'profile.default_content_setting_values.media_stream_camera': 2,
				'profile.default_content_setting_values.media_stream_mic': 2,
				// 'profile.default_content_setting_values.images': 2, // Block images
				// 'profile.default_content_setting_values.javascript': 2, // Block JavaScript
				'profile.default_content_setting_values.plugins': 2, // Block plugins
			},
			args: [
				'--disable-web-security',
				'--disable-site-isolation-trials',
				'--disable-features=IsolateOrigins,site-per-process',
				'--disable-blink-features=AutomationControlled',
				'--disable-infobars',
				'--disable-dev-shm-usage',
				'--no-sandbox',
				'--window-size=1920,1080',
				'--disable-extensions',
				'--disable-popup-blocking',
			],
		});

		return await new Builder()
			.usingServer(this.appConfigService.seleniumUrl)
			.forBrowser(Browser.CHROME)
			.withCapabilities(chromeCapabilities)
			.build();
	}

	private async fetchImageAsBase64(
		driver: WebDriver,
		imageUrl: string,
	): Promise<string | null> {
		this.logger.log(`Baixando ${imageUrl} como Base64 via navegador...`);
		try {
			const base64String = await driver.executeAsyncScript(
				`
                const url = arguments[0];
                const callback = arguments[1]; // Callback para retornar o resultado ao WebDriver

                fetch(url)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Network response was not ok.');
                        }
                        return response.blob();
                    })
                    .then(blob => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            // Retorna apenas a parte de dados da string Base64
                            callback(reader.result.split(',')[1]);
                        };
                        reader.onerror = () => {
                            callback(null); // Sinaliza erro
                        };
                        reader.readAsDataURL(blob);
                    })
                    .catch(error => {
                        console.error('Erro no script do navegador:', error);
                        callback(null); // Sinaliza erro
                    });
            `,
				imageUrl,
			);

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
		timeout = 20000,
	): Promise<void> {
		const pollInterval = 500;
		const maxTries = Math.ceil(timeout / pollInterval);
		let tries = 0;

		while (tries < maxTries) {
			const allLoaded = await driver.executeScript<boolean>(`
				return Array.from(document.images).every(img => img.complete && img.naturalWidth > 0);
			`);
			if (allLoaded) return;
			await driver.sleep(pollInterval);
			tries++;
		}
		throw new Error('Timeout esperando todas as imagens carregarem');
	}

	private async getImageUrls(driver: WebDriver): Promise<string[]> {
		const imageElements = await driver.findElements(By.css('img'));
		return (
			await Promise.all(
				imageElements.map((img) => img.getAttribute('src')),
			)
		).filter(
			(src) =>
				src &&
				(src.startsWith('http://') || src.startsWith('https://')),
		);
	}

	private getPublicPath(fileName: string): string {
		return `http://localhost:3000/data/${fileName}`;
	}

	async scrapePages(url: string): Promise<string[]> {
		const driver = await this.createInstance();
		try {
			await driver.get(url);
			await driver.wait(
				() => driver.getTitle().then((title) => title.length > 0),
				10000,
			);
			await driver.executeScript(
				'window.scrollTo(0, document.body.scrollHeight);',
			);
			await driver.sleep(500);
			await this.waitForAllImagesLoaded(driver);

			const imageUrls = await this.getImageUrls(driver);

			this.logger.log(
				`Encontradas ${imageUrls.length} URLs de imagem válidas. Iniciando downloads.`,
			);

			const successfulPaths = await Promise.all(
				imageUrls.map(async (imageUrl) => {
					const base64Data = await this.fetchImageAsBase64(
						driver,
						imageUrl,
					);
					if (!base64Data) return null;

					const extension =
						path.extname(new URL(imageUrl).pathname) || '.jpg';
					const fileName = `${uuidv4()}${extension}`;
					const filePath = path.join(this.downloadDir, fileName);
					await fs.writeFile(filePath, base64Data, 'base64');
					this.logger.log(`Imagem salva em: ${filePath}`);
					return this.getPublicPath(fileName);
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
			await driver.quit();
		}
	}
}
