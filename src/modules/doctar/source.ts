/**
 * Read-only access to Doctar's database. Only find / distinct exist here, so nothing in Curxx can write to
 * Doctar. Reads prefer secondaries, use a small pool and time out instead of hanging.
 */
import mongoose from 'mongoose';
import { matches, project, sortBy } from '../../lib/query-match.js';

export type DoctarCollection = 'doctors' | 'hospitals' | 'doctorschedules';
type Doc = Record<string, unknown>;
type FindOptions = { projection?: Record<string, unknown>; sort?: Record<string, 1 | -1>; limit?: number };

export interface DoctarSource {
  readonly name: string;
  distinct(collection: DoctarCollection, field: string, filter?: Doc): Promise<unknown[]>;
  find(collection: DoctarCollection, filter: Doc, options?: FindOptions): Promise<Doc[]>;
  close(): Promise<void>;
}

export type SourceOptions = { poolSize: number; timeoutMs: number };

/** Doctar's MongoDB (DOCTAR_DB_URL). The connection opens lazily and reconnects after a drop. */
export function mongoDoctarSource(url: string, { poolSize, timeoutMs }: SourceOptions): DoctarSource {
  let conn: mongoose.Connection | null = null;
  const connect = async () => {
    if (conn && conn.readyState === 1) return conn;
    conn = await mongoose
      .createConnection(url, {
        readPreference: 'secondaryPreferred',
        autoIndex: false,
        autoCreate: false,
        maxPoolSize: poolSize,
        serverSelectionTimeoutMS: timeoutMs,
        socketTimeoutMS: timeoutMs * 3,
        connectTimeoutMS: timeoutMs,
      })
      .asPromise();
    return conn;
  };
  const collection = async (name: DoctarCollection) => (await connect()).db!.collection(name);
  return {
    name: 'doctar',
    async distinct(name, field, filter = {}) {
      return (await collection(name)).distinct(field, filter, { maxTimeMS: timeoutMs * 3 });
    },
    async find(name, filter, options = {}) {
      const cursor = (await collection(name)).find(filter, { projection: options.projection, sort: options.sort, limit: options.limit, maxTimeMS: timeoutMs * 3 });
      return (await cursor.toArray()) as Doc[];
    },
    async close() {
      await conn?.close().catch(() => {});
      conn = null;
    },
  };
}

/** In-memory stand-in with the same behaviour, for tests (and for simulating an outage). */
/** Deep copy of plain data; ObjectIds and Dates are kept as they are (structuredClone would strip ObjectIds). */
const copy = <T,>(v: T): T =>
  Array.isArray(v) ? (v.map(copy) as T) : v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype ? (Object.fromEntries(Object.entries(v).map(([k, x]) => [k, copy(x)])) as T) : v;

export function memoryDoctarSource(data: Partial<Record<DoctarCollection, Doc[]>>, opts: { failing?: () => boolean } = {}): DoctarSource & { data: typeof data } {
  const rows = (name: DoctarCollection) => {
    if (opts.failing?.()) throw new Error('Doctar unavailable (simulated)');
    return data[name] ?? [];
  };
  return {
    name: 'memory',
    data,
    async distinct(name, field, filter = {}) {
      return [...new Set(rows(name).filter((d) => matches(d, filter)).map((d) => d[field]))];
    },
    async find(name, filter, options = {}) {
      let out = rows(name).filter((d) => matches(d, filter));
      if (options.sort) out = sortBy([...out], options.sort);
      if (options.limit) out = out.slice(0, options.limit);
      return out.map((d) => project(copy(d), options.projection as Record<string, 0 | 1> | undefined));
    },
    async close() {},
  };
}
