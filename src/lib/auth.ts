import type { FastifyReply, FastifyRequest } from 'fastify';
import { unauthorized } from './errors.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; phone: string; role?: 'admin' };
    user: { sub: string; phone: string; role?: 'admin' };
  }
}

/** preHandler that rejects requests without a valid bearer token. */
export async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    throw unauthorized();
  }
  // Admin tokens are for the admin API only; they have no patient account behind them.
  if (request.user.role === 'admin') throw unauthorized('Sign in with a patient account');
}
