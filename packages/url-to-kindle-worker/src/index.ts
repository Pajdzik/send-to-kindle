import { fetchAndExtractArticle, type ArticleContent } from 'article-fetcher';
import { ConfigProvider, Effect } from 'effect';
import { type EmailMessage, EmailSender, EmailSenderLive } from 'email-sender';
import { convertToEpub } from 'epub-converter';

interface KindleRequest {
  url: string;
  kindleEmail: string;
  fromEmail?: string;
  subject?: string;
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const hasProperty = (obj: Record<string, unknown>, key: string): boolean => {
  return key in obj;
};

const isKindleRequest = (obj: unknown): obj is KindleRequest => {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const record = obj as Record<string, unknown>;
  
  return (
    hasProperty(record, 'url') &&
    hasProperty(record, 'kindleEmail') &&
    typeof record.url === 'string' &&
    typeof record.kindleEmail === 'string' &&
    (typeof record.fromEmail === 'string' || record.fromEmail === undefined) &&
    (typeof record.subject === 'string' || record.subject === undefined)
  );
};

const validateKindleRequest = (obj: unknown): KindleRequest => {
  if (typeof obj !== 'object' || obj === null) {
    throw new ValidationError('Invalid request format');
  }

  const record = obj as Record<string, unknown>;
  
  // Check for required fields first
  if (!hasProperty(record, 'url') || !hasProperty(record, 'kindleEmail')) {
    throw new ValidationError('Missing required fields: url, kindleEmail');
  }

  if (!isKindleRequest(obj)) {
    throw new ValidationError('Invalid request format');
  }

  // Validate URL format
  try {
    new URL(obj.url);
  } catch {
    throw new ValidationError('Invalid URL format');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(obj.kindleEmail)) {
    throw new ValidationError('Invalid email format');
  }

  return obj;
};

const processUrlToKindle = (request: KindleRequest) =>
  Effect.gen(function* () {
    // Extract article content from URL
    const article: ArticleContent = yield* Effect.promise(() =>
      fetchAndExtractArticle(request.url),
    );

    // Convert to EPUB
    const epubBuffer = yield* convertToEpub(article.content, {
      title: article.title || 'Untitled Article',
      author: article.author,
      language: 'en',
    });

    // Send via email
    const emailSender = yield* EmailSender;
    const emailMessage: EmailMessage = {
      from: request.fromEmail || 'noreply@example.com',
      to: request.kindleEmail,
      subject: request.subject || `Kindle: ${article.title}`,
      text: `Please find attached the article: ${article.title}`,
      attachments: [
        {
          filename: `${article.title || 'article'}.epub`,
          content: new Uint8Array(epubBuffer),
          contentType: 'application/epub+zip',
        },
      ],
    };

    yield* emailSender.send(emailMessage);

    return {
      success: true,
      title: article.title,
      author: article.author,
    };
  });

const createConfigProvider = (env: { RESEND_API_KEY: string }) =>
  ConfigProvider.fromMap(
    new Map([['RESEND_API_KEY', env.RESEND_API_KEY || '']]),
  );

export default {
  async fetch(
    request: Request,
    env: { RESEND_API_KEY: string },
  ): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const rawBody = await request.json();
      const body = validateKindleRequest(rawBody);

      const configProvider = createConfigProvider(env);
      const program = processUrlToKindle(body).pipe(
        Effect.provide(EmailSenderLive),
        Effect.withConfigProvider(configProvider),
      );

      const result = await Effect.runPromise(program);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Worker error:', error);

      // Handle validation errors with 400 status
      if (error instanceof ValidationError) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  },
};

export type { KindleRequest };
