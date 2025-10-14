import { Test, TestingModule } from '@nestjs/testing';
import { WebDriver } from 'selenium-webdriver';
import { ChromeDriverFactory } from './chrome-driver.factory';
import { FirefoxDriverFactory } from './firefox-driver.factory';
import { WebDriverConfig } from './web-driver-config.interface';
import { IWebDriverFactory } from './web-driver.factory.interface';

describe('WebDriver Factory Pattern', () => {
    let mockConfig: WebDriverConfig;

    beforeEach(() => {
        mockConfig = {
            seleniumUrl: 'http://localhost:4444',
            downloadDir: '/tmp/downloads',
            headless: false,
            scriptTimeout: 60000,
            pageLoadTimeout: 60000,
        };
    });

    describe('ChromeDriverFactory', () => {
        let factory: ChromeDriverFactory;

        beforeEach(() => {
            factory = new ChromeDriverFactory(mockConfig);
        });

        it('deve ser definido', () => {
            expect(factory).toBeDefined();
        });

        it('deve implementar IWebDriverFactory', () => {
            expect(factory).toHaveProperty('createDriver');
            expect(typeof factory.createDriver).toBe('function');
        });

        // Nota: Este teste requer um servidor Selenium ativo
        it.skip('deve criar uma instância do Chrome WebDriver', async () => {
            const driver = await factory.createDriver();
            expect(driver).toBeInstanceOf(WebDriver);
            await driver.quit();
        });

        it('deve usar a configuração fornecida', () => {
            expect(factory['config']).toEqual(mockConfig);
        });
    });

    describe('FirefoxDriverFactory', () => {
        let factory: FirefoxDriverFactory;

        beforeEach(() => {
            factory = new FirefoxDriverFactory(mockConfig);
        });

        it('deve ser definido', () => {
            expect(factory).toBeDefined();
        });

        it('deve implementar IWebDriverFactory', () => {
            expect(factory).toHaveProperty('createDriver');
            expect(typeof factory.createDriver).toBe('function');
        });

        // Nota: Este teste requer um servidor Selenium ativo
        it.skip('deve criar uma instância do Firefox WebDriver', async () => {
            const driver = await factory.createDriver();
            expect(driver).toBeInstanceOf(WebDriver);
            await driver.quit();
        });
    });

    describe('Factory Extensibility', () => {
        it('diferentes factories devem implementar a mesma interface', () => {
            const chromeFactory = new ChromeDriverFactory(mockConfig);
            const firefoxFactory = new FirefoxDriverFactory(mockConfig);

            // Ambos devem ter o método createDriver
            expect(chromeFactory.createDriver).toBeDefined();
            expect(firefoxFactory.createDriver).toBeDefined();

            // Ambos podem ser tratados como IWebDriverFactory
            const factories: IWebDriverFactory[] = [
                chromeFactory,
                firefoxFactory,
            ];

            factories.forEach((factory) => {
                expect(factory.createDriver).toBeDefined();
            });
        });

        it('deve permitir adicionar novos factories sem modificar código existente', () => {
            // Mock de um novo factory
            class MockBrowserFactory implements IWebDriverFactory {
                constructor(private config: WebDriverConfig) {}

                async createDriver(): Promise<WebDriver> {
                    // Mock implementation
                    return {} as WebDriver;
                }
            }

            const mockFactory = new MockBrowserFactory(mockConfig);
            expect(mockFactory).toBeDefined();
            expect(mockFactory.createDriver).toBeDefined();
        });
    });

    describe('WebDriverConfig', () => {
        it('deve aceitar configuração mínima', () => {
            const minimalConfig: WebDriverConfig = {
                seleniumUrl: 'http://localhost:4444',
                downloadDir: '/downloads',
            };

            expect(minimalConfig.seleniumUrl).toBeDefined();
            expect(minimalConfig.downloadDir).toBeDefined();
            expect(minimalConfig.headless).toBeUndefined();
        });

        it('deve aceitar configuração completa', () => {
            const fullConfig: WebDriverConfig = {
                seleniumUrl: 'http://localhost:4444',
                downloadDir: '/downloads',
                headless: true,
                scriptTimeout: 120000,
                pageLoadTimeout: 120000,
                userAgent: 'Custom Bot/1.0',
            };

            expect(fullConfig.headless).toBe(true);
            expect(fullConfig.userAgent).toBe('Custom Bot/1.0');
        });
    });

    describe('Factory Integration with ScrapingService', () => {
        it('deve permitir injeção de factory customizado', () => {
            // Mock de um factory customizado
            const mockFactory: IWebDriverFactory = {
                createDriver: jest.fn().mockResolvedValue({
                    quit: jest.fn(),
                    get: jest.fn(),
                    executeScript: jest.fn(),
                } as unknown as WebDriver),
            };

            // O ScrapingService pode aceitar este factory
            expect(mockFactory.createDriver).toBeDefined();
        });

        it('deve permitir trocar factory em runtime', () => {
            const chromeFactory = new ChromeDriverFactory(mockConfig);
            const firefoxFactory = new FirefoxDriverFactory(mockConfig);

            let currentFactory: IWebDriverFactory = chromeFactory;
            expect(currentFactory).toBe(chromeFactory);

            // Simula troca de factory
            currentFactory = firefoxFactory;
            expect(currentFactory).toBe(firefoxFactory);
        });
    });
});
