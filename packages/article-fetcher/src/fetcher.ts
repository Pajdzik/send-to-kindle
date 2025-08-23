import { parseHTML } from 'linkedom';

export interface ArticleContent {
  readonly title: string;
  readonly content: string;
  readonly author?: string;
  readonly publishedDate?: string;
}

export class ArticleFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ArticleFetchError';
  }
}

export class ArticleParseError extends Error {
  constructor(
    message: string,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'ArticleParseError';
  }
}

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

type DOMDocument = Document;
type DOMElement = Element;

interface ExtractedMetadata {
  readonly author?: string;
  readonly publishedDate?: string;
}

const validateHtml = (html: string): string => {
  if (typeof html !== 'string') {
    throw new Error('Invalid HTML input: must be a string');
  }
  return html;
};

const createDocument = (html: string): DOMDocument => {
  try {
    return parseHTML(html).document;
  } catch (error) {
    throw new Error(`Failed to parse HTML: ${error}`);
  }
};

const extractContent = (html: string): ArticleContent => {
  const validHtml = validateHtml(html);
  
  if (!validHtml.trim()) {
    return {
      title: '',
      content: '',
      author: undefined,
      publishedDate: undefined,
    };
  }

  const document = createDocument(validHtml);
  const title = extractTitle(document);
  const metadata = extractMetadata(document);
  const content = extractMainContent(document);

  return {
    title,
    content,
    author: metadata.author,
    publishedDate: metadata.publishedDate,
  };
};

const extractTitle = (document: DOMDocument): string => {
  const titleElement = document.querySelector('title');
  if (titleElement?.textContent?.trim()) {
    return cleanText(titleElement.textContent.trim());
  }

  const h1Element = document.querySelector('h1');
  if (h1Element?.textContent?.trim()) {
    return cleanText(h1Element.textContent.trim());
  }

  return '';
};

const extractMetadata = (document: DOMDocument): ExtractedMetadata => {
  return {
    author: extractMetaContent(document, AUTHOR_SELECTORS),
    publishedDate: extractMetaContent(document, DATE_SELECTORS),
  };
};

const extractMetaContent = (
  document: DOMDocument,
  selectors: readonly string[],
): string | undefined => {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const content = element?.getAttribute('content')?.trim();
    if (content && content.length > 0) {
      return content;
    }
  }
  return undefined;
};

const extractMainContent = (document: DOMDocument): string => {
  removeUnwantedElements(document);
  
  const contentOpt = findContentBySelectors(document, CONTENT_SELECTORS);
  if (contentOpt) {
    return contentOpt;
  }
  
  return extractContentFallback(document);
};

const findTitleH1BeforeContent = (
  document: DOMDocument,
  contentElement: Element,
): string | null => {
  const titleSelectors = [
    'h1.title',
    'h1.entry-title',
    'h1.post-title',
    'h1.article-title',
    'h1[class*="title"]',
  ];

  for (const selector of titleSelectors) {
    const titleElement = document.querySelector(selector);
    if (titleElement) {
      const titlePosition = titleElement.compareDocumentPosition(contentElement);
      if (titlePosition & 4) {
        return titleElement.textContent?.trim() || null;
      }
    }
  }

  return null;
};

const findContentBySelectors = (
  document: DOMDocument,
  selectors: readonly string[],
): string | null => {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const titleH1 = findTitleH1BeforeContent(document, element);
      const contentHtml = preserveFormattingInElement(element);

      if (titleH1) {
        return `<h1>${titleH1}</h1>${contentHtml}`;
      }
      return contentHtml;
    }
  }
  return null;
};

const extractContentFallback = (document: DOMDocument): string => {
  const paragraphs = extractElementsText(document, 'p', MIN_PARAGRAPH_LENGTH);
  const headings = extractElementsText(document, 'h1, h2, h3, h4, h5, h6', 0);
  
  const allContent = [...headings, ...paragraphs];
  return allContent.length > 0
    ? allContent.join(' ')
    : extractAllTextFromElement(document.body);
};

const extractElementsText = (
  document: DOMDocument,
  selector: string,
  minLength: number,
): string[] => {
  const elements = Array.from(document.querySelectorAll(selector));
  return elements
    .map((element) => preserveFormattingInElement(element))
    .filter((text) => text.length > minLength);
};

const removeUnwantedElements = (document: DOMDocument): void => {
  removeElementsBySelectors(document, UNWANTED_SELECTORS);
  removeElementsByClasses(document, UNWANTED_CLASSES);
};

const removeElementsBySelectors = (
  document: DOMDocument,
  selectors: readonly string[],
): void => {
  for (const selector of selectors) {
    const elements = Array.from(document.querySelectorAll(selector));
    for (const element of elements) {
      element.remove();
    }
  }
};

const removeElementsByClasses = (
  document: DOMDocument,
  classes: readonly string[],
): void => {
  for (const className of classes) {
    const elements = Array.from(document.querySelectorAll(`.${className}`));
    for (const element of elements) {
      element.remove();
    }
  }
};

const preserveFormattingInElement = (element: Element): string => {
  const unwantedChildren = element.querySelectorAll(
    `${UNWANTED_SELECTORS.join(', ')}, ${UNWANTED_CLASSES.map((cls) => `.${cls}`).join(', ')}`,
  );
  for (const el of unwantedChildren) {
    el.remove();
  }

  return element.innerHTML.trim();
};

const extractAllTextFromElement = (element: DOMElement | null): string => {
  if (!element) return '';
  return preserveFormattingInElement(element);
};

const cleanText = (text: string): string => {
  const { document } = parseHTML('<div></div>');
  const tempElement = document.createElement('div');
  tempElement.innerHTML = text;
  const decoded = tempElement.textContent || tempElement.innerText || '';
  return decoded.replace(/\s+/g, ' ').trim();
};

export const fetchArticle = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new ArticleFetchError(
        `Failed to fetch article: ${response.status} ${response.statusText}`,
        response.status,
      );
    }
    return response.text();
  } catch (error) {
    if (error instanceof ArticleFetchError) {
      throw error;
    }
    throw new Error(
      `Network error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const extractArticleContent = async (
  html: string,
): Promise<ArticleContent> => {
  return extractContent(html);
};

export const extractArticleContentSync = (html: string): ArticleContent => {
  return extractContent(html);
};

export const fetchAndExtractArticle = async (
  url: string,
): Promise<ArticleContent> => {
  const html = await fetchArticle(url);
  return extractArticleContent(html);
};