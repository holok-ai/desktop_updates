/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
import ElectronStore from 'electron-store';
import log from 'electron-log';
import { app } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { DEFAULT_HOLO_API_URL } from '../../src-shared/constants/api.constant.js';

/**
 * Application Settings Service
 *
 * Manages application configuration using electron-store for persistence.
 * Settings are stored in the user's app data folder and encrypted.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface AppSettings {
  // Moku Web URL - where the SSO login page is hosted
  mokuWebUrl: string;

  // Moku API URL - backend API endpoint
  mokuApiUrl: string;

  // Holo API URL - base URL for the Holo API endpoint
  holoApiUrl: string;

  // Directory Whitelist - trusted directories for file system access
  directoryWhitelist: string[];

  // Appearance
  theme?: 'light' | 'dark';
  startingPage?: 'create-chat' | 'threads' | 'last-page' | 'dashboard';
  showRecentList?: boolean;
  threadLayout?:
    | 'single-col'
    | 'vertical-split'
    | 'col-left-split'
    | 'col-right-split'
    | 'quad-split';
  chatFontSize?: number;
  chatLayout?: 'left-left' | 'left-right' | 'right-left';

  // Tools
  enabledTools?: string[];
  shellCommands?: string;

  // General
  deleteThreadConfirmationRequired?: boolean;
  deleteProjectConfirmationRequired?: boolean;

  // Background Prompts
  autoTitleEnabled?: boolean;

  // Updates
  autoCheckUpdates?: boolean;
  autoInstallUpdates?: boolean;
  updateAvailable?: boolean;
  latestVersion?: string;
  pendingUpdateVersion?: string;

  // Static tool list from ToolOrchestrator (added at runtime)
  static_toolList?: ToolDefinition[];

  // Artifact Editing
  unresolvedChangesBehavior?: 'include' | 'remove' | 'ask';
  maxDocumentSizeBytes?: number;
}

/**
 * Default settings
 * Using environment variables with localhost fallback for development/testing
 */
const DEFAULT_SETTINGS: AppSettings = {
  // Production Moku web URL (for SSO testing)
  // NOTE: This should be the Moku web app URL, NOT the desktop app URL
  mokuWebUrl: 'https://moku.holokai.dev',

  // Production Moku API URL
  mokuApiUrl: 'https://moku.holokai.dev',

  // Production Holo API URL (user-configurable)
  holoApiUrl: DEFAULT_HOLO_API_URL,

  // Directory Whitelist - empty by default
  directoryWhitelist: [],

  // General
  deleteThreadConfirmationRequired: false,
  deleteProjectConfirmationRequired: false,

  // Appearance
  theme: 'light',
  startingPage: 'create-chat',
  showRecentList: true,
  threadLayout: 'single-col',
  chatFontSize: 14,
  chatLayout: 'left-right',

  // Tools
  enabledTools: [],
  shellCommands: '',

  // Background Prompts
  autoTitleEnabled: true,

  // Updates
  autoCheckUpdates: true,
  autoInstallUpdates: false,
  updateAvailable: false,
  latestVersion: '',

  // Artifact Editing
  unresolvedChangesBehavior: 'ask',
  maxDocumentSizeBytes: 2 * 1024 * 1024, // 2 MB
};

/**
 * Settings Service
 * Provides type-safe access to application settings
 */
export class SettingsService {
  private store: ElectronStore<AppSettings>;

