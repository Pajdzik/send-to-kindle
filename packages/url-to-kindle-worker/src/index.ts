import { Effect, Layer, Runtime, Config } from 'effect';
import { fetchAndExtractArticle, type ArticleContent } from 'article-fetcher';
import { convertToEpub } from 'epub-converter';
import { EmailSender, EmailSenderLive, type EmailMessage } from 'email-sender';

interface KindleRequest {
  url: string;
  kindleEmail: string;
  fromEmail?: string;
  subject?: string;
}

const processUrlToKindle = (request: KindleRequest) =>
  Effect.gen(function* () {
    // Extract article content from URL
    const article: ArticleContent = yield* fetchAndExtractArticle(request.url);
    
    // Convert to EPUB
    const epubBuffer = yield* convertToEpub(article.content, {
      title: article.title || 'Untitled Article',
      author: article.author,
      language: 'en'
    });
    
    // Send via email
    const emailSender = yield* EmailSender;
    const emailMessage: EmailMessage = {
      from: request.fromEmail || 'noreply@example.com',
      to: request.kindleEmail,
      subject: request.subject || `Kindle: ${article.title}`,
      text: `Please find attached the article: ${article.title}`,
      attachments: [{
        filename: `${article.title || 'article'}.epub`,
        content: Buffer.from(epubBuffer),
        contentType: 'application/epub+zip'
      }]
    };
    
    yield* emailSender.send(emailMessage);
    
    return {
      success: true,
      title: article.title,
      author: article.author
    };
  });

const WorkerRuntime = Runtime.defaultRuntime.pipe(
  Runtime.setConfigProvider(
    Config.fromMap(new Map([
      ['RESEND_API_KEY', globalThis.RESEND_API_KEY || '']
    ]))
  )
);

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    
    try {
      const body = await request.json() as KindleRequest;
      
      if (!body.url || !body.kindleEmail) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: url, kindleEmail' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Validate URL format
      try {
        new URL(body.url);
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid URL format' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.kindleEmail)) {
        return new Response(
          JSON.stringify({ error: 'Invalid email format' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      const program = processUrlToKindle(body).pipe(
        Effect.provide(EmailSenderLive)
      );
      
      const result = await Runtime.runPromise(WorkerRuntime)(program);
      
      return new Response(
        JSON.stringify(result),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  },
} satisfies ExportedHandler<{
  RESEND_API_KEY: string;
}>;