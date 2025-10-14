import { Injectable, Logger } from '@nestjs/common';
import { Builder, Browser, WebDriver, Capabilities } from 'selenium-webdriver';
import { IWebDriverFactory } from './web-driver.factory.interface';
import { WebDriverConfig } from './web-driver-config.interface';
import firefoxOptionsConfig from '../config/firefoxOptionsConfig';
import { stealthScripts } from '../config/stealthScripts';

/**
 * Factory para criação de instâncias do Firefox WebDriver
 * Implementa o padrão Factory para encapsular a lógica de criação
 * e configuração do driver Firefox com Selenium
 */
@Injectable()
export class FirefoxDriverFactory implements IWebDriverFactory {
    private readonly logger = new Logger(FirefoxDriverFactory.name);

    constructor(private readonly config: WebDriverConfig) {}

    /**
     * Cria e configura uma instância do Firefox WebDriver
     * @returns Promise com a instância configurada do WebDriver
     */
    async createDriver(): Promise<WebDriver> {
        this.logger.debug('Criando instância do Firefox WebDriver');

        const firefoxCapabilities = this.buildCapabilities();
        const driver = await this.buildDriver(firefoxCapabilities);

        await this.applyStealthScripts(driver);
        await this.configureTimeouts(driver);

        this.logger.debug('Firefox WebDriver criado e configurado com sucesso');
        return driver;
    }

    /**
     * Constrói as capabilities do Firefox
     * @private
     */
    private buildCapabilities(): Capabilities {
        const firefoxCapabilities = Capabilities.firefox();
        const firefoxOptions = this.buildFirefoxOptions();

        firefoxCapabilities.set('moz:firefoxOptions', firefoxOptions);
        return firefoxCapabilities;
    }

    /**
     * Constrói as opções específicas do Firefox
     * @private
     */
    private buildFirefoxOptions() {
        const options = {
            ...firefoxOptionsConfig,
            prefs: {
                ...firefoxOptionsConfig.prefs,
                'browser.download.dir': this.config.downloadDir,
            },
            args: [...firefoxOptionsConfig.args],
        };

        // Adiciona modo headless se configurado
        if (this.config.headless) {
            options.args.push('-headless');
            this.logger.debug('Modo headless ativado');
        }

        // Adiciona user agent customizado se fornecido
        if (this.config.userAgent) {
            // No Firefox, o user agent é definido como preferência
            options.prefs['general.useragent.override'] = this.config.userAgent;
        } else {
            // Usa o user agent padrão do config
            options.prefs['general.useragent.override'] =
                firefoxOptionsConfig.userAgent;
        }

        return options;
    }

    /**
     * Constrói a instância do WebDriver
     * @private
     */
    private async buildDriver(capabilities: Capabilities): Promise<WebDriver> {
        return await new Builder()
            .usingServer(this.config.seleniumUrl)
            .forBrowser(Browser.FIREFOX)
            .withCapabilities(capabilities)
            .build();
    }

    /**
     * Aplica scripts de stealth para evitar detecção de automação
     * @private
     */
    private async applyStealthScripts(driver: WebDriver): Promise<void> {
        try {
            await driver.executeScript(stealthScripts.getAllScripts());
            this.logger.debug('Scripts de stealth aplicados com sucesso');
        } catch (error) {
            this.logger.warn('Falha ao aplicar scripts de stealth', error);
        }
    }

    /**
     * Configura os timeouts do driver
     * @private
     */
    private async configureTimeouts(driver: WebDriver): Promise<void> {
        await driver.manage().setTimeouts({
            script: this.config.scriptTimeout || 1_200_000,
            pageLoad: this.config.pageLoadTimeout || 1_200_000,
        });
        this.logger.debug('Timeouts configurados');
    }
}
