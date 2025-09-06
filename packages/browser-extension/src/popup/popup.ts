// Popup script for the browser extension

interface ExtensionConfig {
  kindleEmail: string;
  workerUrl: string;
}

interface PageContent {
  title: string;
  content: string;
  url: string;
  author?: string;
}

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
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'ExtensionError';
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

  private getElement<T extends HTMLElement>(
    id: string,
    expectedType: new () => T,
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

  async init(): Promise<void> {
    this.initializeElements();
    this.attachEventListeners();
    await this.loadConfiguration();
    await this.loadCurrentPageInfo();
  }

  private initializeElements(): void {
    this.kindleEmailInput = this.getElement('kindle-email', HTMLInputElement);
    this.workerUrlInput = this.getElement('worker-url', HTMLInputElement);
    this.saveConfigBtn = this.getElement('save-config', HTMLButtonElement);
    this.sendPageBtn = this.getElement('send-page', HTMLButtonElement);
    this.previewArticleBtn = this.getElement('preview-article', HTMLButtonElement);
    this.pageTitleSpan = this.getElement('page-title', HTMLSpanElement);
    this.pageUrlSpan = this.getElement('page-url', HTMLSpanElement);
    this.statusMessage = this.getElement('status-message', HTMLDivElement);
    
    // Preview elements
    this.previewSection = this.getElement('preview-section', HTMLDivElement);
    this.closePreviewBtn = this.getElement('close-preview', HTMLButtonElement);
    this.previewLoading = this.getElement('preview-loading', HTMLDivElement);
    this.previewArticleContent = this.getElement('preview-article-content', HTMLDivElement);
    this.previewError = this.getElement('preview-error', HTMLDivElement);
    this.previewTitle = this.getElement('preview-title', HTMLHeadingElement);
    this.previewAuthor = this.getElement('preview-author', HTMLParagraphElement);
    this.previewWordCount = this.getElement('preview-word-count', HTMLParagraphElement);
    this.previewBody = this.getElement('preview-body', HTMLDivElement);
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
      const result = await chrome.storage.sync.get([
        'kindleEmail',
        'workerUrl',
      ]);

      if (result.kindleEmail) {
        this.kindleEmailInput.value = result.kindleEmail;
      }

      if (result.workerUrl) {
        this.workerUrlInput.value = result.workerUrl;
      }

      this.updateSendButtonState();
    } catch (_error) {
      this.showStatus('Failed to load configuration', 'error');
    }
  }

  private async saveConfiguration(): Promise<void> {
    const kindleEmail = this.kindleEmailInput.value.trim();
    const workerUrl = this.workerUrlInput.value.trim();

    if (!kindleEmail || !workerUrl) {
      this.showStatus('Please fill in both email and worker URL', 'error');
      return;
    }

    if (!this.isValidEmail(kindleEmail)) {
      this.showStatus('Please enter a valid email address', 'error');
      return;
    }

    if (!this.isValidUrl(workerUrl)) {
      this.showStatus('Please enter a valid worker URL', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({
        kindleEmail,
        workerUrl,
      });

      this.showStatus('Configuration saved successfully!', 'success');
      this.updateSendButtonState();
    } catch (_error) {
      this.showStatus('Failed to save configuration', 'error');
    }
  }

  private async loadCurrentPageInfo(): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tab.id && tab.title && tab.url) {
        this.pageTitleSpan.textContent = tab.title;
        this.pageUrlSpan.textContent = tab.url;
      } else {
        this.pageTitleSpan.textContent = 'Unable to get page info';
        this.pageUrlSpan.textContent = 'No active tab';
      }
    } catch (_error) {
      this.pageTitleSpan.textContent = 'Error loading page info';
      this.pageUrlSpan.textContent = 'Error';
    }
  }

  private async sendCurrentPage(): Promise<void> {
    const config = await this.getConfiguration();

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
        // Extract content from the page
        pageContent = await this.extractPageContent();
      }

      this.showStatus('Sending to Kindle...', 'info');

      // Send to worker
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
    // Show preview section
    this.previewSection.classList.remove('hidden');
    
    // Show loading state
    this.showPreviewLoading();
    
    try {
      // Extract content if not cached
      if (!this.cachedPageContent) {
        this.cachedPageContent = await this.extractPageContent();
      }
      
      this.displayPreviewContent(this.cachedPageContent);
    } catch (error) {
      this.showPreviewError();
    }
  }

  private hidePreview(): void {
    this.previewSection.classList.add('hidden');
  }

  private async extractPageContent(): Promise<PageContent> {
    // Get current tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab.id) {
      throw new ExtensionError('No active tab found');
    }

    // Extract content from the page
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'extractContent',
    });

    if (!response.success) {
      throw new ExtensionError(
        response.error || 'Failed to extract page content',
      );
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
    // Hide loading and error states
    this.previewLoading.classList.add('hidden');
    this.previewError.classList.add('hidden');
    
    // Show article content
    this.previewArticleContent.classList.remove('hidden');
    
    // Set title
    this.previewTitle.textContent = content.title;
    
    // Set author if available
    if (content.author) {
      const authorSpan = this.previewAuthor.querySelector('span');
      if (authorSpan) {
        authorSpan.textContent = content.author;
        this.previewAuthor.classList.remove('hidden');
      }
    } else {
      this.previewAuthor.classList.add('hidden');
    }
    
    // Calculate and display word count
    const wordCount = this.calculateWordCount(content.content);
    const wordCountSpan = this.previewWordCount.querySelector('span');
    if (wordCountSpan) {
      wordCountSpan.textContent = wordCount.toString();
    }
    
    // Set content
    this.previewBody.innerHTML = this.sanitizeContent(content.content);
  }

  private calculateWordCount(htmlContent: string): number {
    // Create a temporary element to extract text content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    
    // Split by whitespace and filter out empty strings
    const words = textContent.trim().split(/\s+/).filter(word => word.length > 0);
    
    return words.length;
  }

  private sanitizeContent(htmlContent: string): string {
    // Create a temporary element to sanitize content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    // Remove potentially problematic elements
    const elementsToRemove = tempDiv.querySelectorAll('script, style, iframe, object, embed');
    for (const element of Array.from(elementsToRemove)) {
      element.remove();
    }
    
    return tempDiv.innerHTML;
  }

  private async sendToWorker(config: ExtensionConfig, content: PageContent) {
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
        errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return await response.json();
  }

  private async getConfiguration(): Promise<ExtensionConfig | null> {
    try {
      const result = await chrome.storage.sync.get([
        'kindleEmail',
        'workerUrl',
      ]);

      if (result.kindleEmail && result.workerUrl) {
        return {
          kindleEmail: result.kindleEmail,
          workerUrl: result.workerUrl,
        };
      }

      return null;
    } catch (_error) {
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
    type: 'success' | 'error' | 'info',
  ): void {
    this.statusMessage.textContent = message;
    this.statusMessage.className = `status ${type}`;
    this.statusMessage.classList.remove('hidden');

    // Auto-hide success and info messages after 3 seconds
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        this.statusMessage.classList.add('hidden');
      }, 3000);
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const popupManager = new PopupManager();
  popupManager.init().catch(console.error);
});
