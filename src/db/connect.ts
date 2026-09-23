import { mkdirSync } from 'node:fs';
import { createConnection } from 'node:net';
import mongoose from 'mongoose';
import { env } from '../config/env.js';

const LOCAL_DB_PATH = '.data/mongo';
const LOCAL_PORT = 27017;

let memoryServer: { stop: () => Promise<boolean> } | undefined;

/** True when something is already listening locally — the API server and the seed share one mongod. */
function localMongoIsUp(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port: LOCAL_PORT });
    const done = (up: boolean) => { socket.destroy(); resolve(up); };
    socket.setTimeout(400);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/**
 * Connects to MONGODB_URI when provided (Atlas in production). Otherwise reuses the
 * local MongoDB on port 27017, starting one on demand and persisting its data under
 * .data/mongo, so development needs no database install.
 */
export async function connectDatabase(): Promise<string> {
  let uri = env.MONGODB_URI;

  if (!uri) {
    if (env.isProduction) throw new Error('MONGODB_URI is required in production');
    if (await localMongoIsUp()) {
      uri = `mongodb://127.0.0.1:${LOCAL_PORT}/${env.MONGODB_DB}`;
    } else {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      mkdirSync(LOCAL_DB_PATH, { recursive: true });
      const server = await MongoMemoryServer.create({
        instance: { port: LOCAL_PORT, dbName: env.MONGODB_DB, dbPath: LOCAL_DB_PATH, storageEngine: 'wiredTiger' },
      });
      memoryServer = server;
      uri = server.getUri(env.MONGODB_DB);
    }
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 10_000 });
  return uri;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
  await memoryServer?.stop();
}
