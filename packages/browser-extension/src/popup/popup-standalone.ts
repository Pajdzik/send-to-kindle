// Popup script for the browser extension
// Standalone version for Firefox compatibility

// Firefox compatibility - use browser API if chrome API is not available
const popupBrowserAPI = (() => {
  if (typeof chrome !== 'undefined') return chrome;
  if (typeof (globalThis as any).browser !== 'undefined') return (globalThis as any).browser;
  throw new Error('No browser extension API found');
})();

interface ExtensionConfig {
  readonly kindleEmail: string;
  readonly workerUrl: string;
}

interface PageContent {
  title: string;
  content: string;
  url: string;
  author?: string | undefined;
}

type StatusType = 'success' | 'error' | 'info';

class ElementNotFoundError extends Error {
  constructor(elementId: string) {
    super(`Required element not found: ${elementId}`);
    this.name = 'ElementNotFoundError';
  }
}

class ElementTypeError extends Error {
  constructor(elementId: string, expectedType: string) {
    super(`Element ${elementId} is not of expected type: ${expectedType}`);
    this.name = 'ElementTypeError';
  }
}

class ExtensionError extends Error {
  constructor(
    message: string,
    public override readonly cause?: Error
  ) {
    super(message);
    this.name = 'ExtensionError';
  }
}

/**
 * DOM element utilities with type safety
 */
class DOMUtils {
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
}

/**
 * Validation utilities
 */
class ValidationUtils {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  static isValidEmail(email: string): boolean {
    return this.EMAIL_REGEX.test(email);
  }

  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

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
class ContentUtils {
  static calculateWordCount(htmlContent: string): number {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    const words = textContent.trim().split(/\s+/).filter(word => word.length > 0);
    
    return words.length;
  }

  static sanitizeContent(htmlContent: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    const elementsToRemove = tempDiv.querySelectorAll('script, style, iframe, object, embed');
    for (const element of Array.from(elementsToRemove)) {
      element.remove();
    }
    
    return tempDiv.innerHTML;
  }
}

class PopupManager {
  private kindleEmailInput!: HTMLInputElement;
  private workerUrlInput!: HTMLInputElement;
  private saveConfigBtn!: HTMLButtonElement;
  private sendPageBtn!: HTMLButtonElement;
  private previewArticleBtn!: HTMLButtonElement;
  private pageTitleSpan!: HTMLSpanElement;
  private pageUrlSpan!: HTMLSpanElement;
  private statusMessage!: HTMLDivElement;
  
  // Preview elements
  private previewSection!: HTMLDivElement;
  private closePreviewBtn!: HTMLButtonElement;
  private previewLoading!: HTMLDivElement;
  private previewArticleContent!: HTMLDivElement;
  private previewError!: HTMLDivElement;
  private previewTitle!: HTMLHeadingElement;
  private previewAuthor!: HTMLParagraphElement;
  private previewWordCount!: HTMLParagraphElement;
  private previewBody!: HTMLDivElement;
  
  private cachedPageContent: PageContent | null = null;

  async init(): Promise<void> {
    this.initializeElements();
    this.attachEventListeners();
    await this.loadConfiguration();
    await this.loadCurrentPageInfo();
  }

  private initializeElements(): void {
    this.kindleEmailInput = DOMUtils.getElement('kindle-email', HTMLInputElement);
    this.workerUrlInput = DOMUtils.getElement('worker-url', HTMLInputElement);
    this.saveConfigBtn = DOMUtils.getElement('save-config', HTMLButtonElement);
    this.sendPageBtn = DOMUtils.getElement('send-page', HTMLButtonElement);
    this.previewArticleBtn = DOMUtils.getElement('preview-article', HTMLButtonElement);
    this.pageTitleSpan = DOMUtils.getElement('page-title', HTMLSpanElement);
    this.pageUrlSpan = DOMUtils.getElement('page-url', HTMLSpanElement);
    this.statusMessage = DOMUtils.getElement('status-message', HTMLDivElement);
    this.previewSection = DOMUtils.getElement('preview-section', HTMLDivElement);
    this.closePreviewBtn = DOMUtils.getElement('close-preview', HTMLButtonElement);
    this.previewLoading = DOMUtils.getElement('preview-loading', HTMLDivElement);
    this.previewArticleContent = DOMUtils.getElement('preview-article-content', HTMLDivElement);
    this.previewError = DOMUtils.getElement('preview-error', HTMLDivElement);
    this.previewTitle = DOMUtils.getElement('preview-title', HTMLHeadingElement);
    this.previewAuthor = DOMUtils.getElement('preview-author', HTMLParagraphElement);
    this.previewWordCount = DOMUtils.getElement('preview-word-count', HTMLParagraphElement);
    this.previewBody = DOMUtils.getElement('preview-body', HTMLDivElement);
  }

