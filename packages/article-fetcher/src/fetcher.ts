import { JSDOM } from 'jsdom';
import { Effect, pipe, Option, Array as EffectArray } from 'effect';

export interface ArticleContent {
  readonly title: string;
  readonly content: string;
  readonly author?: string;
  readonly publishedDate?: string;
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
const MIN_LIST_ITEM_LENGTH = 10;

type DOMDocument = Document;
type DOMElement = Element;

interface ExtractedMetadata {
  readonly author: Option.Option<string>;
  readonly publishedDate: Option.Option<string>;
}

const validateHtml = (html: string): Effect.Effect<string, Error> =>
  Effect.gen(function* () {
    if (typeof html !== 'string') {
      yield* Effect.fail(new Error('Invalid HTML input: must be a string'));
    }
    return html;
  });

const createDocument = (html: string): Effect.Effect<DOMDocument, Error> =>
  Effect.try(() => new JSDOM(html).window.document);

const extractContent = (html: string): Effect.Effect<ArticleContent, Error> =>
  pipe(
    validateHtml(html),
    Effect.flatMap((validHtml) => {
      if (!validHtml.trim()) {
        return Effect.succeed({
          title: '',
          content: '',
          author: undefined,
          publishedDate: undefined,
        });
      }
      return pipe(
        createDocument(validHtml),
        Effect.flatMap((document) =>
          Effect.all({
            title: extractTitle(document),
            metadata: extractMetadata(document),
            content: extractMainContent(document),
          }),
        ),
        Effect.map(({ title, metadata, content }) => ({
          title,
          content,
          author: Option.getOrUndefined(metadata.author),
          publishedDate: Option.getOrUndefined(metadata.publishedDate),
        })),
      );
    }),
  );

const extractTitle = (document: DOMDocument): Effect.Effect<string, never> =>
  pipe(
    Option.fromNullable(document.querySelector('title')),
    Option.map((element) => element.textContent?.trim() || ''),
    Option.filter((text) => text.length > 0),
    Option.orElse(() =>
      pipe(
        Option.fromNullable(document.querySelector('h1')),
        Option.map((element) => element.textContent?.trim() || ''),
        Option.filter((text) => text.length > 0),
      ),
    ),
    Option.getOrElse(() => ''),
    cleanText,
    Effect.succeed,
  );

const extractMetadata = (
  document: DOMDocument,
): Effect.Effect<ExtractedMetadata, never> =>
  Effect.all({
    author: extractMetaContent(document, AUTHOR_SELECTORS),
    publishedDate: extractMetaContent(document, DATE_SELECTORS),
  });

const extractMetaContent = (
  document: DOMDocument,
  selectors: readonly string[],
): Effect.Effect<Option.Option<string>, never> =>
  pipe(
    EffectArray.fromIterable(selectors),
    EffectArray.map((selector: string) =>
      pipe(
        Option.fromNullable(document.querySelector(selector)),
        Option.flatMap((element) =>
          Option.fromNullable(element.getAttribute('content')),
        ),
        Option.map((content: string) => content.trim()),
        Option.filter((content: string) => content.length > 0),
      ),
    ),
    EffectArray.findFirst(Option.isSome),
    Option.flatten,
    Effect.succeed,
  );

const extractMainContent = (
  document: DOMDocument,
): Effect.Effect<string, never> =>
  pipe(
    removeUnwantedElements(document),
    Effect.flatMap(() => findContentBySelectors(document, CONTENT_SELECTORS)),
    Effect.flatMap((contentOpt) =>
      Option.isSome(contentOpt)
        ? Effect.succeed(contentOpt.value)
        : extractContentFallback(document),
    ),
  );

const findContentBySelectors = (
  document: DOMDocument,
  selectors: readonly string[],
): Effect.Effect<Option.Option<string>, never> =>
  pipe(
    EffectArray.fromIterable(selectors),
    EffectArray.map((selector: string) =>
      pipe(
        Option.fromNullable(document.querySelector(selector)),
        Option.map(extractTextFromElement),
      ),
    ),
    EffectArray.findFirst(Option.isSome),
    Option.flatten,
    Effect.succeed,
  );

const extractContentFallback = (
  document: DOMDocument,
): Effect.Effect<string, never> =>
  pipe(
    Effect.all({
      paragraphs: extractElementsText(document, 'p', MIN_PARAGRAPH_LENGTH),
      headings: extractElementsText(document, 'h1, h2, h3, h4, h5, h6', 0),
    }),
    Effect.map(({ paragraphs, headings }) => {
      const allContent = [...headings, ...paragraphs];
      return allContent.length > 0
        ? allContent.join(' ')
        : extractAllTextFromElement(document.body);
    }),
  );

const extractElementsText = (
  document: DOMDocument,
  selector: string,
  minLength: number,
): Effect.Effect<ReadonlyArray<string>, never> =>
  pipe(
    EffectArray.fromIterable(document.querySelectorAll(selector)),
    EffectArray.map((element: Element) => element.textContent?.trim() || ''),
    EffectArray.map(cleanContentText),
    EffectArray.filter((text: string) => text.length > minLength),
    Effect.succeed,
  );

const removeUnwantedElements = (
  document: DOMDocument,
): Effect.Effect<void, never> =>
  pipe(
    Effect.all([
      removeElementsBySelectors(document, UNWANTED_SELECTORS),
      removeElementsByClasses(document, UNWANTED_CLASSES),
    ]),
    Effect.map(() => void 0),
  );

const removeElementsBySelectors = (
  document: DOMDocument,
  selectors: readonly string[],
): Effect.Effect<void, never> =>
  pipe(
    EffectArray.fromIterable(selectors),
    EffectArray.map((selector: string) =>
      pipe(
        EffectArray.fromIterable(document.querySelectorAll(selector)),
        EffectArray.map((element: Element) => element.remove()),
      ),
    ),
    Effect.succeed,
    Effect.map(() => void 0),
  );

const removeElementsByClasses = (
  document: DOMDocument,
  classes: readonly string[],
): Effect.Effect<void, never> =>
  pipe(
    EffectArray.fromIterable(classes),
    EffectArray.map((className: string) =>
      pipe(
        EffectArray.fromIterable(document.querySelectorAll(`.${className}`)),
        EffectArray.map((element: Element) => element.remove()),
      ),
    ),
    Effect.succeed,
    Effect.map(() => void 0),
  );

const extractTextFromElement = (element: DOMElement): string => {
  const paragraphs = pipe(
    EffectArray.fromIterable(element.querySelectorAll('p')),
    EffectArray.map((p: Element) => p.textContent?.trim() || ''),
    EffectArray.map(cleanContentText),
    EffectArray.filter((text: string) => text.length > MIN_LIST_ITEM_LENGTH),
  );

  const headings = pipe(
    EffectArray.fromIterable(
      element.querySelectorAll('h1, h2, h3, h4, h5, h6'),
    ),
    EffectArray.map((h: Element) => h.textContent?.trim() || ''),
    EffectArray.map(cleanContentText),
    EffectArray.filter((text: string) => text.length > 0),
  );

  const lists = pipe(
    EffectArray.fromIterable(element.querySelectorAll('li')),
    EffectArray.map((li: Element) => li.textContent?.trim() || ''),
    EffectArray.map(cleanContentText),
    EffectArray.filter((text: string) => text.length > MIN_LIST_ITEM_LENGTH),
  );

  const allContent = [...headings, ...paragraphs, ...lists];

  return allContent.length > 0
    ? allContent.join(' ')
    : cleanContentText(element.textContent?.trim() || '');
};

const extractAllTextFromElement = (element: DOMElement | null): string =>
  pipe(
    Option.fromNullable(element),
    Option.map((el) => el.textContent?.trim() || ''),
    Option.map(cleanContentText),
    Option.getOrElse(() => ''),
  );

const cleanText = (text: string): string => {
  const tempElement = new JSDOM('<div></div>').window.document.createElement(
    'div',
  );
  tempElement.innerHTML = text;
  const decoded = tempElement.textContent || tempElement.innerText || '';
  return decoded.replace(/\s+/g, ' ').trim();
};

const cleanContentText = (text: string): string =>
  pipe(cleanText(text), (cleaned) =>
    cleaned
      .replace(/\s*&\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

export const fetchArticle = async (url: string): Promise<string> => {
  const result = await Effect.runPromise(
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch article: ${response.status} ${response.statusText}`);
        }
        return response.text();
      },
      catch: (error) => new Error(`Network error: ${error instanceof Error ? error.message : String(error)}`),
    })
  );
  return result;
};

export const extractArticleContent = async (html: string): Promise<ArticleContent> => {
  return Effect.runPromise(extractContent(html));
};

export const extractArticleContentSync = (html: string): ArticleContent => {
  return Effect.runSync(extractContent(html));
};

export const fetchAndExtractArticle = async (url: string): Promise<ArticleContent> => {
  const html = await fetchArticle(url);
  return extractArticleContent(html);
};

export const extractArticleContentEffect = (
  html: string,
): Effect.Effect<ArticleContent, Error> => extractContent(html);
