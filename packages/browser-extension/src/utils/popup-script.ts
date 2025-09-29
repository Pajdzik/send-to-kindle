// Popup script utilities for extension UI management

import { createBrowserAPI, TypedStorage, type StorageConfig } from './browser-api.js';
import type { PageContent } from './content-script.js';
import type { WorkerPayload } from './background-script.js';

/**
 * Extension configuration interface
 */
export interface ExtensionConfig {
  readonly kindleEmail: string;
  readonly workerUrl: string;
}

/**
 * Custom error classes for better error handling
 */
export class ElementNotFoundError extends Error {
  constructor(elementId: string) {
    super(`Required element not found: ${elementId}`);
    this.name = 'ElementNotFoundError';
  }
}

export class ElementTypeError extends Error {
  constructor(elementId: string, expectedType: string) {
    super(`Element ${elementId} is not of expected type: ${expectedType}`);
    this.name = 'ElementTypeError';
  }
}

export class ExtensionError extends Error {
  constructor(
    message: string,
    public override readonly cause?: Error
  ) {
    super(message);
    this.name = 'ExtensionError';
  }
}

/**
 * Status message types for UI feedback
 */
export type StatusType = 'success' | 'error' | 'info';

/**
 * DOM element utilities with type safety
 */
export class DOMUtils {
  /**
   * Get a DOM element by ID with type checking
   */
  static getElement<T extends HTMLElement>(
    id: string,
    expectedType: new () => T
  ): T {
    const element = document.getElementById(id);
    if (!element) {
      throw new ElementNotFoundError(id);
    }
    if (!(element instanceof expectedType)) {
      throw new ElementTypeError(id, expectedType.name);
    }
    return element;
  }

  /**
   * Get multiple elements with type checking
   */
  static getElements(
    selectors: Record<string, new () => HTMLElement>
  ): Record<string, HTMLElement> {
    const elements: Record<string, HTMLElement> = {};
    
    for (const [id, expectedType] of Object.entries(selectors)) {
      elements[id] = this.getElement(id, expectedType);
    }
    
    return elements;
  }
}

/**
 * Validation utilities
 */
export class ValidationUtils {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Validate email address format
   */
  static isValidEmail(email: string): boolean {
    return this.EMAIL_REGEX.test(email);
  }

  /**
   * Validate URL format
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate extension configuration
   */
  static validateConfig(config: Partial<ExtensionConfig>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.kindleEmail) {
      errors.push('Kindle email is required');
    } else if (!this.isValidEmail(config.kindleEmail)) {
      errors.push('Please enter a valid email address');
    }

    if (!config.workerUrl) {
      errors.push('Worker URL is required');
    } else if (!this.isValidUrl(config.workerUrl)) {
      errors.push('Please enter a valid worker URL');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Content processing utilities
 */
export class ContentUtils {
  /**
   * Calculate word count from HTML content
   */
  static calculateWordCount(htmlContent: string): number {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    const words = textContent.trim().split(/\s+/).filter(word => word.length > 0);
    
    return words.length;
  }

  /**
   * Sanitize HTML content for safe display
   */
  static sanitizeContent(htmlContent: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    // Remove potentially problematic elements
    const elementsToRemove = tempDiv.querySelectorAll('script, style, iframe, object, embed');
    for (const element of Array.from(elementsToRemove)) {
      element.remove();
    }
    
    return tempDiv.innerHTML;
  }
}

/**
 * Page information service
 */
export class PageInfoService {
  private readonly api = createBrowserAPI();

  /**
   * Get current active tab information
   */
  async getCurrentPageInfo(): Promise<{ title: string; url: string } | null> {
    try {
      const [tab] = await this.api.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tab?.title && tab?.url) {
        return {
          title: tab.title,
          url: tab.url,
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to get page info:', error);
      return null;
    }
  }

  /**
   * Extract content from current page
   */
  async extractPageContent(): Promise<PageContent> {
    const [tab] = await this.api.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) {
      throw new ExtensionError('No active tab found');
    }

    const response = await this.api.tabs.sendMessage(tab.id, {
      action: 'extractContent',
    }) as { success: boolean; content?: PageContent; error?: string };

    if (!response.success) {
      throw new ExtensionError(
        response.error || 'Failed to extract page content'
      );
    }

    if (!response.content) {
      throw new ExtensionError('No content received from page extraction');
    }

    return response.content;
  }
}

/**
 * Worker communication service
 */
export class WorkerService {
  private static readonly DEFAULT_FROM_EMAIL = 'extension@sendtokindle.com';

  /**
   * Send content to worker API
   */
  async sendToWorker(config: ExtensionConfig, content: PageContent): Promise<unknown> {
    const payload: WorkerPayload = {
      url: content.url,
      kindleEmail: config.kindleEmail,
      subject: `Kindle: ${content.title}`,
      fromEmail: WorkerService.DEFAULT_FROM_EMAIL,
    };

    const response = await fetch(config.workerUrl, {
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
 * Configuration service for extension settings
 */
export class ConfigurationService {
  private readonly storage: TypedStorage;

  constructor(storage: TypedStorage) {
    this.storage = storage;
  }

  /**
   * Load configuration from storage
   */
  async loadConfiguration(): Promise<Partial<StorageConfig>> {
    try {
      return await this.storage.get(['kindleEmail', 'workerUrl']);
    } catch (error) {
      console.error('Failed to load configuration:', error);
      throw new ExtensionError('Failed to load configuration', error as Error);
    }
  }

  /**
   * Save configuration to storage
   */
  async saveConfiguration(config: ExtensionConfig): Promise<void> {
    const validation = ValidationUtils.validateConfig(config);
    
    if (!validation.isValid) {
      throw new ExtensionError(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    try {
      await this.storage.set(config);
    } catch (error) {
      console.error('Failed to save configuration:', error);
      throw new ExtensionError('Failed to save configuration', error as Error);
    }
  }

  /**
   * Get valid configuration or null if incomplete
   */
  async getValidConfiguration(): Promise<ExtensionConfig | null> {
    const config = await this.loadConfiguration();
    
    if (config.kindleEmail && config.workerUrl) {
      return {
        kindleEmail: config.kindleEmail,
        workerUrl: config.workerUrl,
      };
    }

    return null;
  }
}