  private attachEventListeners(): void {
    this.saveConfigBtn.addEventListener('click', () =>
      this.saveConfiguration(),
    );
    this.sendPageBtn.addEventListener('click', () => this.sendCurrentPage());
    this.previewArticleBtn.addEventListener('click', () => this.showPreview());
    this.closePreviewBtn.addEventListener('click', () => this.hidePreview());
  }

  private async loadConfiguration(): Promise<void> {
    try {
      console.log('Loading configuration...');
      const result = await popupBrowserAPI.storage.sync.get([
        'kindleEmail',
        'workerUrl',
      ]);
      console.log('Loaded configuration:', result);

      if (result['kindleEmail']) {
        this.kindleEmailInput.value = result['kindleEmail'];
      }

      if (result['workerUrl']) {
        this.workerUrlInput.value = result['workerUrl'];
      }

      this.updateSendButtonState();
    } catch (error) {
      console.error('Failed to load configuration:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.showStatus(`Failed to load: ${errorMessage}`, 'error');
    }
  }

  private async saveConfiguration(): Promise<void> {
    const kindleEmail = this.kindleEmailInput.value.trim();
    const workerUrl = this.workerUrlInput.value.trim();

    console.log('Validating inputs:', { kindleEmail, workerUrl });

    const validation = ValidationUtils.validateConfig({ kindleEmail, workerUrl });
    
    if (!validation.isValid) {
      this.showStatus(`Invalid configuration: ${validation.errors.join(', ')}`, 'error');
      return;
    }

    // Update button to show saving state
    const originalText = this.saveConfigBtn.textContent;
    this.saveConfigBtn.disabled = true;
    this.saveConfigBtn.textContent = 'Saving...';

    try {
      console.log('Saving configuration:', { kindleEmail, workerUrl });
      await popupBrowserAPI.storage.sync.set({
        kindleEmail,
        workerUrl,
      });
      console.log('Configuration saved successfully');

      // Show success state on button
      this.saveConfigBtn.textContent = 'Saved!';
      this.saveConfigBtn.style.backgroundColor = '#28a745';
      
      this.showStatus('Configuration saved successfully!', 'success');
      this.updateSendButtonState();

      // Reset button after 2 seconds
      setTimeout(() => {
        this.saveConfigBtn.textContent = originalText;
        this.saveConfigBtn.disabled = false;
        this.saveConfigBtn.style.backgroundColor = '';
      }, 2000);
    } catch (error) {
      console.error('Failed to save configuration:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.showStatus(`Failed to save: ${errorMessage}`, 'error');
      // Reset button on error
      this.saveConfigBtn.textContent = originalText;
      this.saveConfigBtn.disabled = false;
    }
  }

  private async loadCurrentPageInfo(): Promise<void> {
    try {
      const [tab] = await popupBrowserAPI.tabs.query({
        active: true,
        currentWindow: true,
      });
      
      if (tab?.title && tab?.url) {
        this.pageTitleSpan.textContent = tab.title;
        this.pageUrlSpan.textContent = tab.url;
      } else {
        this.pageTitleSpan.textContent = 'Unable to get page info';
        this.pageUrlSpan.textContent = 'No active tab';
      }
    } catch (error) {
      console.error('Failed to load page info:', error);
      this.pageTitleSpan.textContent = 'Error loading page info';
      this.pageUrlSpan.textContent = 'Error';
    }
  }

  private async sendCurrentPage(): Promise<void> {
    const config = await this.getValidConfiguration();

    if (!config) {
      this.showStatus(
        'Please configure your Kindle email and worker URL first',
        'error',
      );
      return;
    }

    this.sendPageBtn.disabled = true;
    this.sendPageBtn.textContent = 'Sending...';
    this.showStatus('Extracting page content...', 'info');

    try {
      let pageContent = this.cachedPageContent;
      
      if (!pageContent) {
        pageContent = await this.extractPageContent();
        this.cachedPageContent = pageContent;
      }

      this.showStatus('Sending to Kindle...', 'info');

      await this.sendToWorker(config, pageContent);

      this.showStatus('Successfully sent to Kindle!', 'success');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.showStatus(`Failed to send: ${errorMessage}`, 'error');
    } finally {
      this.sendPageBtn.disabled = false;
      this.sendPageBtn.textContent = 'Send to Kindle';
    }
  }

  private async showPreview(): Promise<void> {
    this.previewSection.classList.remove('hidden');
    this.showPreviewLoading();
    
    try {
      if (!this.cachedPageContent) {
        this.cachedPageContent = await this.extractPageContent();
      }
      
      this.displayPreviewContent(this.cachedPageContent);
    } catch (error) {
      console.error('Failed to show preview:', error);
      this.showPreviewError();
    }
  }

  private hidePreview(): void {
    this.previewSection.classList.add('hidden');
  }

  private async extractPageContent(): Promise<PageContent> {
    const [tab] = await popupBrowserAPI.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) {
      throw new ExtensionError('No active tab found');
    }

    const response = await popupBrowserAPI.tabs.sendMessage(tab.id, {
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

  private showPreviewLoading(): void {
    this.previewLoading.classList.remove('hidden');
    this.previewArticleContent.classList.add('hidden');
    this.previewError.classList.add('hidden');
  }

  private showPreviewError(): void {
    this.previewLoading.classList.add('hidden');
    this.previewArticleContent.classList.add('hidden');
    this.previewError.classList.remove('hidden');
  }

  private displayPreviewContent(content: PageContent): void {
    this.previewLoading.classList.add('hidden');
    this.previewError.classList.add('hidden');
    this.previewArticleContent.classList.remove('hidden');
    
    this.previewTitle.textContent = content.title;
    
    if (content.author) {
      const authorSpan = this.previewAuthor.querySelector('span');
      if (authorSpan) {
        authorSpan.textContent = content.author;
        this.previewAuthor.classList.remove('hidden');
      }
    } else {
      this.previewAuthor.classList.add('hidden');
    }
    
    const wordCount = ContentUtils.calculateWordCount(content.content);
    const wordCountSpan = this.previewWordCount.querySelector('span');
    if (wordCountSpan) {
      wordCountSpan.textContent = wordCount.toString();
    }
    
    this.previewBody.innerHTML = ContentUtils.sanitizeContent(content.content);
  }

  private async sendToWorker(config: ExtensionConfig, content: PageContent): Promise<void> {
    const payload = {
      url: content.url,
      kindleEmail: config.kindleEmail,
      subject: `Kindle: ${content.title}`,
      fromEmail: 'extension@sendtokindle.com',
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

    await response.json();
  }

  private async getValidConfiguration(): Promise<ExtensionConfig | null> {
    try {
      const result = await popupBrowserAPI.storage.sync.get([
        'kindleEmail',
        'workerUrl',
      ]);

      if (result['kindleEmail'] && result['workerUrl']) {
        return {
          kindleEmail: result['kindleEmail'],
          workerUrl: result['workerUrl'],
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to get configuration:', error);
      return null;
    }
  }

  private updateSendButtonState(): void {
    const hasEmail = this.kindleEmailInput.value.trim().length > 0;
    const hasWorkerUrl = this.workerUrlInput.value.trim().length > 0;

    this.sendPageBtn.disabled = !(hasEmail && hasWorkerUrl);
  }

  private showStatus(
    message: string,
    type: StatusType,
  ): void {
    this.statusMessage.textContent = message;
    this.statusMessage.className = `status ${type}`;
    this.statusMessage.classList.remove('hidden');

    if (type === 'success') {
      setTimeout(() => {
        this.statusMessage.classList.add('hidden');
      }, 5000);
    } else if (type === 'info') {
      setTimeout(() => {
        this.statusMessage.classList.add('hidden');
      }, 3000);
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const popupManager = new PopupManager();
  popupManager.init().catch(console.error);
});