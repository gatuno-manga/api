// chromeOptionsConfig.ts
// Configurações de chromeOptions para uso no ScrapingService (TypeScript)

export default {
    prefs: {
        'download.default_directory': '/usr/src/app/data',
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
        '--disable-animations',
        '--disable-transitions',
        '--disable-notifications',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-ipc-flooding-protection',
        '--disable-default-apps',
        '--disable-translate',
        '--disable-sync',
        // '--headless',
    ],
};
