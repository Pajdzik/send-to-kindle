import { describe, it, expect } from 'vitest';
import { fetchArticle, extractArticleContent, extractArticleContentSync } from '../src/fetcher.js';

describe('Article Fetcher Functions', () => {
  it('should handle network errors when fetching', async () => {
    await expect(fetchArticle('https://non-existent-domain-12345.com')).rejects.toThrow();
  }, { timeout: 10000 });

  describe('extractContent', () => {
    it('should extract basic title and content', async () => {
      const html = `
        <html>
          <head><title>Test Article</title></head>
          <body>
            <article>
              <h1>Main Title</h1>
              <p>This is the main content of the article.</p>
              <p>This is another paragraph with more content.</p>
            </article>
          </body>
        </html>
      `;

      const result = await extractArticleContent(html);
      expect(result.title).toBe('Test Article');
      expect(result.content).toContain('This is the main content');
      expect(result.content).toContain('This is another paragraph');
    });

    it('should extract metadata from meta tags', async () => {
      const html = `
        <html>
          <head>
            <title>Test Article</title>
            <meta name="author" content="John Doe">
            <meta property="article:published_time" content="2024-01-01">
          </head>
          <body>
            <article>
              <p>Article content</p>
            </article>
          </body>
        </html>
      `;

      const result = await extractArticleContent(html);
      expect(result.author).toBe('John Doe');
      expect(result.publishedDate).toBe('2024-01-01');
    });

    it('should remove unwanted elements', async () => {
      const html = `
        <html>
          <head><title>Test Article</title></head>
          <body>
            <nav>Navigation content</nav>
            <article>
              <p>Main article content</p>
            </article>
            <aside class="sidebar">Sidebar content</aside>
            <footer>Footer content</footer>
            <script>console.log("script");</script>
          </body>
        </html>
      `;

      const result = await extractArticleContent(html);
      expect(result.content).toContain('Main article content');
      expect(result.content).not.toContain('Navigation content');
      expect(result.content).not.toContain('Sidebar content');
      expect(result.content).not.toContain('Footer content');
      expect(result.content).not.toContain('console.log');
    });

    it('should handle articles without explicit article tags', async () => {
      const html = `
        <html>
          <head><title>Test Article</title></head>
          <body>
            <div class="content">
              <h1>Article Title</h1>
              <p>First paragraph of content.</p>
              <p>Second paragraph of content.</p>
            </div>
          </body>
        </html>
      `;

      const result = await extractArticleContent(html);
      expect(result.content).toContain('First paragraph of content');
      expect(result.content).toContain('Second paragraph of content');
    });

    it('should fallback to paragraph extraction when no content sections found', async () => {
      const html = `
        <html>
          <head><title>Test Article</title></head>
          <body>
            <div>
              <p>This is a paragraph with substantial content that should be extracted.</p>
              <p>Another paragraph with meaningful content for the reader.</p>
            </div>
          </body>
        </html>
      `;

      const result = await extractArticleContent(html);
      expect(result.content).toContain('substantial content');
      expect(result.content).toContain('meaningful content');
    });

    it('should handle empty or malformed HTML', async () => {
      const html = '';
      const result = await extractArticleContent(html);
      expect(result.title).toBe('');
      expect(result.content).toBe('');
      expect(result.author).toBeUndefined();
      expect(result.publishedDate).toBeUndefined();
    });

    it('should clean HTML entities and extra whitespace', async () => {
      const html = `
        <html>
          <head><title>Test &amp; Article</title></head>
          <body>
            <article>
              <p>Content with &nbsp; entities &amp; extra    spaces.</p>
            </article>
          </body>
        </html>
      `;

      const result = await extractArticleContent(html);
      expect(result.title).toBe('Test & Article');
      expect(result.content).toContain('<p>Content with');
    });

    it('should prefer h1 title when title tag is missing', async () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>Main Article Heading</h1>
              <p>Article content</p>
            </article>
          </body>
        </html>
      `;

      const result = await extractArticleContent(html);
      expect(result.title).toBe('Main Article Heading');
    });
  });
});
