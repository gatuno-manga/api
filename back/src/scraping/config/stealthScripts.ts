export const stealthScripts = {
  removeWebdriverProperty: `
    try {
      if ('webdriver' in navigator) {
        delete navigator.webdriver;
      }

      if (!('webdriver' in navigator) || Object.getOwnPropertyDescriptor(navigator, 'webdriver')?.configurable !== false) {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
          configurable: true
        });
      }
    } catch (e) {
      console.debug('Could not redefine webdriver property');
    }
  `,

  addFakePlugins: `
    try {
      if (!navigator.plugins || navigator.plugins.length === 0) {
        Object.defineProperty(navigator, 'plugins', {
          get: () => ({
            length: 5,
            0: { name: 'Chrome PDF Plugin' },
            1: { name: 'Chrome PDF Viewer' },
            2: { name: 'Native Client' },
            3: { name: 'WebKit built-in PDF' },
            4: { name: 'Microsoft Edge PDF Plugin' }
          }),
          configurable: true
        });
      }
    } catch (e) {
      console.debug('Could not add fake plugins');
    }
  `,

  addMouseMovement: `
    try {
      ['mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout', 'click'].forEach(eventType => {
        document.addEventListener(eventType, function(e) {
          Object.defineProperty(e, 'isTrusted', {
            get: () => true
          });
        }, true);
      });
    } catch (e) {
      console.debug('Could not add mouse event listeners');
    }
  `,

  addRealBrowserProperties: `
    try {
      if (!window.chrome) {
        window.chrome = {
          runtime: {
            onConnect: null,
            onMessage: null
          }
        };
      }

      if (!navigator.permissions) {
        Object.defineProperty(navigator, 'permissions', {
          get: () => ({
            query: () => Promise.resolve({ state: 'granted' })
          }),
          configurable: true
        });
      }

      if (window.callPhantom) {
        delete window.callPhantom;
      }
      if (window._phantom) {
        delete window._phantom;
      }

    } catch (e) {
      console.debug('Could not add browser properties');
    }
  `,

  getAllScripts: function () {
    return [
      this.removeWebdriverProperty,
      this.addFakePlugins,
      this.addMouseMovement,
      this.addRealBrowserProperties
    ].join('\n');
  }
};
