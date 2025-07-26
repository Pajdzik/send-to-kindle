import { describe, expect, it } from 'vitest';
import worker from '../src/index.js';

describe('Cloudflare Worker', () => {
  const mockEnv = {
    RESEND_API_KEY: 'test-key',
  };

  it('should reject non-POST requests', async () => {
    const request = new Request('https://example.com', { method: 'GET' });
    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(405);
    expect(await response.text()).toBe('Method not allowed');
  });

  it('should validate required fields', async () => {
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await worker.fetch(request, mockEnv);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Missing required fields: url, kindleEmail');
  });

  it('should validate URL format', async () => {
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'invalid-url',
        kindleEmail: 'test@example.com',
      }),
    });

    const response = await worker.fetch(request, mockEnv);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid URL format');
  });

  it('should validate email format', async () => {
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com/article',
        kindleEmail: 'invalid-email',
      }),
    });

    const response = await worker.fetch(request, mockEnv);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid email format');
  });
});
