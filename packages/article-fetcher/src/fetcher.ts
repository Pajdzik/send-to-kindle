import { JSDOM } from 'jsdom';

export interface ArticleContent {
  title: string;
  content: string;
  author?: string;
  publishedDate?: string;
}

// Constants for better maintainability
const UNWANTED_SELECTORS = [
  'script',
  'style',
  'nav',
  'header',
  'footer',
  'aside',
  'iframe',
  'object',
  'embed',
] as const;

const UNWANTED_CLASSES = [
  'sidebar',
  'navigation',
  'menu',
  'advertisement',
  'ads',
  'social',
  'comments',
  'related',
  'recommended',
  'popup',
  'modal',
] as const;

const CONTENT_SELECTORS = [
  'article',
  'main',
  '[role="main"]',
  '.post',
  '.entry',
  '.content',
  '.article',
  '.story',
] as const;

const AUTHOR_SELECTORS = [
  'meta[name="author"]',
  'meta[property="article:author"]',
  'meta[name="twitter:creator"]',
] as const;

const DATE_SELECTORS = [
  'meta[property="article:published_time"]',
  'meta[name="date"]',
  'meta[property="article:published"]',
  'meta[name="pubdate"]',
] as const;

const MIN_PARAGRAPH_LENGTH = 30;
const MIN_LIST_ITEM_LENGTH = 10;

export class ArticleFetcher {
  async fetchArticle(_url: string): Promise<string> {
    // TODO: Implement article fetching logic
    throw new Error('Not implemented');
  }

  extractContent(html: string): ArticleContent {
    if (typeof html !== 'string') {
      throw new Error('Invalid HTML input: must be a string');
    }

    // Handle empty HTML gracefully
    if (!html.trim()) {
      return {
        title: '',
        content: '',
        author: undefined,
        publishedDate: undefined,
      };
    }

    // Create DOM once and reuse
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const title = this.extractTitle(document);
    const metadata = this.extractMetadata(document);
    const content = this.extractMainContent(document);

    return {
      title,
      content,
      author: metadata.author,
      publishedDate: metadata.publishedDate,
    };
  }

  private extractTitle(document: Document): string {
    const titleElement = document.querySelector('title');
    if (titleElement) {
      return this.cleanText(titleElement.textContent?.trim() || '');
    }

    const h1Element = document.querySelector('h1');
    if (h1Element) {
      return this.cleanText(h1Element.textContent?.trim() || '');
    }

    return '';
  }

  private extractMetadata(document: Document): {
    author?: string;
    publishedDate?: string;
  } {
    const author = this.extractMetaContent(document, AUTHOR_SELECTORS);
    const publishedDate = this.extractMetaContent(document, DATE_SELECTORS);

    return { author, publishedDate };
  }

  private extractMetaContent(
    document: Document,
    selectors: readonly string[],
  ): string | undefined {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const content = element.getAttribute('content');
        if (content?.trim()) {
          return content.trim();
        }
      }
    }
    return undefined;
  }

  private extractMainContent(document: Document): string {
    // Remove unwanted elements
    this.removeUnwantedElements(document);

    // Find content sections
    for (const selector of CONTENT_SELECTORS) {
      const element = document.querySelector(selector);
      if (element) {
        return this.extractTextFromElement(element);
      }
    }

    // Fallback to paragraphs
    const paragraphs = Array.from(document.querySelectorAll('p'))
      .map((p) => this.cleanContentText(p.textContent?.trim() || ''))
      .filter((text) => text.length > MIN_PARAGRAPH_LENGTH);

    const headings = Array.from(
      document.querySelectorAll('h1, h2, h3, h4, h5, h6'),
    )
      .map((h) => this.cleanContentText(h.textContent?.trim() || ''))
      .filter((text) => text.length > 0);

    const allContent = [...headings, ...paragraphs];

    return allContent.length > 0
      ? allContent.join(' ')
      : this.extractAllTextFromElement(document.body);
  }

  private removeUnwantedElements(document: Document): void {
    // Remove unwanted element types
    for (const selector of UNWANTED_SELECTORS) {
      for (const el of document.querySelectorAll(selector)) {
        el.remove();
      }
    }

    // Remove elements with unwanted classes
    for (const className of UNWANTED_CLASSES) {
      for (const el of document.querySelectorAll(`.${className}`)) {
        el.remove();
      }
    }
  }

  private extractTextFromElement(element: Element): string {
    const paragraphs = Array.from(element.querySelectorAll('p'))
      .map((p) => this.cleanContentText(p.textContent?.trim() || ''))
      .filter((text) => text.length > MIN_LIST_ITEM_LENGTH);

    const headings = Array.from(
      element.querySelectorAll('h1, h2, h3, h4, h5, h6'),
    )
      .map((h) => this.cleanContentText(h.textContent?.trim() || ''))
      .filter((text) => text.length > 0);

    const lists = Array.from(element.querySelectorAll('li'))
      .map((li) => this.cleanContentText(li.textContent?.trim() || ''))
      .filter((text) => text.length > MIN_LIST_ITEM_LENGTH);

    const allContent = [...headings, ...paragraphs, ...lists];

    return allContent.length > 0
      ? allContent.join(' ')
      : this.cleanContentText(element.textContent?.trim() || '');
  }

  private extractAllTextFromElement(element: Element | null): string {
    if (!element) return '';
    return this.cleanContentText(element.textContent?.trim() || '');
  }

  private cleanText(text: string): string {
    // Decode HTML entities using a temporary DOM element
    const tempElement = new JSDOM('<div></div>').window.document.createElement(
      'div',
    );
    tempElement.innerHTML = text;
    const decoded = tempElement.textContent || tempElement.innerText || '';

    // Normalize whitespace
    return decoded.replace(/\s+/g, ' ').trim();
  }

  private cleanContentText(text: string): string {
    // First clean like normal text
    const cleaned = this.cleanText(text);

    // For content, remove ampersands and other symbols that might be problematic
    return cleaned
      .replace(/\s*&\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
