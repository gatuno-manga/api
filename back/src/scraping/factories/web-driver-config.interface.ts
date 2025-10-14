/**
 * Configurações para criação do WebDriver
 */
export interface WebDriverConfig {
    seleniumUrl: string;
    downloadDir: string;
    headless?: boolean;
    scriptTimeout?: number;
    pageLoadTimeout?: number;
    userAgent?: string;
}
