import { describe, it, expect } from 'vitest';
import { ArticleFetcher } from './fetcher.js';

describe('ArticleFetcher', () => {
  it('should create an instance', () => {
    const fetcher = new ArticleFetcher();
    expect(fetcher).toBeInstanceOf(ArticleFetcher);
  });

  it('should throw not implemented error', async () => {
    const fetcher = new ArticleFetcher();
    await expect(fetcher.fetchArticle('https://example.com')).rejects.toThrow(
      'Not implemented'
    );
  });
});