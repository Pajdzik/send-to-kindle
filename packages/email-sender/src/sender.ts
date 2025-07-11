import { Effect, Context, Layer, Config } from 'effect';
import { Resend, type CreateEmailOptions } from 'resend';

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
  send: (message: EmailMessage) => Effect.Effect<void, Error>;
}

export const EmailSender = Context.GenericTag<EmailSender>('@email-sender/EmailSender');

export const makeEmailSender = (sendFn: (message: EmailMessage) => Promise<void>): EmailSender => ({
  send: (message: EmailMessage) =>
    Effect.tryPromise({
      try: () => sendFn(message),
      catch: (error) => new Error(`Failed to send email: ${error}`),
    }),
});

export const EmailSenderLive = Layer.effect(
  EmailSender,
  Effect.gen(function* () {
    const apiKey = yield* Config.string('RESEND_API_KEY');
    const resend = new Resend(apiKey);
    
    const sendFn = async (message: EmailMessage) => {
      const emailData: CreateEmailOptions = {
        from: message.from,
        to: message.to,
        subject: message.subject,
        ...(message.html ? { html: message.html } : { text: message.text || '' }),
      };

      if (message.attachments) {
        emailData.attachments = message.attachments.map(att => ({
          filename: att.filename,
          content: att.content instanceof Buffer ? att.content : Buffer.from(att.content),
          type: att.contentType,
        }));
      }

      const { error } = await resend.emails.send(emailData);
      if (error) {
        throw new Error(`Resend API error: ${error.message}`);
      }
    };
    
    return makeEmailSender(sendFn);
  })
);