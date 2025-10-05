// Popup script for the browser extension

import { createBrowserAPI, TypedStorage } from '../utils/browser-api.js';
import type { PageContent } from '../utils/content-script.js';
import {
  DOMUtils,
  ContentUtils,
  PageInfoService,
  WorkerService,
  ConfigurationService,
  type StatusType,
} from '../utils/popup-script.js';

class PopupManager {
  private readonly api = createBrowserAPI();
  private readonly storage = new TypedStorage(this.api);
  private readonly configService = new ConfigurationService(this.storage);
  private readonly pageInfoService = new PageInfoService();
  private readonly workerService = new WorkerService();

  private kindleEmailInput!: HTMLInputElement;
  private workerUrlInput!: HTMLInputElement;
  private fromEmailInput!: HTMLInputElement;
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
    this.fromEmailInput = DOMUtils.getElement('from-email', HTMLInputElement);
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
      const config = await this.configService.loadConfiguration();
      console.log('Loaded configuration:', config);

      if (config.kindleEmail) {
        this.kindleEmailInput.value = config.kindleEmail;
      }

      if (config.workerUrl) {
        this.workerUrlInput.value = config.workerUrl;
      }

      if (config.fromEmail) {
        this.fromEmailInput.value = config.fromEmail;
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
    const fromEmail = this.fromEmailInput.value.trim();

    console.log('Validating inputs:', { kindleEmail, workerUrl, fromEmail });

    // Update button to show saving state
    const originalText = this.saveConfigBtn.textContent;
    this.saveConfigBtn.disabled = true;
    this.saveConfigBtn.textContent = 'Saving...';

    try {
      console.log('Saving configuration:', { kindleEmail, workerUrl, fromEmail });
      await this.configService.saveConfiguration({ kindleEmail, workerUrl, fromEmail });
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
      const pageInfo = await this.pageInfoService.getCurrentPageInfo();
      
      if (pageInfo) {
        this.pageTitleSpan.textContent = pageInfo.title;
        this.pageUrlSpan.textContent = pageInfo.url;
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
    const config = await this.configService.getValidConfiguration();

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
        pageContent = await this.pageInfoService.extractPageContent();
        this.cachedPageContent = pageContent;
      }

      this.showStatus('Sending to Kindle...', 'info');

      // Send to worker
      await this.workerService.sendToWorker(config, pageContent);

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
        this.cachedPageContent = await this.pageInfoService.extractPageContent();
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
    const wordCount = ContentUtils.calculateWordCount(content.content);
    const wordCountSpan = this.previewWordCount.querySelector('span');
    if (wordCountSpan) {
      wordCountSpan.textContent = wordCount.toString();
    }
    
    // Set content
    this.previewBody.innerHTML = ContentUtils.sanitizeContent(content.content);
  }


  private updateSendButtonState(): void {
    const hasEmail = this.kindleEmailInput.value.trim().length > 0;
    const hasWorkerUrl = this.workerUrlInput.value.trim().length > 0;
    const hasFromEmail = this.fromEmailInput.value.trim().length > 0;

    this.sendPageBtn.disabled = !(hasEmail && hasWorkerUrl && hasFromEmail);
  }

  private showStatus(
    message: string,
    type: StatusType,
  ): void {
    this.statusMessage.textContent = message;
    this.statusMessage.className = `status ${type}`;
    this.statusMessage.classList.remove('hidden');

    // Auto-hide success and info messages after 5 seconds, errors stay visible
    if (type === 'success') {
      setTimeout(() => {
        this.statusMessage.classList.add('hidden');
      }, 5000);
    } else if (type === 'info') {
      setTimeout(() => {
        this.statusMessage.classList.add('hidden');
      }, 3000);
    }
    // Error messages stay visible until manually dismissed or overwritten
  }

}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const popupManager = new PopupManager();
  popupManager.init().catch(console.error);
});
