import { describe, expect, it, vi } from 'vitest';
import {
  type EmailMessage,
  createEmailSender,
  makeEmailSender,
} from '../src/sender.js';

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ error: null }),
    },
  })),
}));

describe('EmailSender', () => {
  it('should send email successfully with mock function', async () => {
    const mockSendFn = async (message: EmailMessage) => {
      expect(message.to).toBe('test@example.com');
      expect(message.subject).toBe('Test Subject');
    };

    const sender = makeEmailSender(mockSendFn);
    const message: EmailMessage = {
      from: 'sender@example.com',
      to: 'test@example.com',
      subject: 'Test Subject',
      text: 'Test body',
    };

    await sender.send(message);
  });

  it('should handle send errors', async () => {
    const mockSendFn = async () => {
      throw new Error('Send failed');
    };

    const sender = makeEmailSender(mockSendFn);
    const message: EmailMessage = {
      from: 'sender@example.com',
      to: 'test@example.com',
      subject: 'Test Subject',
      text: 'Test body',
    };

    await expect(sender.send(message)).rejects.toThrow(
      'Failed to send email: Error: Send failed',
    );
  });

  it('should send email with Resend integration', async () => {
    const message: EmailMessage = {
      from: 'sender@example.com',
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test body</p>',
      attachments: [
        {
          filename: 'test.txt',
          content: 'test content',
          contentType: 'text/plain',
        },
      ],
    };

    const sender = createEmailSender('test-api-key');
    await expect(sender.send(message)).resolves.toBeUndefined();
  });
});