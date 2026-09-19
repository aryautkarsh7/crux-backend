import type { FastifyReply, FastifyRequest } from 'fastify';
import { unauthorized } from './errors.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; phone: string };
    user: { sub: string; phone: string };
  }
}

/** preHandler that rejects requests without a valid bearer token. */
export async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    throw unauthorized();
  }
}
