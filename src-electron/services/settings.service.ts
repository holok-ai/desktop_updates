/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
import ElectronStore from 'electron-store';
import log from 'electron-log';

/**
 * Application Settings Service
 *
 * Manages application configuration using electron-store for persistence.
 * Settings are stored in the user's app data folder and encrypted.
 */

export interface AppSettings {
  // Moku Web URL - where the SSO login page is hosted
  mokuWebUrl: string;

  // Moku API URL - backend API endpoint
  mokuApiUrl: string;

  // Other settings can be added here
  theme?: 'light' | 'dark';
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Default settings
 * Using localhost for development/testing
 */
const DEFAULT_SETTINGS: AppSettings = {
  // Development Moku web URL (for SSO testing)
  // NOTE: This should be the Moku web app URL, NOT the desktop app URL
  mokuWebUrl: 'http://localhost:4201', // Moku web runs on different port

  // Development Moku API URL
  mokuApiUrl: 'http://localhost:3000/api',

  // Production alternatives (commented out):
  // mokuWebUrl: 'https://moku.holokai.com',
  // mokuApiUrl: 'https://moku.holokai.com/api',

  theme: 'light',
  logLevel: 'info',
};

/**
 * Settings Service
 * Provides type-safe access to application settings
 */
export class SettingsService {
  private store: ElectronStore<AppSettings>;

  constructor() {
    // Initialize electron-store with schema
    this.store = new ElectronStore<AppSettings>({
      projectName: process.env.npm_package_name ?? 'holokai-desktop',
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
        theme: {
          type: 'string',
          enum: ['light', 'dark'],
          default: DEFAULT_SETTINGS.theme,
        },
        logLevel: {
          type: 'string',
          enum: ['debug', 'info', 'warn', 'error'],
          default: DEFAULT_SETTINGS.logLevel,
        },
      },
    } as any); // TODO: Reason to put any in here to pass the unit test since it require passing projectName. Will need define real type in future

    log.info('[SettingsService] Initialized');
    log.info('[SettingsService] Moku Web URL:', this.getMokuWebUrl());
    log.info('[SettingsService] Moku API URL:', this.getMokuApiUrl());
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
    this.store.set(key, value);
    log.info(`[SettingsService] Setting updated: ${key} = ${value}`);
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
   * Set Moku Web URL
   */
  public setMokuWebUrl(url: string): void {
    this.store.set('mokuWebUrl', url);
    log.info('[SettingsService] Moku Web URL updated:', url);
  }

  /**
   * Get Moku API URL
   */
  public getMokuApiUrl(): string {
    return this.store.get('mokuApiUrl');
  }

  /**
   * Set Moku API URL
   */
  public setMokuApiUrl(url: string): void {
    this.store.set('mokuApiUrl', url);
    log.info('[SettingsService] Moku API URL updated:', url);
  }

  /**
   * Get theme setting
   */
  public getTheme(): 'light' | 'dark' {
    return this.store.get('theme', 'light');
  }

  /**
   * Set theme
   */
  public setTheme(theme: 'light' | 'dark'): void {
    this.store.set('theme', theme);
    log.info('[SettingsService] Theme updated:', theme);
  }

  /**
   * Get log level
   */
  public getLogLevel(): 'debug' | 'info' | 'warn' | 'error' {
    return this.store.get('logLevel', 'info');
  }

  /**
   * Set log level
   */
  public setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.store.set('logLevel', level);
    log.info('[SettingsService] Log level updated:', level);
  }

  /**
   * Get the file path where settings are stored
   */
  public getStorePath(): string {
    return this.store.path;
  }
}
