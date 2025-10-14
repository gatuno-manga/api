import { Injectable, Logger } from '@nestjs/common';
import { Builder, Browser, Capabilities, WebDriver } from 'selenium-webdriver';
import { IWebDriverFactory } from './web-driver.factory.interface';
import { WebDriverConfig } from './web-driver-config.interface';
import chromeOptionsConfig from '../config/chromeOptionsConfig';
import { stealthScripts } from '../config/stealthScripts';

@Injectable()
export class ChromeDriverFactory implements IWebDriverFactory {
    private readonly logger = new Logger(ChromeDriverFactory.name);

    constructor(private readonly config: WebDriverConfig) {}

    async createDriver(): Promise<WebDriver> {
        this.logger.debug('Criando instância do Chrome WebDriver');

        const chromeCapabilities = this.buildCapabilities();
        const driver = await this.buildDriver(chromeCapabilities);

        await this.applyStealthScripts(driver);
        await this.configureTimeouts(driver);

        this.logger.debug('Chrome WebDriver criado e configurado com sucesso');
        return driver;
    }

    private buildCapabilities(): Capabilities {
        const chromeCapabilities = Capabilities.chrome();
        const chromeOptions = this.buildChromeOptions();

        chromeCapabilities.set('goog:chromeOptions', chromeOptions);
        return chromeCapabilities;
    }

    private buildChromeOptions() {
        const options = {
            ...chromeOptionsConfig,
            prefs: {
                ...chromeOptionsConfig.prefs,
                'download.default_directory': this.config.downloadDir,
            },
            args: [...chromeOptionsConfig.args],
        };

        if (this.config.headless) {
            options.args.push('--headless=new');
            this.logger.debug('Modo headless ativado');
        }

        if (this.config.userAgent) {
            const userAgentIndex = options.args.findIndex((arg) =>
                arg.startsWith('--user-agent='),
            );
            if (userAgentIndex >= 0) {
                options.args[userAgentIndex] = `--user-agent=${this.config.userAgent}`;
            } else {
                options.args.push(`--user-agent=${this.config.userAgent}`);
            }
        }

        return options;
    }

    private async buildDriver(
        capabilities: Capabilities,
    ): Promise<WebDriver> {
        return await new Builder()
            .usingServer(this.config.seleniumUrl)
            .forBrowser(Browser.CHROME)
            .withCapabilities(capabilities)
            .build();
    }

    private async applyStealthScripts(driver: WebDriver): Promise<void> {
        try {
            await driver.executeScript(stealthScripts.getAllScripts());
            this.logger.debug('Scripts de stealth aplicados com sucesso');
        } catch (error) {
            this.logger.warn(
                'Falha ao aplicar scripts de stealth',
                error,
            );
        }
    }

    private async configureTimeouts(driver: WebDriver): Promise<void> {
        await driver.manage().setTimeouts({
            script: this.config.scriptTimeout || 1_200_000,
            pageLoad: this.config.pageLoadTimeout || 1_200_000,
        });
        this.logger.debug('Timeouts configurados');
    }
}
