"use strict";
// Popup script for the browser extension
class PopupManager {
    kindleEmailInput;
    workerUrlInput;
    saveConfigBtn;
    sendPageBtn;
    pageTitleSpan;
    pageUrlSpan;
    statusMessage;
    async init() {
        this.initializeElements();
        this.attachEventListeners();
        await this.loadConfiguration();
        await this.loadCurrentPageInfo();
    }
    initializeElements() {
        this.kindleEmailInput = document.getElementById('kindle-email');
        this.workerUrlInput = document.getElementById('worker-url');
        this.saveConfigBtn = document.getElementById('save-config');
        this.sendPageBtn = document.getElementById('send-page');
        this.pageTitleSpan = document.getElementById('page-title');
        this.pageUrlSpan = document.getElementById('page-url');
        this.statusMessage = document.getElementById('status-message');
    }
    attachEventListeners() {
        this.saveConfigBtn.addEventListener('click', () => this.saveConfiguration());
        this.sendPageBtn.addEventListener('click', () => this.sendCurrentPage());
    }
    async loadConfiguration() {
        try {
            const result = await chrome.storage.sync.get(['kindleEmail', 'workerUrl']);
            if (result.kindleEmail) {
                this.kindleEmailInput.value = result.kindleEmail;
            }
            if (result.workerUrl) {
                this.workerUrlInput.value = result.workerUrl;
            }
            this.updateSendButtonState();
        }
        catch (error) {
            this.showStatus('Failed to load configuration', 'error');
        }
    }
    async saveConfiguration() {
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
        }
        catch (error) {
            this.showStatus('Failed to save configuration', 'error');
        }
    }
    async loadCurrentPageInfo() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab.id && tab.title && tab.url) {
                this.pageTitleSpan.textContent = tab.title;
                this.pageUrlSpan.textContent = tab.url;
            }
            else {
                this.pageTitleSpan.textContent = 'Unable to get page info';
                this.pageUrlSpan.textContent = 'No active tab';
            }
        }
        catch (error) {
            this.pageTitleSpan.textContent = 'Error loading page info';
            this.pageUrlSpan.textContent = 'Error';
        }
    }
    async sendCurrentPage() {
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
                throw new Error('No active tab found');
            }
            // Extract content from the page
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
            if (!response.success) {
                throw new Error(response.error || 'Failed to extract page content');
            }
            const pageContent = response.content;
            this.showStatus('Sending to Kindle...', 'info');
            // Send to worker
            await this.sendToWorker(config, pageContent);
            this.showStatus('Successfully sent to Kindle!', 'success');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            this.showStatus(`Failed to send: ${errorMessage}`, 'error');
        }
        finally {
            this.sendPageBtn.disabled = false;
            this.sendPageBtn.textContent = 'Send to Kindle';
        }
    }
    async sendToWorker(config, content) {
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
    async getConfiguration() {
        try {
            const result = await chrome.storage.sync.get(['kindleEmail', 'workerUrl']);
            if (result.kindleEmail && result.workerUrl) {
                return {
                    kindleEmail: result.kindleEmail,
                    workerUrl: result.workerUrl
                };
            }
            return null;
        }
        catch (error) {
            return null;
        }
    }
    updateSendButtonState() {
        const hasEmail = this.kindleEmailInput.value.trim().length > 0;
        const hasWorkerUrl = this.workerUrlInput.value.trim().length > 0;
        this.sendPageBtn.disabled = !(hasEmail && hasWorkerUrl);
    }
    showStatus(message, type) {
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
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        }
        catch {
            return false;
        }
    }
}
// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const popupManager = new PopupManager();
    popupManager.init().catch(console.error);
});
//# sourceMappingURL=popup.js.map