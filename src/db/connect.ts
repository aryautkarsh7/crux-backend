import { mkdirSync } from 'node:fs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';

const LOCAL_DB_PATH = '.data/mongo';

let memoryServer: { stop: () => Promise<boolean> } | undefined;

/**
 * Connects to MONGODB_URI when provided (Atlas in production). Otherwise starts a
 * local MongoDB on demand and persists its data under .data/mongo, so development
 * needs no database install.
 */
export async function connectDatabase(): Promise<string> {
  let uri = env.MONGODB_URI;

  if (!uri) {
    if (env.isProduction) throw new Error('MONGODB_URI is required in production');
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mkdirSync(LOCAL_DB_PATH, { recursive: true });
    const server = await MongoMemoryServer.create({
      instance: { dbName: 'curxx', dbPath: LOCAL_DB_PATH, storageEngine: 'wiredTiger' },
    });
    memoryServer = server;
    uri = server.getUri('curxx');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 10_000 });
  return uri;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
  await memoryServer?.stop();
}
