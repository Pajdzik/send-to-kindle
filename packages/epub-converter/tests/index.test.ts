import { describe, expect, it } from 'vitest';
import { type EpubOptions, convertToEpub } from '../src/index.js';

describe('EPUB Converter', () => {
  it('should convert HTML to EPUB format', async () => {
    const htmlContent =
      '<p>This is a test article with <strong>bold text</strong> and <em>italic text</em>.</p>';
    const options: EpubOptions = {
      title: 'Test Article',
      author: 'Test Author',
      language: 'en',
      description: 'A test article for EPUB conversion',
    };

    const result = await convertToEpub(htmlContent, options);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle minimal options', async () => {
    const htmlContent = '<p>Minimal test content.</p>';
    const options: EpubOptions = {
      title: 'Minimal Test',
    };

    const result = await convertToEpub(htmlContent, options);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle empty HTML content', async () => {
    const htmlContent = '';
    const options: EpubOptions = {
      title: 'Empty Content Test',
    };

    const result = await convertToEpub(htmlContent, options);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle special characters in title and author', async () => {
    const htmlContent =
      '<p>Content with special characters: &amp; &lt; &gt; &quot;</p>';
    const options: EpubOptions = {
      title: 'Title with "quotes" & <brackets>',
      author: 'Author with "special" characters',
    };

    const result = await convertToEpub(htmlContent, options);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });
});