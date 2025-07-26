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
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'ExtensionError';
  }
}

class PopupManager {
  private kindleEmailInput!: HTMLInputElement;
  private workerUrlInput!: HTMLInputElement;
  private saveConfigBtn!: HTMLButtonElement;
  private sendPageBtn!: HTMLButtonElement;
  private pageTitleSpan!: HTMLSpanElement;
  private pageUrlSpan!: HTMLSpanElement;
  private statusMessage!: HTMLDivElement;

  private getElement<T extends HTMLElement>(id: string, expectedType: new () => T): T {
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
    this.pageTitleSpan = this.getElement('page-title', HTMLSpanElement);
    this.pageUrlSpan = this.getElement('page-url', HTMLSpanElement);
    this.statusMessage = this.getElement('status-message', HTMLDivElement);
  }

  private attachEventListeners(): void {
    this.saveConfigBtn.addEventListener('click', () => this.saveConfiguration());
    this.sendPageBtn.addEventListener('click', () => this.sendCurrentPage());
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['kindleEmail', 'workerUrl']);
      
      if (result.kindleEmail) {
        this.kindleEmailInput.value = result.kindleEmail;
      }
      
      if (result.workerUrl) {
        this.workerUrlInput.value = result.workerUrl;
      }
      
      this.updateSendButtonState();
    } catch (error) {
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
        workerUrl
      });

      this.showStatus('Configuration saved successfully!', 'success');
      this.updateSendButtonState();
    } catch (error) {
      this.showStatus('Failed to save configuration', 'error');
    }
  }

  private async loadCurrentPageInfo(): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab.id && tab.title && tab.url) {
        this.pageTitleSpan.textContent = tab.title;
        this.pageUrlSpan.textContent = tab.url;
      } else {
        this.pageTitleSpan.textContent = 'Unable to get page info';
        this.pageUrlSpan.textContent = 'No active tab';
      }
    } catch (error) {
      this.pageTitleSpan.textContent = 'Error loading page info';
      this.pageUrlSpan.textContent = 'Error';
    }
  }

  private async sendCurrentPage(): Promise<void> {
    const config = await this.getConfiguration();
    
    if (!config) {
      this.showStatus('Please configure your Kindle email and worker URL first', 'error');
      return;
    }

    this.sendPageBtn.disabled = true;
    this.sendPageBtn.textContent = 'Sending...';
    this.showStatus('Extracting page content...', 'info');

    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.id) {
        throw new ExtensionError('No active tab found');
      }

      // Extract content from the page
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
      
      if (!response.success) {
        throw new ExtensionError(response.error || 'Failed to extract page content');
      }

      const pageContent: PageContent = response.content;
      
      this.showStatus('Sending to Kindle...', 'info');

      // Send to worker
      await this.sendToWorker(config, pageContent);
      
      this.showStatus('Successfully sent to Kindle!', 'success');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.showStatus(`Failed to send: ${errorMessage}`, 'error');
    } finally {
      this.sendPageBtn.disabled = false;
      this.sendPageBtn.textContent = 'Send to Kindle';
    }
  }

  private async sendToWorker(config: ExtensionConfig, content: PageContent) {
    const payload = {
      url: content.url,
      kindleEmail: config.kindleEmail,
      subject: `Kindle: ${content.title}`,
      fromEmail: 'extension@sendtokindle.com'
    };

    const response = await fetch(config.workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  private async getConfiguration(): Promise<ExtensionConfig | null> {
    try {
      const result = await chrome.storage.sync.get(['kindleEmail', 'workerUrl']);
      
      if (result.kindleEmail && result.workerUrl) {
        return {
          kindleEmail: result.kindleEmail,
          workerUrl: result.workerUrl
        };
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private updateSendButtonState(): void {
    const hasEmail = this.kindleEmailInput.value.trim().length > 0;
    const hasWorkerUrl = this.workerUrlInput.value.trim().length > 0;
    
    this.sendPageBtn.disabled = !(hasEmail && hasWorkerUrl);
  }

  private showStatus(message: string, type: 'success' | 'error' | 'info'): void {
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