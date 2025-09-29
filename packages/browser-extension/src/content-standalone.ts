// Content script to extract page content and communicate with background script
// This is a standalone version that doesn't use ES modules since content scripts don't support them

// Firefox compatibility - use browser API if chrome API is not available
const contentBrowserAPI = (() => {
  if (typeof chrome !== 'undefined') return chrome;
  if (typeof (globalThis as any).browser !== 'undefined') return (globalThis as any).browser;
  throw new Error('No browser extension API found');
})();

interface PageContent {
  title: string;
  content: string;
  url: string;
  author?: string | undefined;
}

/**
 * Content extraction utility class
 */
class ContentExtractor {
  private static readonly ELEMENTS_TO_REMOVE = [
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
  ] as const;

  private static readonly CONTENT_SELECTORS = [
    'article',
    'main',
    '[role="main"]',
    '.content',
    '.post-content',
    '.entry-content',
    '.article-content',
    '#content',
    '#main-content',
  ] as const;

  private static readonly UNWANTED_BODY_SELECTORS = [
    'header',
    'nav',
    'footer',
    'aside',
    '.sidebar',
    '.navigation',
    '.menu',
    '.social-share',
    '.comments',
  ] as const;

  private static readonly AUTHOR_SELECTORS = [
    '[rel="author"]',
    '.author',
    '.byline',
    '[class*="author"]',
    '[itemprop="author"]',
  ] as const;

  /**
   * Extracts clean content from the current page
   */
  static extractPageContent(): PageContent {
    const clonedDocument = document.cloneNode(true) as Document;

    // Remove unwanted elements
    ContentExtractor.removeElements(clonedDocument, ContentExtractor.ELEMENTS_TO_REMOVE);

    // Find main content
    const contentElement = ContentExtractor.findMainContent(clonedDocument);

    // Extract author information
    const author = ContentExtractor.extractAuthor();

    return {
      title: document.title,
      content: contentElement?.innerHTML || document.body.innerHTML,
      url: window.location.href,
      author,
    };
  }

  private static removeElements(doc: Document, selectors: readonly string[]): void {
    for (const selector of selectors) {
      const elements = doc.querySelectorAll(selector);
      for (const element of Array.from(elements)) {
        element.remove();
      }
    }
  }

  private static findMainContent(doc: Document): Element | null {
    // Try to find main content area
    for (const selector of ContentExtractor.CONTENT_SELECTORS) {
      const element = doc.querySelector(selector);
      if (element) return element;
    }

    // Fallback to body but clean it up
    const bodyElement = doc.body;
    if (bodyElement) {
      ContentExtractor.removeElements(doc, ContentExtractor.UNWANTED_BODY_SELECTORS);
    }

    return bodyElement;
  }

  private static extractAuthor(): string | undefined {
    for (const selector of ContentExtractor.AUTHOR_SELECTORS) {
      const authorElement = document.querySelector(selector);
      if (authorElement?.textContent) {
        return authorElement.textContent.trim();
      }
    }
    return undefined;
  }
}

// Listen for messages from popup/background
contentBrowserAPI.runtime.onMessage.addListener((
  request: { action: string },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: { success: boolean; content?: PageContent; error?: string }) => void
) => {
  if (request.action === 'extractContent') {
    try {
      const content = ContentExtractor.extractPageContent();
      sendResponse({ success: true, content });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      sendResponse({
        success: false,
        error: errorMessage,
      });
    }
  }
  return true; // Keep message channel open for async response
});