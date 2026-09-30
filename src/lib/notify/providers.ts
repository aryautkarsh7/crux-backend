import { env } from '../../config/env.js';

/**
 * Small provider interfaces, so an email or SMS provider can be swapped without touching the
 * booking code. `logged: true` means the provider only wrote to the log (nothing was delivered).
 */
export type SendResult = { id?: string; logged?: boolean };

export type EmailMessage = { to: string; subject: string; text: string };
export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<SendResult>;
}

/**
 * SMS in India must match a DLT-registered template word for word, so a message carries the template
 * it uses and the values for its {#var#} placeholders, in order. `text` is the filled-in message.
 */
export type SmsTemplate = 'booking_request' | 'booking_request_test';
export type SmsMessage = { to: string; template: SmsTemplate; vars: string[]; text: string };
export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<SendResult>;
}

export const notifyLog = (line: string) => {
  if (env.NODE_ENV !== 'test') console.info(`[notify] ${line}`);
};

/** Email through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email). */
export function resendEmail(apiKey: string, from: string): EmailProvider {
  return {
    name: 'resend',
    async send({ to, subject, text }) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, text }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await response.json().catch(() => null)) as { id?: string; message?: string; name?: string } | null;
      if (!response.ok) throw new Error(`Resend ${response.status}: ${body?.message ?? body?.name ?? 'request failed'}`);
      return { id: body?.id };
    },
  };
}

/** Writes the SMS to the log instead of sending it. Used until Doctar's SMS provider is plugged in. */
export const logSms: SmsProvider = {
  name: 'log',
  async send({ to, template, text }) {
    notifyLog(`SMS (log only, template ${template}) to ${to}: ${text}`);
    return { logged: true };
  },
};

/*
 * Plugging in Doctar's SMS provider (see HANDOFF.md, "SMS for booking requests"):
 * 1. Add a provider here, e.g. `export function msg91Sms(): SmsProvider`, that sends `message.to` with the
 *    DLT template id for `message.template` (env.SMS_DLT_TEMPLATE_ID / env.SMS_DLT_TEST_TEMPLATE_ID), the
 *    sender id (env.SMS_SENDER_ID), entity id (env.SMS_DLT_ENTITY_ID) and `message.vars` as the variables.
 * 2. Return it from `smsProvider()` below for its SMS_PROVIDER name.
 * 3. Set SMS_PROVIDER and the SMS_* variables on the server.
 */
function smsProvider(): SmsProvider {
  switch (env.SMS_PROVIDER) {
    case 'log':
      return logSms;
    default:
      notifyLog(`SMS_PROVIDER "${env.SMS_PROVIDER}" isn't implemented yet; SMS is written to the log only.`);
      return logSms;
  }
}

function emailProvider(): EmailProvider | null {
  return env.RESEND_API_KEY ? resendEmail(env.RESEND_API_KEY, env.NOTIFY_EMAIL_FROM) : null;
}

let overrides: { email?: EmailProvider | null; sms?: SmsProvider } = {};

/** Tests swap in fake providers here; call with {} to go back to the configured ones. */
export function setProviders(next: { email?: EmailProvider | null; sms?: SmsProvider }) {
  overrides = next;
}

export const providers = () => ({
  email: 'email' in overrides ? overrides.email ?? null : emailProvider(),
  sms: overrides.sms ?? smsProvider(),
});
