import { JSDOM } from 'jsdom';

export interface ArticleContent {
  title: string;
  content: string;
  author?: string;
  publishedDate?: string;
}

export class ArticleFetcher {
  async fetchArticle(_url: string): Promise<string> {
    // TODO: Implement article fetching logic
    throw new Error('Not implemented');
  }

  extractContent(html: string): ArticleContent {
    const title = this.extractTitle(html);
    const metadata = this.extractMetadata(html);
    const content = this.extractMainContent(html);
    
    return {
      title,
      content,
      author: metadata.author,
      publishedDate: metadata.publishedDate
    };
  }

  private extractTitle(html: string): string {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
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

  private extractMetadata(html: string): { author?: string; publishedDate?: string } {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const author = this.extractMetaContent(document, [
      'meta[name="author"]',
      'meta[property="article:author"]',
      'meta[name="twitter:creator"]'
    ]);
    
    const publishedDate = this.extractMetaContent(document, [
      'meta[property="article:published_time"]',
      'meta[name="date"]',
      'meta[property="article:published"]',
      'meta[name="pubdate"]'
    ]);
    
    return { author, publishedDate };
  }

  private extractMetaContent(document: Document, selectors: string[]): string | undefined {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.getAttribute('content') || undefined;
      }
    }
    return undefined;
  }

  private extractMainContent(html: string): string {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Remove unwanted elements
    const unwantedSelectors = [
      'script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe', 'object', 'embed'
    ];
    for (const selector of unwantedSelectors) {
      for (const el of document.querySelectorAll(selector)) {
        el.remove();
      }
    }
    
    // Remove elements with unwanted classes
    const unwantedClasses = [
      'sidebar', 'navigation', 'menu', 'advertisement', 'ads', 'social', 'comments',
      'related', 'recommended', 'popup', 'modal'
    ];
    for (const className of unwantedClasses) {
      for (const el of document.querySelectorAll(`.${className}`)) {
        el.remove();
      }
    }
    
    // Find content sections
    const contentSelectors = [
      'article', 'main', '[role="main"]', '.post', '.entry', '.content', '.article', '.story'
    ];
    
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return this.extractTextFromElement(element);
      }
    }
    
    // Fallback to paragraphs
    const paragraphs = Array.from(document.querySelectorAll('p'))
      .map(p => this.cleanContentText(p.textContent?.trim() || ''))
      .filter(text => text.length > 30);
    
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .map(h => this.cleanContentText(h.textContent?.trim() || ''))
      .filter(text => text.length > 0);
    
    const allContent = [...headings, ...paragraphs];
    
    return allContent.length > 0 ? allContent.join(' ') : this.extractAllTextFromElement(document.body);
  }

  private extractTextFromElement(element: Element): string {
    const paragraphs = Array.from(element.querySelectorAll('p'))
      .map(p => this.cleanContentText(p.textContent?.trim() || ''))
      .filter(text => text.length > 10);
    
    const headings = Array.from(element.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .map(h => this.cleanContentText(h.textContent?.trim() || ''))
      .filter(text => text.length > 0);
    
    const lists = Array.from(element.querySelectorAll('li'))
      .map(li => this.cleanContentText(li.textContent?.trim() || ''))
      .filter(text => text.length > 10);
    
    const allContent = [...headings, ...paragraphs, ...lists];
    
    return allContent.length > 0 ? allContent.join(' ') : this.cleanContentText(element.textContent?.trim() || '');
  }

  private extractAllTextFromElement(element: Element | null): string {
    if (!element) return '';
    return this.cleanContentText(element.textContent?.trim() || '');
  }

  private cleanText(text: string): string {
    // Decode HTML entities using a temporary DOM element
    const tempElement = new JSDOM('<div></div>').window.document.createElement('div');
    tempElement.innerHTML = text;
    const decoded = tempElement.textContent || tempElement.innerText || '';
    
    // Normalize whitespace
    return decoded.replace(/\s+/g, ' ').trim();
  }
  
  private cleanContentText(text: string): string {
    // First clean like normal text
    const cleaned = this.cleanText(text);
    
    // For content, remove ampersands and other symbols that might be problematic
    return cleaned.replace(/\s*&\s*/g, ' ').replace(/\s+/g, ' ').trim();
  }






}