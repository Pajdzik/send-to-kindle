import { type CreateEmailOptions, Resend } from 'resend';

export class EmailSendError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'EmailSendError';
  }
}

export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailSender {
  send: (message: EmailMessage) => Promise<void>;
}

export const makeEmailSender = (
  sendFn: (message: EmailMessage) => Promise<void>,
): EmailSender => ({
  send: async (message: EmailMessage) => {
    try {
      await sendFn(message);
    } catch (error) {
      throw new EmailSendError(
        `Failed to send email: ${error}`,
        error instanceof Error ? error : undefined,
      );
    }
  },
});

export const createEmailSender = (apiKey: string): EmailSender => {
  const resend = new Resend(apiKey);

  const sendFn = async (message: EmailMessage) => {
    const emailData: CreateEmailOptions = {
      from: message.from,
      to: message.to,
      subject: message.subject,
      ...(message.html
        ? { html: message.html }
        : { text: message.text || '' }),
    };

    if (message.attachments) {
      emailData.attachments = message.attachments.map((att) => ({
        filename: att.filename,
        content:
          att.content instanceof Buffer
            ? att.content
            : Buffer.from(att.content),
        type: att.contentType,
      }));
    }

    const { error } = await resend.emails.send(emailData);
    if (error) {
      throw new EmailSendError(`Resend API error: ${error.message}`);
    }
  };

  return makeEmailSender(sendFn);
};