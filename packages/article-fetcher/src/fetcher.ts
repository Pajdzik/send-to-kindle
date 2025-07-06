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
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
    if (titleMatch) {
      return this.cleanText(titleMatch[1]);
    }
    
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
    if (h1Match) {
      return this.cleanText(h1Match[1]);
    }
    
    return '';
  }

  private extractMetadata(html: string): { author?: string; publishedDate?: string } {
    const author = this.extractMetaContent(html, [
      'meta[name="author"]',
      'meta[property="article:author"]',
      'meta[name="twitter:creator"]'
    ]);
    
    const publishedDate = this.extractMetaContent(html, [
      'meta[property="article:published_time"]',
      'meta[name="date"]',
      'meta[property="article:published"]',
      'meta[name="pubdate"]'
    ]);
    
    return { author, publishedDate };
  }

  private extractMetaContent(html: string, selectors: string[]): string | undefined {
    for (const selector of selectors) {
      const attrName = selector.includes('name=') ? 'name' : 'property';
      const attrValue = selector.match(/="([^"]+)"/)?.[1];
      if (!attrValue) continue;
      
      const regex = new RegExp(`<meta\\s+${attrName}="${attrValue}"[^>]*content="([^"]*)"`, 'i');
      const match = html.match(regex);
      if (match) {
        return match[1];
      }
    }
    return undefined;
  }

  private extractMainContent(html: string): string {
    const cleanedHtml = this.removeUnwantedElements(html);
    const contentSections = this.findContentSections(cleanedHtml);
    
    if (contentSections.length === 0) {
      return this.fallbackContentExtraction(cleanedHtml);
    }
    
    const bestSection = this.selectBestContentSection(contentSections);
    return this.extractTextFromSection(bestSection);
  }

  private removeUnwantedElements(html: string): string {
    const unwantedTags = [
      'script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe', 'object', 'embed'
    ];
    
    let cleaned = html;
    
    for (const tag of unwantedTags) {
      const regex = new RegExp(`<${tag}[^>]*>.*?<\/${tag}>`, 'gis');
      cleaned = cleaned.replace(regex, '');
    }
    
    const unwantedClasses = [
      'sidebar', 'navigation', 'menu', 'advertisement', 'ads', 'social', 'comments',
      'related', 'recommended', 'popup', 'modal'
    ];
    
    for (const className of unwantedClasses) {
      const regex = new RegExp(`<[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>.*?</[^>]*>`, 'gis');
      cleaned = cleaned.replace(regex, '');
    }
    
    return cleaned;
  }

  private findContentSections(html: string): string[] {
    const contentSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.post',
      '.entry',
      '.content',
      '.article',
      '.story'
    ];
    
    const sections: string[] = [];
    
    for (const selector of contentSelectors) {
      let selectorRegex: RegExp;
      
      if (selector.startsWith('.')) {
        const className = selector.slice(1);
        selectorRegex = new RegExp(`<[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>(.*?)</[^>]*>`, 'gis');
      } else if (selector.startsWith('[')) {
        const attrMatch = selector.match(/\[([^=]+)="([^"]+)"\]/);
        if (attrMatch) {
          const [, attrName, attrValue] = attrMatch;
          selectorRegex = new RegExp(`<[^>]*${attrName}="${attrValue}"[^>]*>(.*?)</[^>]*>`, 'gis');
        } else {
          continue;
        }
      } else {
        selectorRegex = new RegExp(`<${selector}[^>]*>(.*?)</${selector}>`, 'gis');
      }
      
      const matches = html.match(selectorRegex);
      if (matches) {
        sections.push(...matches.map(match => {
          const innerMatch = match.match(/^<[^>]*>(.*)<\/[^>]*>$/s);
          return innerMatch ? innerMatch[1] : match;
        }));
      }
    }
    
    return sections;
  }

  private fallbackContentExtraction(html: string): string {
    const paragraphs = html.match(/<p[^>]*>(.*?)<\/p>/gis) || [];
    const headings = html.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gis) || [];
    
    const allContent = [...paragraphs, ...headings];
    
    const textContent = allContent
      .map(element => this.cleanText(element))
      .filter(text => text.length > 30)
      .join(' ');
    
    return textContent || this.extractAllText(html);
  }

  private selectBestContentSection(sections: string[]): string {
    return sections
      .map(section => ({
        section,
        score: this.scoreSectionContent(section)
      }))
      .sort((a, b) => b.score - a.score)[0]?.section || sections[0];
  }

  private scoreSectionContent(section: string): number {
    const text = this.cleanText(section);
    let score = 0;
    
    score += text.length * 0.1;
    score += (text.match(/\./g) || []).length * 5;
    score += (text.match(/<p[^>]*>/gi) || []).length * 10;
    score += (text.match(/<h[1-6][^>]*>/gi) || []).length * 5;
    
    const shortSentences = text.split('.').filter(s => s.trim().length < 20).length;
    score -= shortSentences * 2;
    
    return score;
  }

  private extractTextFromSection(section: string): string {
    const paragraphs = section.match(/<p[^>]*>(.*?)<\/p>/gis) || [];
    const headings = section.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gis) || [];
    const lists = section.match(/<li[^>]*>(.*?)<\/li>/gis) || [];
    
    const allElements = [...headings, ...paragraphs, ...lists];
    
    const extractedTexts = allElements
      .map(element => {
        const innerMatch = element.match(/^<[^>]*>(.*)<\/[^>]*>$/s);
        return innerMatch ? innerMatch[1] : element;
      })
      .map(text => this.cleanText(text))
      .filter(text => text.length > 10);
    
    return extractedTexts.length > 0 ? extractedTexts.join(' ') : this.cleanText(section);
  }

  private extractAllText(html: string): string {
    return this.cleanText(html.replace(/<[^>]*>/g, ' '));
  }

  private cleanText(text: string): string {
    return text
      .replace(/<[^>]*>/g, ' ')
      .replace(/&[^;]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}