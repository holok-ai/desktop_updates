export default function electronMock() {
  const ipcMain = {
    handle: (_ch: string, _fn?: any) => {},
    on: (_ch: string, _fn?: any) => {},
    removeHandler: (_ch: string) => {},
  } as any;

  const app = {
    getPath: (name: string) => `/mock/${name}`,
    setAsDefaultProtocolClient: jestLikeFn(),
    on: jestLikeFn(),
    whenReady: () => Promise.resolve(),
    requestSingleInstanceLock: jestLikeFn(() => true),
    quit: jestLikeFn(),
  } as any;

  function jestLikeFn(impl?: any) {
    const fn: any = (...args: any[]) => impl ? impl(...args) : undefined;
    fn.mock = { calls: [] };
    fn.mockImplementation = (f: any) => { impl = f; };
    fn.mockImplementationOnce = (f: any) => { impl = f; };
    return fn;
  }

  class BrowserWindow {
    webContents: any;
    constructor() {
      this.webContents = {
        send: jestLikeFn(),
        isDevToolsOpened: jestLikeFn(() => false),
        openDevTools: jestLikeFn(),
        closeDevTools: jestLikeFn(),
      };
      (this as any).loadURL = async (_url: string) => Promise.resolve();
      (this as any).loadFile = async (_file: string) => Promise.resolve();
    }
    on(_ev: string, _cb: any) {}
    static getAllWindows() { return []; }
  }

  const Menu = { buildFromTemplate: jestLikeFn(() => ({})), setApplicationMenu: jestLikeFn() } as any;
  const dialog = { showMessageBox: jestLikeFn(async () => ({})) } as any;
  const contextBridge = { exposeInMainWorld: jestLikeFn() };
  const ipcRenderer = { invoke: jestLikeFn(), on: jestLikeFn(), removeListener: jestLikeFn(), send: jestLikeFn() };
  const safeStorage = { isEncryptionAvailable: jestLikeFn(() => false) };

  return { app, BrowserWindow, Menu, dialog, contextBridge, ipcRenderer, safeStorage, ipcMain };
}


