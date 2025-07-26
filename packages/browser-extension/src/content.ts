// Content script to extract page content and communicate with background script

interface PageContent {
  title: string;
  content: string;
  url: string;
  author?: string;
}

function extractPageContent(): PageContent {
  // Remove scripts, styles, and other unwanted elements
  const elementsToRemove = [
    'script',
    'style',
    'nav',
    'header',
    'footer',
    'aside',
    '.ad',
    '.advertisement',
    '.sidebar',
    '.navigation',
    '.menu',
    '.social',
    '.share',
  ];

  const clonedDocument = document.cloneNode(true) as Document;

  elementsToRemove.forEach((selector) => {
    const elements = clonedDocument.querySelectorAll(selector);
    elements.forEach((el) => el.remove());
  });

  // Try to find the main content area
  const contentSelectors = [
    'article',
    'main',
    '[role="main"]',
    '.content',
    '.post-content',
    '.entry-content',
    '.article-content',
    '#content',
    '#main-content',
  ];

  let contentElement: Element | null = null;

  for (const selector of contentSelectors) {
    contentElement = clonedDocument.querySelector(selector);
    if (contentElement) break;
  }

  // If no main content found, use body but clean it up
  if (!contentElement) {
    contentElement = clonedDocument.body;

    // Remove common unwanted elements from body
    const unwantedSelectors = [
      'header',
      'nav',
      'footer',
      'aside',
      '.sidebar',
      '.navigation',
      '.menu',
      '.social-share',
      '.comments',
    ];

    unwantedSelectors.forEach((selector) => {
      const elements = contentElement?.querySelectorAll(selector);
      elements.forEach((el) => el.remove());
    });
  }

  // Extract author information
  let author: string | undefined;
  const authorSelectors = [
    '[rel="author"]',
    '.author',
    '.byline',
    '[class*="author"]',
    '[itemprop="author"]',
  ];

  for (const selector of authorSelectors) {
    const authorElement = document.querySelector(selector);
    if (authorElement?.textContent) {
      author = authorElement.textContent.trim();
      break;
    }
  }

  return {
    title: document.title,
    content: contentElement?.innerHTML || document.body.innerHTML,
    url: window.location.href,
    author,
  };
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'extractContent') {
    try {
      const content = extractPageContent();
      sendResponse({ success: true, content });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  return true; // Keep message channel open for async response
});
