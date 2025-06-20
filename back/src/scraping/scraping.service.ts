import { Injectable, Logger } from '@nestjs/common';
import { Builder, Browser } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/chrome';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ScrapingService {
	private readonly logger = new Logger(ScrapingService.name);
	async createInstance() {
		const options = new Options();
		options.setUserPreferences({
			'profile.default_content_setting_values.notifications': 2, // Block notifications
			'profile.default_content_setting_values.popups': 0, // Disable pop-ups
			'profile.default_content_setting_values.geolocation': 2, // Block geolocation
			'profile.default_content_setting_values.media_stream_camera': 2, // Block camera access
			'profile.default_content_setting_values.media_stream_mic': 2, // Block microphone access
		});
		options.addArguments('--disable-web-security'); // Disable web security
		options.addArguments('--disable-site-isolation-trials'); // Disable site isolation trials
		options.addArguments(
			'--disable-features=IsolateOrigins,site-per-process',
		); // Disable site isolation features
		options.addArguments('--disable-blink-features=AutomationControlled'); // Disable automation detection
		options.addArguments('--disable-infobars'); // Disable infobars
		options.addArguments('--disable-dev-shm-usage'); // Overcome limited resource problems
		options.addArguments('--no-sandbox'); // Bypass OS security
		// options.addArguments('--headless'); // Run in headless mode
		// options.addArguments('--disable-gpu'); // Disable GPU hardware acceleration
		options.addArguments('--window-size=1920,1080'); // Set window size
		options.addArguments('--disable-extensions'); // Disable extensions
		options.addArguments('--disable-popup-blocking'); // Disable popup blocking

		return await new Builder()
			.usingServer('http://selenium-hub:4444/wd/hub')
			.forBrowser(Browser.CHROME)
			.setChromeOptions(options)
			.build();
	}

	private async downloadImage(
		url: string,
		folderPath: string,
	): Promise<string> {
		try {
			this.logger.log(`Baixando imagem de ${url}`);
			this.logger.log(`Baixando imagem de ${new URL(url).pathname}`);
			this.logger.log(`Salvando imagem em ${folderPath}`);
			const fileName =
				uuidv4() +
				'.' +
				new URL(url).pathname.split('/').pop()?.split('.')[1];

			this.logger.log(`Nome do arquivo: ${fileName}`);
			const filePath = `${folderPath}/${fileName}`;
			if (!fsSync.existsSync(folderPath)) {
				await fs.mkdir(folderPath, { recursive: true });
			}
			const response = await axios.get<ArrayBuffer>(url, {
				responseType: 'arraybuffer',
			});
			await fs.writeFile(filePath, Buffer.from(response.data));
			this.logger.log(`✅ Imagem baixada e salva em ${filePath}`);
			return `localhost:3000/data/${fileName}`;
		} catch (error: any) {
			this.logger.error(
				`❌ Falha ao baixar a imagem ${url}. Erro: ${error?.message ?? error}`,
			);
			return '';
		}
	}

	async scrapePages(url: string) {
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
			await driver.sleep(2000);
			const imageElements = await driver.findElements({
				css: 'img',
			});
			this.logger.log(
				`Encontradas ${imageElements.length} imagens na página.`,
			);
			const imageUrls: string[] = [];
			for (const img of imageElements) {
				const src = await img.getAttribute('src');
				if (
					src &&
					(src.startsWith('http://') || src.startsWith('https://'))
				) {
					imageUrls.push(src);
				}
			}
			const paths: string[] = [];
			for (const url of imageUrls) {
				paths.push(await this.downloadImage(url, '/usr/src/app/data'));
			}
			return paths;
		} catch (error) {
			this.logger.error('Error during scraping:', error);
		} finally {
			await driver.quit();
		}
		this.logger.log('Scraping test completed successfully.');
	}
}
