import { Effect, Context, Layer } from 'effect';

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
    const sendFn = (_message: EmailMessage) =>
      Promise.reject(new Error('Email provider not configured'));
    
    return makeEmailSender(sendFn);
  })
);