// Browser API utilities with cross-platform compatibility
// This module provides consistent browser extension API access for Chrome and Firefox

/**
 * Unified browser extension API interface
 * Provides common methods needed across all extension contexts
 */
export interface BrowserAPI {
  readonly runtime: {
    onInstalled: chrome.runtime.RuntimeInstalledEvent;
    onMessage: chrome.runtime.ExtensionMessageEvent;
    onStartup?: chrome.runtime.RuntimeEvent;
    sendMessage: (tabId: number, message: unknown) => Promise<unknown>;
  };
  readonly storage: {
    sync: {
      get: (keys: string[]) => Promise<Record<string, unknown>>;
      set: (items: Record<string, unknown>) => Promise<void>;
    };
  };
  readonly tabs: {
    query: (queryInfo: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>;
    sendMessage: (tabId: number, message: unknown) => Promise<unknown>;
  };
  readonly contextMenus?: {
    create: (createProperties: chrome.contextMenus.CreateProperties) => void;
    onClicked: chrome.contextMenus.MenuClickedEvent;
  };
  readonly action?: {
    openPopup: () => void;
  };
  readonly notifications?: {
    create: (options: chrome.notifications.NotificationOptions) => Promise<string>;
  };
}

/**
 * Creates a unified browser API instance with cross-platform compatibility
 * @returns BrowserAPI instance for Chrome or Firefox
 * @throws Error if no compatible browser extension API is found
 */
export function createBrowserAPI(): BrowserAPI {
  // Chrome extension API
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome as unknown as BrowserAPI;
  }
  
  // Firefox extension API (WebExtensions)
  if (typeof globalThis !== 'undefined' && 'browser' in globalThis) {
    const browser = (globalThis as Record<string, unknown>)['browser'];
    if (browser && typeof browser === 'object' && browser !== null && 'runtime' in browser) {
      return browser as unknown as BrowserAPI;
    }
  }
  
  throw new Error('No compatible browser extension API found. This extension requires Chrome or Firefox.');
}

/**
 * Type-safe wrapper for chrome.runtime.onMessage listener
 */
export type MessageListener<T = unknown, R = unknown> = (
  request: T,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: R) => void
) => boolean | void;

/**
 * Type-safe wrapper for storage sync operations
 */
export interface StorageConfig {
  kindleEmail?: string;
  workerUrl?: string;
  fromEmail?: string;
}

/**
 * Type-safe storage utilities
 */
export class TypedStorage {
  constructor(private readonly api: BrowserAPI) {}

  async get<T extends keyof StorageConfig>(
    keys: T[]
  ): Promise<Pick<StorageConfig, T>> {
    return this.api.storage.sync.get(keys) as Promise<Pick<StorageConfig, T>>;
  }

  async set(config: Partial<StorageConfig>): Promise<void> {
    return this.api.storage.sync.set(config);
  }
}