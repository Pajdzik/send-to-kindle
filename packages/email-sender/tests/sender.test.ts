import { describe, it, expect } from 'vitest';
import { Effect } from 'effect';
import { EmailSender, makeEmailSender, type EmailMessage } from '../src/sender.js';

describe('EmailSender', () => {
  it('should send email successfully', async () => {
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
});