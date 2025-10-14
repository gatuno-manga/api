// firefoxOptionsConfig.ts
// Configurações de firefoxOptions para uso no ScrapingService (TypeScript)

export default {
    prefs: {
        'browser.download.dir': '/usr/src/app/data',
        'browser.download.folderList': 2, // 0=Desktop, 1=Downloads, 2=Custom
        'browser.download.useDownloadDir': true,
        'browser.download.manager.showWhenStarting': false,
        'browser.helperApps.neverAsk.saveToDisk':
            'application/pdf,application/octet-stream,image/jpeg,image/png,image/gif',
        'dom.popup_maximum': 0,
        'dom.webnotifications.enabled': false,
        'dom.push.enabled': false,
        'geo.enabled': false,

        'media.navigator.permission.disabled': true,
        'media.autoplay.default': 5, // 0=Allow, 1=Block, 5=Block all
        'plugin.state.flash': 0, // 0=Never Activate
        'privacy.trackingprotection.enabled': false, // Desabilitar para scraping
        'privacy.trackingprotection.socialtracking.enabled': false,
        'browser.cache.disk.enable': false,
        'browser.cache.memory.enable': false,
        'browser.sessionstore.resume_from_crash': false,
        'dom.disable_beforeunload': true,
        'browser.tabs.warnOnClose': false,
        'browser.tabs.warnOnCloseOtherTabs': false,
        // 'javascript.enabled': false, // Descomentar para bloquear JavaScript
        // 'permissions.default.image': 2, // 1=Allow, 2=Block
        'layout.css.devPixelsPerPx': '1.0',
    },
    args: [
        '--width=1920',
        '--height=1080',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-notifications',
        '--disable-extensions',
        '--disable-translate',
        '--disable-sync',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-features=IsolateOrigins,site-per-process',
    ],
    userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
};
