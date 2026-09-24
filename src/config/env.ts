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
  /** Admin panel login. Leave unset to disable admin sign-in. */
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(10, 'ADMIN_PASSWORD must be at least 10 characters').optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  // The Angular admin panel runs on :4200 in development.
  corsOrigins: [...parsed.data.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean), ...(parsed.data.NODE_ENV === 'production' ? [] : ['http://localhost:4200'])],
};
