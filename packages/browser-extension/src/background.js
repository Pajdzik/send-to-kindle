// Background service worker for the browser extension
// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Send to Kindle extension installed');
    // Set default worker URL if not already set
    chrome.storage.sync.get(['workerUrl']).then((result) => {
      if (!result.workerUrl) {
        chrome.storage.sync.set({
          workerUrl: 'https://your-worker.workers.dev',
        });
      }
    });
  }
});
// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'sendToKindle') {
    handleSendToKindle(request.data)
      .then((result) => sendResponse({ success: true, result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
});
async function handleSendToKindle(data) {
  const payload = {
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
// Handle context menu (optional feature for right-click send)
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'sendToKindle' && tab?.id) {
    try {
      // Get configuration
      const config = await chrome.storage.sync.get([
        'kindleEmail',
        'workerUrl',
      ]);
      if (!config.kindleEmail || !config.workerUrl) {
        // Open popup for configuration
        chrome.action.openPopup();
        return;
      }
      // Extract content from the page
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractContent',
      });
      if (response.success) {
        await handleSendToKindle({
          url: response.content.url,
          kindleEmail: config.kindleEmail,
          workerUrl: config.workerUrl,
          title: response.content.title,
          author: response.content.author,
        });
        // Show success notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl:
            'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><text y="14" font-size="16">📚</text></svg>',
          title: 'Send to Kindle',
          message: 'Page sent successfully!',
        });
      }
    } catch (error) {
      console.error('Failed to send to Kindle:', error);
      // Show error notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl:
          'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><text y="14" font-size="16">❌</text></svg>',
        title: 'Send to Kindle',
        message: 'Failed to send page',
      });
    }
  }
});
// Create context menu on startup
chrome.runtime.onStartup.addListener(() => {
  createContextMenu();
});
chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();
});
function createContextMenu() {
  chrome.contextMenus.create({
    id: 'sendToKindle',
    title: 'Send to Kindle',
    contexts: ['page'],
  });
}
//# sourceMappingURL=background.js.map
