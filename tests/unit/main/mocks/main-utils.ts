export function registerProtocol(app: any, opts: any, logger: any) {
  try {
    if (opts.defaultApp && opts.execPath) {
      app.setAsDefaultProtocolClient?.(opts.customProtocol ?? 'holokai', opts.execPath, [
        opts.argv?.[0],
      ]);
    } else {
      app.setAsDefaultProtocolClient?.(opts.customProtocol ?? 'holokai');
    }
  } catch (e) {
    // swallow
  }
  logger.info?.(`[Protocol] Registered custom protocol: ${opts.customProtocol ?? 'holokai'}://`);
}

export function checkSingleInstance(app: any): boolean {
  if (!app) return true;
  const got =
    typeof app.requestSingleInstanceLock === 'function' ? app.requestSingleInstanceLock() : true;
  if (!got && typeof app.quit === 'function') app.quit();
  return !!got;
}

export function windowsProtocolStartupHandler(
  argv: string[],
  _proto: string,
  cb: (url: string) => void,
) {
  const url = (argv || []).find((a) => typeof a === 'string' && a.startsWith('holokai://'));
  if (url) cb(url);
}

export function registerSecondInstanceHandler(app: any, cb: Function): boolean {
  const got =
    typeof app.requestSingleInstanceLock === 'function' ? app.requestSingleInstanceLock() : true;
  if (got && typeof app.on === 'function') app.on('second-instance', cb as any);
  return !!got;
}

export function createWindowFactory(
  BrowserWindowImpl: any,
  preloadPath: string,
  devUrl = 'http://localhost:5173',
  logger: any,
) {
  return function createWindow() {
    return new BrowserWindowImpl();
  };
}

export function handleOpenUrl(
  _url: string,
  _proto: string,
  _mainWindow: any,
  _cb: Function,
  logger: any,
) {
  try {
    // attempt to call provided callback; if it throws, log a warning
    if (typeof _cb === 'function') {
      try {
        _cb(_url, _mainWindow);
      } catch (err) {
        logger.warn?.('[Protocol] Error handling open url');
      }
    }
  } catch (e) {
    logger.warn?.('[Protocol] Error handling open url');
  }
}
