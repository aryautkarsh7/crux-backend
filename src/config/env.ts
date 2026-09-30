// Slots, collection windows and 'today' are all Indian time, wherever the server runs.
process.env.TZ = process.env.TZ || 'Asia/Kolkata';

import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().optional(),
  /** Database name for the local development/test MongoDB. */
  MONGODB_DB: z
    .string()
    .regex(/^[a-z0-9_]+$/i)
    .default('curxx'),
  MONGODB_PORT: z.coerce.number().int().min(1).max(65_535).default(27017),
  MONGODB_DATA_PATH: z.string().min(1).default('.data/mongo'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  MSGCENTRAL_CUSTOMER_ID: z.string().optional(),
  MSGCENTRAL_BASE64_KEY: z.string().optional(),
  MSGCENTRAL_EMAIL: z.string().optional(),
  MSGCENTRAL_COUNTRY: z.string().default('IN'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

/**
 * Admin panel login. Checked separately so a typo here disables admin sign-in (with a reason)
 * instead of stopping the whole API from starting.
 */
function adminLogin() {
  const strip = (v?: string) => v?.trim().replace(/^(['"])(.*)\1$/, '$2');
  const email = strip(process.env.ADMIN_EMAIL);
  const password = strip(process.env.ADMIN_PASSWORD);
  if (!email && !password)
    return {
      ADMIN_EMAIL: undefined,
      ADMIN_PASSWORD: undefined,
      adminProblem: 'Set ADMIN_EMAIL and ADMIN_PASSWORD on the server.',
    };
  const problems = [
    !email
      ? 'ADMIN_EMAIL is missing'
      : !z.string().email().safeParse(email).success
        ? 'ADMIN_EMAIL is not a valid email address'
        : '',
    !password
      ? 'ADMIN_PASSWORD is missing'
      : password.length < 10
        ? 'ADMIN_PASSWORD must be at least 10 characters'
        : '',
  ].filter(Boolean);
  if (problems.length) {
    console.warn(`Admin sign-in disabled: ${problems.join('; ')}`);
    return {
      ADMIN_EMAIL: undefined,
      ADMIN_PASSWORD: undefined,
      adminProblem: `${problems.join('; ')}. Fix the variable on the server.`,
    };
  }
  return { ADMIN_EMAIL: email, ADMIN_PASSWORD: password, adminProblem: '' };
}

export type NotifyMode = 'log' | 'test' | 'live';

/**
 * Booking requests and doctor notifications. Nothing here can stop the API from starting: a bad value
 * falls back to the safe default with a warning.
 * - NOTIFY_MODE: log (write to the log only) · test (everything goes to TEST_NOTIFY_*) · live (real
 *   doctors). Defaults to test, and live only counts when NODE_ENV=production.
 */
function bookingRequests() {
  const flag = (v?: string) =>
    ['1', 'true', 'yes'].includes(
      String(v ?? '')
        .trim()
        .toLowerCase(),
    );
  const wanted = String(process.env.NOTIFY_MODE ?? 'test')
    .trim()
    .toLowerCase();
  let notifyMode: NotifyMode = 'test';
  if (wanted === 'log' || wanted === 'test') notifyMode = wanted;
  else if (wanted === 'live') {
    if (parsed.data!.NODE_ENV === 'production') notifyMode = 'live';
    else console.warn('NOTIFY_MODE=live is only honoured when NODE_ENV=production; using test.');
  } else console.warn(`NOTIFY_MODE "${wanted}" is not log, test or live; using test.`);
  const optional = (v?: string) => v?.trim() || undefined;
  return {
    /** Doctors imported from Doctar take booking requests (no payment) instead of Call / Visit only. */
    IMPORTED_BOOKABLE: flag(process.env.IMPORTED_BOOKABLE),
    NOTIFY_MODE: notifyMode,
    TEST_NOTIFY_EMAIL: optional(process.env.TEST_NOTIFY_EMAIL),
    TEST_NOTIFY_PHONE: optional(process.env.TEST_NOTIFY_PHONE),
    /** Email via Resend (resend.com). Without a key, email notifications are skipped and logged. */
    RESEND_API_KEY: optional(process.env.RESEND_API_KEY),
    /** Resend's shared test sender only delivers to the Resend account's own address; use a verified domain for live. */
    NOTIFY_EMAIL_FROM: optional(process.env.NOTIFY_EMAIL_FROM) ?? 'Curxx <onboarding@resend.dev>',
    /** SMS provider name ("log" until Doctar's provider is plugged in; see lib/notify/sms.ts). */
    SMS_PROVIDER: optional(process.env.SMS_PROVIDER)?.toLowerCase() ?? 'log',
    SMS_API_KEY: optional(process.env.SMS_API_KEY),
    SMS_SENDER_ID: optional(process.env.SMS_SENDER_ID),
    SMS_DLT_ENTITY_ID: optional(process.env.SMS_DLT_ENTITY_ID),
    SMS_DLT_TEMPLATE_ID: optional(process.env.SMS_DLT_TEMPLATE_ID),
    /** Optional second template used in test mode, whose text names the real recipient. */
    SMS_DLT_TEST_TEMPLATE_ID: optional(process.env.SMS_DLT_TEST_TEMPLATE_ID),
  };
}

/**
 * Doctar directory: doctors and hospitals read live from Doctar's database (read-only). All optional; bad
 * values fall back to the defaults. Without DOCTAR_DB_URL (e.g. in tests) the directory is off.
 */
function doctarSettings() {
  const int = (v: string | undefined, fallback: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) && v?.trim() ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
  };
  const url = process.env.DOCTAR_DB_URL?.trim() || undefined;
  const flag = (v?: string) =>
    ['1', 'true', 'yes'].includes(
      String(v ?? '')
        .trim()
        .toLowerCase(),
    );
  return {
    DOCTAR_DB_URL: url,
    /** On when DOCTAR_DB_URL is set, unless DOCTAR_ENABLED=false. */
    DOCTAR_ENABLED:
      Boolean(url) &&
      String(process.env.DOCTAR_ENABLED ?? 'true')
        .trim()
        .toLowerCase() !== 'false',
    /** Only Doctar's admin-verified doctors (default: all doctors in Curxx's cities and specialties). */
    DOCTAR_VERIFIED_ONLY: flag(process.env.DOCTAR_VERIFIED_ONLY),
    /** Full rebuild of the listing index; Doctar has no updatedAt index yet, so no incremental refresh. */
    DOCTAR_REFRESH_MINUTES: int(process.env.DOCTAR_REFRESH_MINUTES, 60, 5, 24 * 60),
    /** Records per read while building the index (memory vs number of round trips). */
    DOCTAR_PAGE_SIZE: int(process.env.DOCTAR_PAGE_SIZE, 1000, 100, 5000),
    /** Cap on doctors held in memory (0 = no cap). */
    DOCTAR_MAX_DOCTORS: int(process.env.DOCTAR_MAX_DOCTORS, 0, 0, 10_000_000),
    DOCTAR_TIMEOUT_MS: int(process.env.DOCTAR_TIMEOUT_MS, 15_000, 1_000, 120_000),
    /** How long a profile or hospital page read from Doctar is reused (served stale while refreshing). */
    DOCTAR_DETAIL_TTL_SECONDS: int(process.env.DOCTAR_DETAIL_TTL_SECONDS, 600, 0, 24 * 3600),
    DOCTAR_POOL_SIZE: int(process.env.DOCTAR_POOL_SIZE, 3, 1, 20),
  };
}

export const env = {
  ...parsed.data,
  ...adminLogin(),
  ...bookingRequests(),
  ...doctarSettings(),
  /**
   * The generated seed doctors, facilities, reviews and testimonials (see lib/sample-data.ts). Off by
   * default: the website then only shows imported and admin-added records. Tests and demos turn it on.
   */
  SHOW_SAMPLE_DATA: ['1', 'true', 'yes'].includes(
    String(process.env.SHOW_SAMPLE_DATA ?? '')
      .trim()
      .toLowerCase(),
  ),
  isProduction: parsed.data.NODE_ENV === 'production',
  // The Angular admin panel runs on :4200 in development.
  corsOrigins: [
    ...parsed.data.CORS_ORIGIN.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    ...(parsed.data.NODE_ENV === 'production' ? [] : ['http://localhost:4200']),
  ],
};
