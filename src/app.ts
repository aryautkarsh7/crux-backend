import compress from '@fastify/compress';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyError, type FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { HttpError } from './lib/errors.js';
import { appointmentRoutes } from './modules/appointments/appointment.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { doctorRoutes } from './modules/doctors/doctor.routes.js';
import { contentRoutes } from './modules/content/content.routes.js';
import { facilityRoutes } from './modules/facilities/facility.routes.js';
import { labRoutes } from './modules/labs/lab.routes.js';
import { meRoutes } from './modules/me/me.routes.js';
import { orderRoutes } from './modules/orders/order.routes.js';
import { pharmacyRoutes } from './modules/pharmacy/pharmacy.routes.js';
import { recordRoutes } from './modules/records/record.routes.js';
import { searchRoutes } from './modules/search/search.routes.js';
import { triageRoutes } from './modules/triage/triage.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : env.isProduction ? true : { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } },
    trustProxy: true,
    disableRequestLogging: env.isProduction,
    bodyLimit: 256 * 1024,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: env.corsOrigins, credentials: true });
  await app.register(compress, { global: true, threshold: 1024 });
  // Anonymous GETs are cacheable catalogue reads — the frontend build alone pre-renders ~170 pages from
  // one address — so they get their own, larger bucket. Signed-in and write traffic keeps the tight limit,
  // and sensitive routes (OTP, reviews, leads) set stricter limits of their own.
  // The test suite fires hundreds of requests from one address; limits are tested separately.
  const publicRead = (request: FastifyRequest) => request.method === 'GET' && !request.headers.authorization;
  await app.register(rateLimit, {
    max: (request) => (publicRead(request) ? 1500 : 120),
    keyGenerator: (request) => `${request.ip}:${publicRead(request) ? 'read' : 'write'}`,
    timeWindow: '1 minute',
    allowList: env.NODE_ENV === 'test' ? () => true : undefined,
  });
  await app.register(jwt, { secret: env.JWT_SECRET });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof ZodError) {
      const first = error.issues[0];
      return reply.status(400).send({
        error: 'invalid_request',
        message: first?.message ?? 'Invalid request',
        field: first?.path.join('.') || undefined,
        issues: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
    }
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({ error: error.code, message: error.message });
    }
    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({ error: error.code ?? 'error', message: error.message });
    }
    request.log.error({ err: error }, 'unhandled error');
    return reply.status(500).send({ error: 'server_error', message: 'Something went wrong' });
  });

  app.get('/health', async () => ({ status: 'ok', uptime: Math.round(process.uptime()) }));

  // Root index: this is an API, so say so rather than returning a bare 404.
  app.get('/', async () => ({
    service: 'curxx-api',
    version: '1.0.0',
    website: env.corsOrigins[0] ?? 'http://localhost:3000',
    docs: 'All endpoints live under /api/v1. Authenticated ones need "Authorization: Bearer <token>" from /auth/otp/verify.',
    endpoints: {
      auth: ['POST /auth/otp/request', 'POST /auth/otp/verify', 'GET /auth/me', 'PATCH /auth/me'],
      catalogue: ['GET /specialties', 'GET /doctors', 'GET /doctors/:slug', 'GET /doctors/:slug/slots', 'GET /doctors/:slug/reviews', 'GET /facilities', 'GET /facilities/:slug', 'GET /search?q='],
      booking: ['POST /slots/:id/hold', 'POST /appointments', 'GET /appointments', 'GET /appointments/:id', 'PATCH /appointments/:id/cancel', 'PATCH /appointments/:id/reschedule', 'GET|POST /appointments/:id/messages'],
      pharmacy: ['GET /medicine-categories', 'GET /medicines', 'GET /medicines/:slug', 'POST /orders', 'GET /orders', 'GET /orders/:reference', 'PATCH /orders/:reference/cancel'],
      labs: ['GET /lab-categories', 'GET /lab-tests', 'GET /lab-tests/:slug', 'GET /lab-collection-slots'],
      records: ['GET /records', 'GET /records/:id', 'POST /records', 'DELETE /records/:id', 'GET /access', 'POST /access', 'PATCH /access/:id/revoke'],
      account: ['GET /me/saved', 'PUT|DELETE /me/saved/:kind/:slug', 'GET|POST /me/addresses', 'PATCH /me/addresses/:id/default', 'DELETE /me/addresses/:id', 'GET /me/notifications', 'GET /me/summary'],
      content: ['GET /articles', 'GET /articles/:slug', 'POST /doctors/:slug/reviews', 'POST /reviews/:id/helpful', 'POST /leads', 'POST /triage'],
    },
  }));

  app.setNotFoundHandler(async (request, reply) =>
    reply.status(404).send({ error: 'not_found', message: `No route for ${request.method} ${request.url}. See GET / for the endpoint list.` }),
  );

  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(doctorRoutes, { prefix: '/api/v1' });
  await app.register(appointmentRoutes, { prefix: '/api/v1' });
  await app.register(facilityRoutes, { prefix: '/api/v1' });
  await app.register(pharmacyRoutes, { prefix: '/api/v1' });
  await app.register(labRoutes, { prefix: '/api/v1' });
  await app.register(orderRoutes, { prefix: '/api/v1' });
  await app.register(recordRoutes, { prefix: '/api/v1' });
  await app.register(contentRoutes, { prefix: '/api/v1' });
  await app.register(triageRoutes, { prefix: '/api/v1' });
  await app.register(searchRoutes, { prefix: '/api/v1' });
  await app.register(meRoutes, { prefix: '/api/v1/me' });

  return app;
}
