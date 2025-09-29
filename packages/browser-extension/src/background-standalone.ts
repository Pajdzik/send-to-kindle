// Background service worker for the browser extension
// Standalone version for cross-browser compatibility

// Firefox compatibility - use browser API if chrome API is not available
const backgroundBrowserAPI = (() => {
  if (typeof chrome !== 'undefined') return chrome;
  if (typeof (globalThis as any).browser !== 'undefined') return (globalThis as any).browser;
  throw new Error('No browser extension API found');
})();

interface SendToKindleRequest {
  readonly url: string;
  readonly kindleEmail: string;
  readonly workerUrl: string;
  readonly title?: string | undefined;
  readonly author?: string | undefined;
}

interface WorkerPayload {
  readonly url: string;
  readonly kindleEmail: string;
  readonly subject: string;
  readonly fromEmail: string;
}

// Handle extension installation
backgroundBrowserAPI.runtime.onInstalled.addListener((details: chrome.runtime.InstalledDetails) => {
  if (details.reason === 'install') {
    console.log('Send to Kindle extension installed');

    // Set default worker URL if not already set
    backgroundBrowserAPI.storage.sync.get(['workerUrl']).then((result: { [key: string]: any }) => {
      if (!result['workerUrl']) {
        backgroundBrowserAPI.storage.sync.set({
          workerUrl: 'https://your-worker.workers.dev',
        });
      }
    });
  }

  // Create context menu
  createContextMenu();
});

// Create context menu on startup
backgroundBrowserAPI.runtime.onStartup?.addListener(() => {
  createContextMenu();
});

function createContextMenu(): void {
  backgroundBrowserAPI.contextMenus?.create({
    id: 'sendToKindle',
    title: 'Send to Kindle',
    contexts: ['page'],
  });
}

// Handle messages from content scripts and popup
backgroundBrowserAPI.runtime.onMessage.addListener((
  request: { action: string; data?: SendToKindleRequest },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: { success: boolean; result?: any; error?: string }) => void
) => {
  if (request.action === 'sendToKindle' && request.data) {
    handleSendToKindle(request.data)
      .then((result) => sendResponse({ success: true, result }))
      .catch((error: Error) => sendResponse({ success: false, error: error.message }));

    return true; // Keep message channel open for async response
  }
  return false;
});

async function handleSendToKindle(data: SendToKindleRequest): Promise<any> {
  const payload: WorkerPayload = {
    url: data.url,
    kindleEmail: data.kindleEmail,
    subject: data.title ? `Kindle: ${data.title}` : `Kindle: ${data.url}`,
    fromEmail: 'extension@sendtokindle.com',
  };

  const response = await fetch(data.workerUrl, {
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

// Handle context menu clicks
backgroundBrowserAPI.contextMenus?.onClicked.addListener(
  async (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
    if (info.menuItemId !== 'sendToKindle' || !tab?.id) {
      return;
    }

    try {
      // Get configuration
      const config = await backgroundBrowserAPI.storage.sync.get([
        'kindleEmail',
        'workerUrl',
      ]);

      if (!config['kindleEmail'] || !config['workerUrl']) {
        // Open popup for configuration
        backgroundBrowserAPI.action?.openPopup();
        return;
      }

      // Extract content from the page
      const response = await backgroundBrowserAPI.tabs.sendMessage(tab.id, {
        action: 'extractContent',
      }) as { success: boolean; content?: { url: string; title: string; author?: string } };

      if (response.success && response.content) {
        await handleSendToKindle({
          url: response.content.url,
          kindleEmail: config['kindleEmail'],
          workerUrl: config['workerUrl'],
          title: response.content.title,
          author: response.content.author,
        });

        // Show success notification
        await showNotification('📚', 'Send to Kindle', 'Page sent successfully!');
      }
    } catch (error) {
      console.error('Failed to send to Kindle:', error);
      await showNotification('❌', 'Send to Kindle', 'Failed to send page');
    }
  }
);

async function showNotification(
  icon: string,
  title: string,
  message: string
): Promise<void> {
  const iconUrl = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><text y="14" font-size="16">${icon}</text></svg>`;
  
  await backgroundBrowserAPI.notifications?.create({
    type: 'basic',
    iconUrl,
    title,
    message,
  });
}