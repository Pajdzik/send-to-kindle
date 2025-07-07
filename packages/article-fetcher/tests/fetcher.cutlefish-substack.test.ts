import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractArticleContent } from '../src/fetcher.js';

describe('Cutlefish Substack Article Test', () => {

  it('should extract content from TBM 293 Substack article', () => {
    const html = readFileSync(
      join(__dirname, 'test-articles', 'cutlefish-substack.html'),
      'utf-8',
    );

    const result = extractArticleContent(html);

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
    expect(result.content).toContain('product teams');
    expect(result.content).toContain('effective');
    expect(result.content).toContain('TBM 293');

    // Verify unwanted Substack UI elements are removed
    expect(result.content).not.toContain('Subscribe');
    expect(result.content).not.toContain('Sign in');
    expect(result.content).not.toContain('Share this post');
    expect(result.content).not.toContain('The Beautiful Mess');
    expect(result.content).not.toContain('navbar');
    expect(result.content).not.toContain('modal');
    expect(result.content).not.toContain('buttonBase');
    expect(result.content).not.toContain('pencraft');
  });
});
