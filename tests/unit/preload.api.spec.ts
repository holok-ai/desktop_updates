import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prepare spies for ipcRenderer methods used in preload
const onSpy = vi.fn();
const removeListenerSpy = vi.fn();
const invokeSpy = vi.fn();
const sendSpy = vi.fn();

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (name: string, obj: unknown) => {
      // attach for direct import tests
      // @ts-ignore
      (globalThis as any)[name] = obj;
    },
  },
  ipcRenderer: {
    invoke: (...args: unknown[]) => invokeSpy(...args),
    on: (...args: unknown[]) => onSpy(...args),
    removeListener: (...args: unknown[]) => removeListenerSpy(...args),
    send: (...args: unknown[]) => sendSpy(...args),
  },
}));

describe('preload API behavior', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // import preload to populate global electronAPI
    await import('../../src-electron/preload');
  });

  it('auth.startOAuthFlow calls ipcRenderer.invoke', async () => {
    // @ts-ignore
    await (globalThis as any).electronAPI.auth.startOAuthFlow();
    expect(invokeSpy).toHaveBeenCalledWith('auth:startOAuthFlow');
  });

  it('log.info sends to ipcRenderer', () => {
    // @ts-ignore
    (globalThis as any).electronAPI.log.info('x', 1);
    expect(sendSpy).toHaveBeenCalledWith('log:info', 'x', 1);
  });

  it('thread.onThreadCreated registers listener and returns cleanup', () => {
    const cb = vi.fn();
    // @ts-ignore
    const cleanup = (globalThis as any).electronAPI.thread.onThreadCreated(cb);
    expect(onSpy).toHaveBeenCalledWith('thread:created', expect.any(Function));
    // call cleanup and ensure removeListener called
    cleanup();
    expect(removeListenerSpy).toHaveBeenCalled();
  });

  it('auth other methods invoke correct ipc channels', async () => {
    // @ts-ignore
    await (globalThis as any).electronAPI.auth.exchangeCode('code', 'ver');
    expect(invokeSpy).toHaveBeenCalledWith('auth:exchangeCode', 'code', 'ver');

    // @ts-ignore
    await (globalThis as any).electronAPI.auth.mockLogin('oauth2');
    expect(invokeSpy).toHaveBeenCalledWith('auth:mockLogin', 'oauth2');

    // @ts-ignore
    await (globalThis as any).electronAPI.auth.getAuthState();
    expect(invokeSpy).toHaveBeenCalledWith('auth:getAuthState');

    // @ts-ignore
    await (globalThis as any).electronAPI.auth.getUser();
    expect(invokeSpy).toHaveBeenCalledWith('auth:getUser');

    // @ts-ignore
    await (globalThis as any).electronAPI.auth.isAuthenticated();
    expect(invokeSpy).toHaveBeenCalledWith('auth:isAuthenticated');

    // @ts-ignore
    await (globalThis as any).electronAPI.auth.logout();
    expect(invokeSpy).toHaveBeenCalledWith('auth:logout');

    // @ts-ignore
    await (globalThis as any).electronAPI.auth.refreshToken();
    expect(invokeSpy).toHaveBeenCalledWith('auth:refreshToken');
  });

  it('settings API methods invoke correct channels', async () => {
    // @ts-ignore
    await (globalThis as any).electronAPI.settings.getAll();
    expect(invokeSpy).toHaveBeenCalledWith('settings:getAll');

    // @ts-ignore
    await (globalThis as any).electronAPI.settings.get('k');
    expect(invokeSpy).toHaveBeenCalledWith('settings:get', 'k');

    // @ts-ignore
    await (globalThis as any).electronAPI.settings.set('k', 'v');
    expect(invokeSpy).toHaveBeenCalledWith('settings:set', 'k', 'v');

    // @ts-ignore
    await (globalThis as any).electronAPI.settings.setMultiple({ mokuWebUrl: 'u' });
    expect(invokeSpy).toHaveBeenCalledWith('settings:setMultiple', { mokuWebUrl: 'u' });

    // @ts-ignore
    await (globalThis as any).electronAPI.settings.reset();
    expect(invokeSpy).toHaveBeenCalledWith('settings:reset');

    // @ts-ignore
    await (globalThis as any).electronAPI.settings.getMokuWebUrl();
    expect(invokeSpy).toHaveBeenCalledWith('settings:getMokuWebUrl');

    // @ts-ignore
    await (globalThis as any).electronAPI.settings.getMokuApiUrl();
    expect(invokeSpy).toHaveBeenCalledWith('settings:getMokuApiUrl');

    // @ts-ignore
    await (globalThis as any).electronAPI.settings.getStorePath();
    expect(invokeSpy).toHaveBeenCalledWith('settings:getStorePath');
  });

  it('thread API methods invoke correct channels', async () => {
    const sample = { title: 't', description: '', status: 'active', metadata: {} };
    // @ts-ignore
    await (globalThis as any).electronAPI.thread.getAll();
    expect(invokeSpy).toHaveBeenCalledWith('thread:getAll');

    // @ts-ignore
    await (globalThis as any).electronAPI.thread.getById('id');
    expect(invokeSpy).toHaveBeenCalledWith('thread:getById', 'id');

    // @ts-ignore
    await (globalThis as any).electronAPI.thread.create(sample);
    expect(invokeSpy).toHaveBeenCalledWith('thread:create', sample);

    // @ts-ignore
    await (globalThis as any).electronAPI.thread.update('id', { title: 'u' });
    expect(invokeSpy).toHaveBeenCalledWith('thread:update', 'id', { title: 'u' });

    // @ts-ignore
    await (globalThis as any).electronAPI.thread.delete('id');
    expect(invokeSpy).toHaveBeenCalledWith('thread:delete', 'id');
  });

  it('system API methods invoke correct channels and menu command listener', async () => {
    // @ts-ignore
    await (globalThis as any).electronAPI.system.platform();
    expect(invokeSpy).toHaveBeenCalledWith('system:platform');

    // @ts-ignore
    await (globalThis as any).electronAPI.system.version();
    expect(invokeSpy).toHaveBeenCalledWith('system:version');

    // @ts-ignore
    await (globalThis as any).electronAPI.system.getPath('home');
    expect(invokeSpy).toHaveBeenCalledWith('system:getPath', 'home');

    const cb = vi.fn();
    // @ts-ignore
    const cleanup = (globalThis as any).electronAPI.onMenuCommand('menu:cmd', cb);
    expect(onSpy).toHaveBeenCalledWith('menu:cmd', expect.any(Function));
    cleanup();
    expect(removeListenerSpy).toHaveBeenCalled();
  });

  it('thread event listeners for updated/deleted call through and cleanup', () => {
    const updatedCb = vi.fn();
    const deletedCb = vi.fn();
    // @ts-ignore
    const cleanupU = (globalThis as any).electronAPI.thread.onThreadUpdated(updatedCb);
    // @ts-ignore
    const cleanupD = (globalThis as any).electronAPI.thread.onThreadDeleted(deletedCb);
    expect(onSpy).toHaveBeenCalledWith('thread:updated', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('thread:deleted', expect.any(Function));
    cleanupU();
    cleanupD();
    expect(removeListenerSpy).toHaveBeenCalled();
  });

  it('log warn/error/debug call send with proper channels', () => {
    // @ts-ignore
    (globalThis as any).electronAPI.log.warn('w');
    expect(sendSpy).toHaveBeenCalledWith('log:warn', 'w');
    // @ts-ignore
    (globalThis as any).electronAPI.log.error('e');
    expect(sendSpy).toHaveBeenCalledWith('log:error', 'e');
    // @ts-ignore
    (globalThis as any).electronAPI.log.debug('d');
    expect(sendSpy).toHaveBeenCalledWith('log:debug', 'd');
  });
});
