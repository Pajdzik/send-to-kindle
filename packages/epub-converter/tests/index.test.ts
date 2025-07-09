import { describe, it, expect } from 'vitest';
import { convertToEpub } from '../src/index.js';
import { Effect } from 'effect';

describe('EPUB Converter', () => {
  it('should return placeholder message', async () => {
    const result = await Effect.runPromise(convertToEpub);
    expect(result).toBe('EPUB conversion not implemented yet');
  });
});