import { env } from './config/env.js';
import { buildApp } from './app.js';
import { ensureCatalogue } from './db/catalogue.js';
import { connectDatabase, disconnectDatabase } from './db/connect.js';
import { pruneSlots } from './lib/slot-gen.js';

const app = await buildApp();

try {
  const uri = await connectDatabase();
  app.log.info(`mongodb connected (${uri.includes('127.0.0.1') || uri.includes('localhost') ? 'local' : 'remote'})`);
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
} catch (error) {
  app.log.error({ err: error }, 'failed to start');
  process.exit(1);
}

// After a deploy with new catalogue data, update the database in the background. The API keeps
// serving the previous data until the sync finishes, so the health check never waits on it.
if (env.NODE_ENV !== 'test') {
  ensureCatalogue((m) => app.log.info(m))
    .then((ran) => ran && app.log.info('catalogue synced'))
    .catch((err) => app.log.error({ err }, 'catalogue sync failed'));
  const prune = () => pruneSlots().then((n) => n && app.log.info(`pruned ${n} past slots`)).catch(() => {});
  setTimeout(prune, 60_000).unref();
  setInterval(prune, 6 * 60 * 60 * 1000).unref();
}


for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    app.log.info(`${signal} received, shutting down`);
    await app.close();
    await disconnectDatabase();
    process.exit(0);
  });
}
