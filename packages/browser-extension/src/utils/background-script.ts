// Background script utilities for service worker functionality

import { createBrowserAPI, TypedStorage, type MessageListener } from './browser-api.js';

/**
 * Send to Kindle request data
 */
export interface SendToKindleRequest {
  readonly url: string;
  readonly kindleEmail: string;
  readonly workerUrl: string;
  readonly fromEmail: string;
  readonly title?: string | undefined;
  readonly author?: string | undefined;
}

/**
 * Worker API payload
 */
export interface WorkerPayload {
  readonly url: string;
  readonly kindleEmail: string;
  readonly subject: string;
  readonly fromEmail: string;
}

/**
 * Background script message types
 */
export interface BackgroundMessage {
  action: 'sendToKindle';
  data: SendToKindleRequest;
}

export interface BackgroundResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Extension installation manager
 */
export class InstallationManager {
  constructor(private readonly storage: TypedStorage) {}

  /**
   * Handle extension installation events
   */
  init(): void {
    const api = createBrowserAPI();
    
    api.runtime.onInstalled.addListener((details: chrome.runtime.InstalledDetails) => {
      if (details.reason === 'install') {
        console.log('Send to Kindle extension installed');
        this.setDefaultConfiguration();
      }
    });
  }

  private async setDefaultConfiguration(): Promise<void> {
    try {
      const existingConfig = await this.storage.get(['workerUrl']);
      
      if (!existingConfig.workerUrl) {
        await this.storage.set({
          workerUrl: 'https://your-worker.workers.dev',
        });
      }
    } catch (error) {
      console.error('Failed to set default configuration:', error);
    }
  }
}

/**
 * Send to Kindle service
 */
export class SendToKindleService {
  /**
   * Send content to Kindle via worker API
   */
  async sendToKindle(request: SendToKindleRequest): Promise<unknown> {
    const payload: WorkerPayload = {
      url: request.url,
      kindleEmail: request.kindleEmail,
      subject: request.title ? `Kindle: ${request.title}` : `Kindle: ${request.url}`,
      fromEmail: request.fromEmail,
    };

    const response = await fetch(request.workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: 'Network error' }));
      
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return response.json();
  }
}

/**
 * Context menu manager
 */
export class ContextMenuManager {
  private readonly api = createBrowserAPI();
  private readonly storage: TypedStorage;
  private readonly sendToKindleService = new SendToKindleService();

  constructor(storage: TypedStorage) {
    this.storage = storage;
  }

  /**
   * Initialize context menu functionality
   */
  init(): void {
    // Create context menu on startup and installation
    this.api.runtime.onStartup?.addListener(() => {
      this.createContextMenu();
    });

    this.api.runtime.onInstalled.addListener(() => {
      this.createContextMenu();
    });

    // Handle context menu clicks
    this.api.contextMenus?.onClicked.addListener(
      async (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
        await this.handleContextMenuClick(info, tab);
      }
    );
  }

  private createContextMenu(): void {
    this.api.contextMenus?.create({
      id: 'sendToKindle',
      title: 'Send to Kindle',
      contexts: ['page'],
    });
  }

  private async handleContextMenuClick(
    info: chrome.contextMenus.OnClickData,
    tab?: chrome.tabs.Tab
  ): Promise<void> {
    if (info.menuItemId !== 'sendToKindle' || !tab?.id) {
      return;
    }

    try {
      // Get configuration
      const config = await this.storage.get(['kindleEmail', 'workerUrl', 'fromEmail']);

      if (!config.kindleEmail || !config.workerUrl || !config.fromEmail) {
        // Open popup for configuration
        this.api.action?.openPopup();
        return;
      }

      // Extract content from the page
      const response = await this.api.tabs.sendMessage(tab.id, {
        action: 'extractContent',
      }) as { success: boolean; content?: { url: string; title: string; author?: string } };

      if (response.success && response.content) {
        await this.sendToKindleService.sendToKindle({
          url: response.content.url,
          kindleEmail: config.kindleEmail,
          workerUrl: config.workerUrl,
          fromEmail: config.fromEmail,
          title: response.content.title,
          author: response.content.author,
        });

        // Show success notification
        await this.showNotification('📚', 'Send to Kindle', 'Page sent successfully!');
      }
    } catch (error) {
      console.error('Failed to send to Kindle:', error);
      await this.showNotification('❌', 'Send to Kindle', 'Failed to send page');
    }
  }

  private async showNotification(
    icon: string,
    title: string,
    message: string
  ): Promise<void> {
    const iconUrl = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><text y="14" font-size="16">${icon}</text></svg>`;
    
    await this.api.notifications?.create({
      type: 'basic',
      iconUrl,
      title,
      message,
    });
  }
}

/**
 * Background script message handler
 */
export class BackgroundMessageHandler {
  private readonly api = createBrowserAPI();
  private readonly sendToKindleService = new SendToKindleService();

  /**
   * Initialize background script message handling
   */
  init(): void {
    const messageListener: MessageListener<BackgroundMessage, BackgroundResponse> = (
      request,
      _sender,
      sendResponse
    ) => {
      if (request.action === 'sendToKindle') {
        this.sendToKindleService
          .sendToKindle(request.data)
          .then((result) => sendResponse({ success: true, result }))
          .catch((error: Error) => sendResponse({ success: false, error: error.message }));

        return true; // Keep message channel open for async response
      }
      return false;
    };

    this.api.runtime.onMessage.addListener(messageListener);
  }
}

/**
 * Main background script manager
 */
export class BackgroundScriptManager {
  private readonly api = createBrowserAPI();
  private readonly storage = new TypedStorage(this.api);
  private readonly installationManager = new InstallationManager(this.storage);
  private readonly messageHandler = new BackgroundMessageHandler();
  private readonly contextMenuManager = new ContextMenuManager(this.storage);

  /**
   * Initialize all background script functionality
   */
  init(): void {
    this.installationManager.init();
    this.messageHandler.init();
    this.contextMenuManager.init();
  }
}