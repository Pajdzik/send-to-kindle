// Content script utilities for page content extraction

import { createBrowserAPI, type MessageListener } from './browser-api.js';

/**
 * Page content extracted from a web page
 */
export interface PageContent {
  readonly title: string;
  readonly content: string;
  readonly url: string;
  readonly author?: string | undefined;
}

/**
 * Message types for content script communication
 */
export interface ContentScriptMessage {
  action: 'extractContent';
}

export interface ContentScriptResponse {
  success: boolean;
  content?: PageContent;
  error?: string;
}

/**
 * Content extraction utility class
 */
export class ContentExtractor {
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

/**
 * Content script message handler
 */
export class ContentScriptHandler {
  private readonly api = createBrowserAPI();

  /**
   * Initialize content script message handling
   */
  init(): void {
    const messageListener: MessageListener<ContentScriptMessage, ContentScriptResponse> = (
      request,
      _sender,
      sendResponse
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
    };

    this.api.runtime.onMessage.addListener(messageListener);
  }
}