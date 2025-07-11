import { describe, it, expect, vi } from 'vitest';
import { Effect, Config, ConfigProvider } from 'effect';
import { EmailSender, EmailSenderLive, makeEmailSender, type EmailMessage } from '../src/sender.js';

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

    const result = await Effect.runPromise(sender.send(message));
    expect(result).toBeUndefined();
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

    await expect(Effect.runPromise(sender.send(message))).rejects.toThrow(
      'Failed to send email: Error: Send failed'
    );
  });

  it('should send email with Resend integration', async () => {
    const message: EmailMessage = {
      from: 'sender@example.com',
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test body</p>',
      attachments: [{
        filename: 'test.txt',
        content: 'test content',
        contentType: 'text/plain',
      }],
    };

    const configProvider = ConfigProvider.fromMap(new Map([
      ['RESEND_API_KEY', 'test-api-key'],
    ]));

    const program = Effect.gen(function* () {
      const sender = yield* EmailSender;
      yield* sender.send(message);
    }).pipe(
      Effect.provide(EmailSenderLive),
      Effect.withConfigProvider(configProvider)
    );

    await expect(Effect.runPromise(program)).resolves.toBeUndefined();
  });
});