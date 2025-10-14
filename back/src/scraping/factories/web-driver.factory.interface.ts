import { WebDriver } from 'selenium-webdriver';

export interface IWebDriverFactory {
    createDriver(): Promise<WebDriver>;
}
