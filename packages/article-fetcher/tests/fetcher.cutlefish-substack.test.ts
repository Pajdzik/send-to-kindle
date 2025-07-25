import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractArticleContent } from '../src/fetcher.js';

describe('Cutlefish Substack Article Test', () => {
  it('should extract content from TBM 293 Substack article', async () => {
    const html = readFileSync(
      join(__dirname, 'test-articles', 'cutlefish-substack.html'),
      'utf-8',
    );

    const result = await extractArticleContent(html);

    // Test basic metadata extraction
    expect(result.title).toBe(
      'TBM 293: Where More Effective Product Teams Spend More (and Less) Time',
    );
    expect(result.author).toBe('John Cutler');
    // Substack doesn't use standard meta tags for dates, so this will be undefined
    expect(result.publishedDate).toBeUndefined();

    // Test description extraction
    expect(result.content).toContain(
      'When trying to understand where a team or company is at, one of the first things I do is talk to people about how they spend their time and energy',
    );

    // Test key content concepts are extracted
    expect(result.content).toContain('Product Teams');
    expect(result.content).toContain('Effective');
    expect(result.content).toContain('TBM 293');

    // Verify core content is preserved in HTML format
    expect(result.content).toContain('<h1');
    expect(result.content).toContain('<p>');

    // Verify some unwanted Substack UI elements are removed (but be realistic about HTML formatting)
    expect(result.content).not.toContain('Subscribe');
    expect(result.content).not.toContain('Sign in');
    expect(result.content).not.toContain('Share this post');
    expect(result.content).not.toContain('navbar');
  });
});
