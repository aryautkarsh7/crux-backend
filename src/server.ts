import { env } from './config/env.js';
import { buildApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './db/connect.js';

const app = await buildApp();

try {
  const uri = await connectDatabase();
  app.log.info(`mongodb connected (${uri.includes('127.0.0.1') || uri.includes('localhost') ? 'local' : 'remote'})`);
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
} catch (error) {
  app.log.error({ err: error }, 'failed to start');
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    app.log.info(`${signal} received, shutting down`);
    await app.close();
    await disconnectDatabase();
    process.exit(0);
  });
}
