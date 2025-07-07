import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractArticleContent } from '../src/fetcher.js';

describe('Jepsen Serializable Article Test', () => {

  it('should extract content from complete jepsen.io serializable consistency article', () => {
    const html = readFileSync(
      join(__dirname, 'test-articles', 'jepsen.html'),
      'utf-8',
    );

    const result = extractArticleContent(html);

    // Test basic metadata extraction
    expect(result.title).toBe('Serializability');

    // Test core concept extraction
    expect(result.content).toContain(
      'serializability means that transactions appear to have occurred in',
    );
    expect(result.content).toContain('multi-object property');
    expect(result.content).toContain('atomically');

    // Test content is extracted (basic checks)
    expect(result.content).toContain('ANSI SQL 1999 spec');
    expect(result.content).toContain('repeatable read');
    expect(result.content).toContain('snapshot isolation');
    expect(result.content).toContain('network partition');

    // Verify unwanted content is removed
    expect(result.content).not.toContain('JEPSEN');
    expect(result.content).not.toContain('Blog');
    expect(result.content).not.toContain('Analyses');
    expect(result.content).not.toContain('Copyright');
    expect(result.content).not.toContain('GoogleAnalyticsObject');
    expect(result.content).not.toContain('gtag');
  });
});
