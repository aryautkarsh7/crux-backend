/**
 * Rules for which phone numbers and emails are real enough to notify. Shared by the Doctar import
 * (what gets stored) and the notifier (what gets used), so both agree.
 */

/** Numbers Doctar fills in when it has none, and classic dummy numbers. */
const PLACEHOLDER_PHONES = new Set([
  '8877772277',
  '9876543210',
  '1234567890',
  '9999999999',
  '9000000000',
]);

/** A 10-digit Indian mobile that can receive an SMS, or '' (landlines, placeholders and junk are dropped). */
export function mobileOf(raw: unknown): string {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) return '';
  if (PLACEHOLDER_PHONES.has(digits) || /^(\d)\1{9}$/.test(digits)) return '';
  return digits;
}

/** Any usable phone (mobile or landline with STD code), digits only, or ''. For calling, not SMS. */
export function phoneOf(raw: unknown): string {
  const mobile = mobileOf(raw);
  if (mobile) return mobile;
  const digits = String(raw ?? '')
    .replace(/\D/g, '')
    .replace(/^91(?=\d{10}$)/, '');
  if (digits.length < 10 || digits.length > 12 || /^(\d)\1+$/.test(digits)) return '';
  return PLACEHOLDER_PHONES.has(digits.slice(-10)) ? '' : digits;
}

const DUMMY_DOMAINS =
  /(^|\.)(example\.(com|org|net)|test\.com|mailinator\.com|yopmail\.com|tempmail\.[a-z]+|guerrillamail\.[a-z]+|sharklasers\.com|trashmail\.[a-z]+|fake\.com|none\.com)$/;
const DUMMY_LOCALS =
  /^(test|testing|demo|dummy|sample|fake|na|n\.a|none|null|nil|noreply|no-reply|donotreply|abc|xyz|asdf|qwerty|user|email|mail)\d*$/;
const RESERVED_TLDS = /\.(local|localhost|test|invalid|example)$/;

/** A plausible, non-dummy email address (lower-cased), or ''. */
export function emailOf(raw: unknown): string {
  const email = String(raw ?? '')
    .trim()
    .toLowerCase();
  const m = /^([a-z0-9._%+-]{1,64})@([a-z0-9-]+(\.[a-z0-9-]+)+)$/.exec(email);
  if (!m) return '';
  const [, local, domain] = m;
  if (DUMMY_LOCALS.test(local!) || DUMMY_DOMAINS.test(domain!) || RESERVED_TLDS.test(domain!))
    return '';
  return email;
}

/** "98••••3210", for logs and admin summaries where the full number isn't needed. */
export const maskPhone = (p: string) => (p.length >= 6 ? `${p.slice(0, 2)}••••${p.slice(-4)}` : p);