  constructor() {
    // Set custom config path to match logging structure: holokai/desktop
    const appDataPath = app.getPath('appData');
    const configPath = path.join(appDataPath, 'holokai', 'desktop');

    // Initialize electron-store with schema and custom path
    this.store = new ElectronStore<AppSettings>({
      cwd: configPath,
      defaults: DEFAULT_SETTINGS,
      schema: {
        mokuWebUrl: {
          type: 'string',
          format: 'uri',
          default: DEFAULT_SETTINGS.mokuWebUrl,
        },
        mokuApiUrl: {
          type: 'string',
          format: 'uri',
          default: DEFAULT_SETTINGS.mokuApiUrl,
        },
        holoApiUrl: {
          type: 'string',
          format: 'uri',
          default: DEFAULT_SETTINGS.holoApiUrl,
        },
        theme: {
          type: 'string',
          enum: ['light', 'dark'],
          default: DEFAULT_SETTINGS.theme,
        },
        startingPage: {
          type: 'string',
          enum: ['create-chat', 'threads', 'last-page', 'dashboard'],
          default: DEFAULT_SETTINGS.startingPage,
        },
        showRecentList: {
          type: 'boolean',
          default: DEFAULT_SETTINGS.showRecentList,
        },
        threadLayout: {
          type: 'string',
          enum: ['single-col', 'vertical-split', 'col-left-split', 'col-right-split', 'quad-split'],
          default: DEFAULT_SETTINGS.threadLayout,
        },
        chatFontSize: {
          type: 'number',
          minimum: 7,
          maximum: 20,
          default: DEFAULT_SETTINGS.chatFontSize,
        },
        chatLayout: {
          type: 'string',
          enum: ['left-left', 'left-right', 'right-left'],
          default: DEFAULT_SETTINGS.chatLayout,
        },
        enabledTools: {
          type: 'array',
          items: { type: 'string' },
          default: DEFAULT_SETTINGS.enabledTools,
        },
        shellCommands: {
          type: 'string',
          default: DEFAULT_SETTINGS.shellCommands,
        },
        autoTitleEnabled: {
          type: 'boolean',
          default: DEFAULT_SETTINGS.autoTitleEnabled,
        },
        autoCheckUpdates: {
          type: 'boolean',
          default: DEFAULT_SETTINGS.autoCheckUpdates,
        },
        autoInstallUpdates: {
          type: 'boolean',
          default: DEFAULT_SETTINGS.autoInstallUpdates,
        },
        updateAvailable: {
          type: 'boolean',
          default: DEFAULT_SETTINGS.updateAvailable,
        },
        latestVersion: {
          type: 'string',
          default: DEFAULT_SETTINGS.latestVersion,
        },
        directoryWhitelist: {
          type: 'array',
          items: { type: 'string' },
          default: DEFAULT_SETTINGS.directoryWhitelist,
        },
        unresolvedChangesBehavior: {
          type: 'string',
          enum: ['include', 'remove', 'ask'],
          default: DEFAULT_SETTINGS.unresolvedChangesBehavior,
        },
        maxDocumentSizeBytes: {
          type: 'number',
          minimum: 1024,
          maximum: 50 * 1024 * 1024, // 50 MB upper bound
          default: DEFAULT_SETTINGS.maxDocumentSizeBytes,
        },
      },
    } as any); // TODO: Reason to put any in here to pass the unit test since it require passing projectName. Will need define real type in future

    log.info('[SettingsService] Initialized');
    log.info('[SettingsService] Config path:', this.getStorePath());
    log.info('[SettingsService] Moku Web URL:', this.getMokuWebUrl());
    log.info('[SettingsService] Moku API URL:', this.getMokuApiUrl());
    log.info('[SettingsService] Holo API URL:', this.getHoloApiUrl());

    // Ensure config file exists on first run: create with defaults if missing
    try {
      const storePath = this.getStorePath();
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (!fs.existsSync(storePath)) {
        // Write current (default-merged) settings to disk to create config.json
        this.store.store = { ...DEFAULT_SETTINGS, ...this.store.store };
        log.info('[SettingsService] Created settings file with defaults at:', storePath);
      }
    } catch (err) {
      log.warn('[SettingsService] Unable to verify/create settings file:', err);
    }
  }

  /**
   * Get all settings
   */
  public getAllSettings(): AppSettings {
    return this.store.store;
  }

  /**
   * Get a specific setting
   */
  public getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.store.get(key);
  }

  /**
   * Set a specific setting
   */
  public setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    if (value === undefined) {
      throw new Error(
        `SettingsService.setSetting: value for key "${String(
          key,
        )}" is undefined. Use a dedicated clear method instead.`,
      );
    } else {
      this.store.set(key, value);
      log.info(`[SettingsService] Setting updated: ${key} = ${JSON.stringify(value)}`);
    }
  }

  /**
   * Clear a specific setting (delete from store)
   */
  public clearSetting<K extends keyof AppSettings>(key: K): void {
    this.store.delete(key);
    log.info(`[SettingsService] Setting deleted: ${String(key)}`);
  }

  /**
   * Set multiple settings at once
   */
  public setSettings(settings: Partial<AppSettings>): void {
    Object.entries(settings).forEach(([key, value]) => {
      this.store.set(key as keyof AppSettings, value as AppSettings[keyof AppSettings]);
    });
    log.info('[SettingsService] Multiple settings updated:', settings);
  }

  /**
   * Reset all settings to defaults
   */
  public resetToDefaults(): void {
    this.store.clear();
    log.info('[SettingsService] Settings reset to defaults');
  }

  /**
   * Get Moku Web URL (for SSO login)
   */
  public getMokuWebUrl(): string {
    return this.store.get('mokuWebUrl');
  }

  /**
   * Get Moku API URL
   */
  public getMokuApiUrl(): string {
    return this.store.get('mokuApiUrl');
  }

  /**
   * Get Holo API URL
   */
  public getHoloApiUrl(): string {
    return this.store.get('holoApiUrl');
  }

  /**
   * Get the file path where settings are stored
   */
  public getStorePath(): string {
    return this.store.path;
  }

  /**
   * Get directory whitelist
   */
  public getDirectoryWhitelist(): string[] {
    const whitelist = this.store.get('directoryWhitelist', []);
    return Array.isArray(whitelist) ? [...whitelist] : [];
  }

  /**
   * Add a path to the directory whitelist
   */
  public addWhitelistPath(filePath: string): void {
    if (!path.isAbsolute(filePath)) {
      throw new Error('Path must be absolute');
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(filePath)) {
      throw new Error('Path does not exist');
    }

    const whitelist = this.getDirectoryWhitelist();
    const normalized = path.normalize(filePath);

    if (!whitelist.includes(normalized)) {
      whitelist.push(normalized);
      this.store.set('directoryWhitelist', whitelist);
      log.info('[SettingsService] Added whitelist path:', normalized);
    }
  }

  /**
   * Remove a path from the directory whitelist
   */
  public removeWhitelistPath(filePath: string): void {
    const whitelist = this.getDirectoryWhitelist();
    const normalized = path.normalize(filePath);
    const filtered = whitelist.filter((p) => p !== normalized);

    this.store.set('directoryWhitelist', filtered);
    log.info('[SettingsService] Removed whitelist path:', normalized);
  }
}
