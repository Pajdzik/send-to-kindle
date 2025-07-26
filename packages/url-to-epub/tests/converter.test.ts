import { Effect } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import { convertUrlToEpub } from '../src/converter.js';
import type { ConversionOptions } from '../src/converter.js';

// Mock the dependencies
vi.mock('article-fetcher', () => ({
  fetchAndExtractArticle: vi.fn(),
}));

vi.mock('epub-converter', () => ({
  convertToEpub: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
}));

describe('URL to EPUB Converter', () => {
  it('should have convertUrlToEpub function', () => {
    expect(convertUrlToEpub).toBeDefined();
    expect(typeof convertUrlToEpub).toBe('function');
  });

  it('should return an Effect when called with valid options', () => {
    const options: ConversionOptions = {
      url: 'https://example.com/article',
      outputPath: '/tmp/test.epub',
    };

    const result = convertUrlToEpub(options);
    expect(Effect.isEffect(result)).toBe(true);
  });

  it('should accept all required and optional parameters', () => {
    const options: ConversionOptions = {
      url: 'https://example.com/article',
      outputPath: '/tmp/test.epub',
      title: 'Test Title',
      author: 'Test Author',
      language: 'en',
      debug: true,
    };

    const result = convertUrlToEpub(options);
    expect(Effect.isEffect(result)).toBe(true);
  });
});
