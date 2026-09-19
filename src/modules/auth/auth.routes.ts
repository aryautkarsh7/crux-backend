import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../lib/auth.js';
import { notFound } from '../../lib/errors.js';
import { UserModel } from '../../models/user.model.js';
import { requestOtp, verifyOtp } from './auth.service.js';

const phoneBody = z.object({ phone: z.string() });
const verifyBody = z.object({ phone: z.string(), code: z.string().trim() });
const profileBody = z.object({ name: z.string().trim().max(80).optional(), abhaId: z.string().trim().max(32).optional() });

const userShape = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    phone: { type: 'string' },
    name: { type: 'string' },
    abhaId: { type: 'string' },
  },
} as const;

const toUser = (u: { _id: unknown; phone: string; name?: string; abhaId?: string }) => ({
  id: String(u._id),
  phone: u.phone,
  name: u.name ?? '',
  abhaId: u.abhaId ?? '',
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/otp/request', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    schema: {
      response: {
        200: { type: 'object', properties: { phone: { type: 'string' }, expiresInSeconds: { type: 'number' }, devCode: { type: 'string' } } },
      },
    },
  }, async (request) => requestOtp(phoneBody.parse(request.body).phone));

  app.post('/otp/verify', {
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
    schema: {
      response: { 200: { type: 'object', properties: { token: { type: 'string' }, user: userShape } } },
    },
  }, async (request) => {
    const { phone, code } = verifyBody.parse(request.body);
    const user = await verifyOtp(phone, code);
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

  app.patch('/me', { preHandler: authenticate }, async (request) => {
    const patch = profileBody.parse(request.body);
    const user = await UserModel.findByIdAndUpdate(request.user.sub, patch, { new: true }).lean();
    if (!user) throw notFound('Account not found');
    return { user: toUser(user) };
  });
}
