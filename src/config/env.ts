// Slots, collection windows and 'today' are all Indian time, wherever the server runs.
process.env.TZ = process.env.TZ || 'Asia/Kolkata';

import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().optional(),
  /** Database name for the local development/test MongoDB. */
  MONGODB_DB: z.string().regex(/^[a-z0-9_]+$/i).default('curxx'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

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
  if (!email && !password) return { ADMIN_EMAIL: undefined, ADMIN_PASSWORD: undefined, adminProblem: 'Set ADMIN_EMAIL and ADMIN_PASSWORD on the server.' };
  const problems = [
    !email ? 'ADMIN_EMAIL is missing' : !z.string().email().safeParse(email).success ? 'ADMIN_EMAIL is not a valid email address' : '',
    !password ? 'ADMIN_PASSWORD is missing' : password.length < 10 ? 'ADMIN_PASSWORD must be at least 10 characters' : '',
  ].filter(Boolean);
  if (problems.length) {
    console.warn(`Admin sign-in disabled: ${problems.join('; ')}`);
    return { ADMIN_EMAIL: undefined, ADMIN_PASSWORD: undefined, adminProblem: `${problems.join('; ')}. Fix the variable on the server.` };
  }
  return { ADMIN_EMAIL: email, ADMIN_PASSWORD: password, adminProblem: '' };
}

export const env = {
  ...parsed.data,
  ...adminLogin(),
  isProduction: parsed.data.NODE_ENV === 'production',
  // The Angular admin panel runs on :4200 in development.
  corsOrigins: [...parsed.data.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean), ...(parsed.data.NODE_ENV === 'production' ? [] : ['http://localhost:4200'])],
};
