import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../lib/auth.js';
import { notFound } from '../../lib/errors.js';
import { LoginEventModel } from '../../models/activity.model.js';
import { UserModel } from '../../models/user.model.js';
import { deviceOf } from '../activity/activity.routes.js';
import { requestOtp, verifyOtp } from './auth.service.js';
import { ensureDemoLocker } from '../me/demo-locker.js';

const phoneBody = z.object({ phone: z.string(), intent: z.enum(['login', 'register', 'any']).default('any') });
const registrationBody = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')).optional(),
  gender: z.enum(['female', 'male', 'other', '']).optional(),
  dob: z.coerce.date().max(new Date(), 'Date of birth cannot be in the future').optional(),
});
const verifyBody = z.object({ phone: z.string(), code: z.string().trim(), registration: registrationBody.optional() });
const profileBody = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')).optional(),
  gender: z.enum(['female', 'male', 'other', '']).optional(),
  dob: z.coerce.date().max(new Date(), 'Date of birth cannot be in the future').optional(),
  bloodGroup: z.enum(['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  abhaId: z.string().trim().regex(/^(\d{2}-\d{4}-\d{4}-\d{4})?$/, 'ABHA number looks like 91-1234-5678-9012').optional(),
});

const userShape = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    phone: { type: 'string' },
    name: { type: 'string' },
    email: { type: 'string' },
    gender: { type: 'string' },
    dob: { type: ['string', 'null'] },
    bloodGroup: { type: 'string' },
    abhaId: { type: 'string' },
  },
} as const;

type UserDoc = { _id: unknown; phone: string; name?: string | null; email?: string | null; gender?: string | null; dob?: Date | null; bloodGroup?: string | null; abhaId?: string | null };

const toUser = (u: UserDoc) => ({
  id: String(u._id),
  phone: u.phone,
  name: u.name ?? '',
  email: u.email ?? '',
  gender: u.gender ?? '',
  dob: u.dob ? new Date(u.dob).toISOString() : null,
  bloodGroup: u.bloodGroup ?? '',
  abhaId: u.abhaId ?? '',
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/otp/request', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    schema: {
      response: {
        200: { type: 'object', properties: { phone: { type: 'string' }, registered: { type: 'boolean' }, expiresInSeconds: { type: 'number' }, devCode: { type: 'string' } } },
      },
    },
  }, async (request) => {
    const { phone, intent } = phoneBody.parse(request.body);
    return requestOtp(phone, intent);
  });

  app.post('/otp/verify', {
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
    schema: {
      response: { 200: { type: 'object', properties: { token: { type: 'string' }, user: userShape } } },
    },
  }, async (request) => {
    const { phone, code, registration } = verifyBody.parse(request.body);
    const verified = await verifyOtp(phone, code, registration);
    await ensureDemoLocker(verified._id, verified.phone);
    const user = (await UserModel.findByIdAndUpdate(verified._id, { $inc: { loginCount: 1 } }, { new: true }).lean())!;
    // Sign-in history for the admin panel; never block a login on it.
    LoginEventModel.create({
      user: user._id,
      phone: user.phone,
      name: user.name ?? '',
      firstLogin: user.loginCount === 1,
      intent: registration ? 'register' : 'login',
      device: deviceOf(request),
      userAgent: String(request.headers['user-agent'] ?? '').slice(0, 200),
    }).catch((error) => request.log.warn({ err: error }, 'login event not recorded'));
    const token = await request.server.jwt.sign({ sub: String(user._id), phone: user.phone }, { expiresIn: '30d' });
    return { token, user: toUser(user) };
  });

  app.get('/me', {
    preHandler: authenticate,
    schema: { response: { 200: { type: 'object', properties: { user: userShape } } } },
  }, async (request) => {
    const user = await UserModel.findById(request.user.sub).lean();
    if (!user) throw notFound('Account not found');
    return { user: toUser(user) };
  });

  app.patch('/me', { preHandler: authenticate, schema: { response: { 200: { type: 'object', properties: { user: userShape } } } } }, async (request) => {
    const patch = profileBody.parse(request.body);
    const user = await UserModel.findByIdAndUpdate(request.user.sub, patch, { new: true }).lean();
    if (!user) throw notFound('Account not found');
    return { user: toUser(user) };
  });
}
