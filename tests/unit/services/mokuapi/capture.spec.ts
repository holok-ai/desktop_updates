import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock electron-log to avoid real logging
vi.mock('electron-log', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

// Shared mocks for fs
const mkdirSyncMock = vi.fn();
const writeFileSyncMock = vi.fn();

vi.mock('fs', () => ({
  default: {
    mkdirSync: mkdirSyncMock,
    writeFileSync: writeFileSyncMock,
  },
  mkdirSync: mkdirSyncMock,
  writeFileSync: writeFileSyncMock,
}));

// Helper to load a fresh copy of the module between tests
async function loadCaptureModule() {
  const mod = await import('../../../../src-electron/services/mokuapi/capture');
  return mod;
}

describe('mokuapi capture utility', () => {
  const originalEnv = process.env.CAPTURE_API_DATA;

  beforeEach(() => {
    vi.resetModules();
    mkdirSyncMock.mockReset();
    writeFileSyncMock.mockReset();
    // Default to disabled unless a test overrides it
    process.env.CAPTURE_API_DATA = 'false';
  });

  afterEach(() => {
    process.env.CAPTURE_API_DATA = originalEnv;
  });

  it('does nothing when capture is disabled', async () => {
    process.env.CAPTURE_API_DATA = 'false';
    const { captureResponse, isCaptureEnabled } = await loadCaptureModule();

    expect(isCaptureEnabled()).toBe(false);
    captureResponse('test-label', { foo: 'bar' });

    expect(mkdirSyncMock).not.toHaveBeenCalled();
    expect(writeFileSyncMock).not.toHaveBeenCalled();
  });

  it('writes a JSON file when capture is enabled', async () => {
    process.env.CAPTURE_API_DATA = 'true';

    // Stable timestamp for filename assertion
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_720_000_000_000);

    const { captureResponse, isCaptureEnabled } = await loadCaptureModule();

    expect(isCaptureEnabled()).toBe(true);

    captureResponse('messages thread-123 with spaces', { hello: 'world' });

    expect(mkdirSyncMock).toHaveBeenCalledTimes(1);
    const mkdirPath = mkdirSyncMock.mock.calls[0][0] as string;
    expect(mkdirPath.replace(/\\/g, '/')).toContain('tests/fixtures/api-captures/raw');

    expect(writeFileSyncMock).toHaveBeenCalledTimes(1);
    const [filePath, contents] = writeFileSyncMock.mock.calls[0] as [string, string];

    const normalizedPath = filePath.replace(/\\/g, '/');
    expect(normalizedPath).toMatch(
      /tests\/fixtures\/api-captures\/raw\/messages_thread-123_with_spaces-1720000000000\.json$/,
    );

    const parsed = JSON.parse(contents as string);
    expect(parsed).toEqual({ hello: 'world' });

    nowSpy.mockRestore();
  });

  it('sanitizes unsafe label characters in filenames', async () => {
    process.env.CAPTURE_API_DATA = 'true';

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_730_000_000_000);
    const { captureResponse } = await loadCaptureModule();

    captureResponse('messages:thread/abc?*', { ok: true });

    expect(writeFileSyncMock).toHaveBeenCalledTimes(1);
    const [filePath] = writeFileSyncMock.mock.calls[0] as [string];
    const normalizedPath = filePath.replace(/\\/g, '/');

    // All non [a-zA-Z0-9_-] chars should be replaced with '_'
    expect(normalizedPath).toMatch(/messages_thread_abc__-1730000000000\.json$/);

    nowSpy.mockRestore();
  });
});
