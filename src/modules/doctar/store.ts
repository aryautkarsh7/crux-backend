/**
 * The website's doctors and hospitals: Curxx's own records (MongoDB, sample data hidden as before) plus the
 * Doctar directory (memory), read through one interface with MongoDB filters and sorts. Routes use these
 * instead of DoctorModel / FacilityModel for public reads; writes and the admin panel stay on the models.
 * Records imported from Doctar earlier (source "doctar") are left out of the Curxx side: the live directory
 * already has them.
 */
import type { Model } from 'mongoose';
import { project, sortBy } from '../../lib/query-match.js';
import { DoctorModel } from '../../models/doctor.model.js';
import { FacilityModel } from '../../models/facility.model.js';
import { notFound, unavailable } from '../../lib/errors.js';
import { directoryMatches, directoryUnavailable } from './directory.js';

export type Doc = Record<string, any> & { _id: any };
type Filter = Record<string, unknown>;
type Projection = Record<string, 0 | 1> | string;
export type FindOptions = {
  projection?: Projection;
  sort?: Record<string, 1 | -1>;
  skip?: number;
  limit?: number;
};

const curxxOnly = (filter: Filter): Filter => ({ $and: [filter, { source: { $ne: 'doctar' } }] });

function store(model: Model<any>, kind: 'doctors' | 'facilities') {
  const fromMemory = (filter: Filter) => directoryMatches(kind, filter) as unknown as Doc[];
  return {
    /** Matching records from both sources, sorted, then skip/limit across the union. */
    async find(filter: Filter = {}, options: FindOptions = {}): Promise<Doc[]> {
      const skip = options.skip ?? 0;
      const want = options.limit === undefined ? Infinity : skip + options.limit;
      let query = model.find(curxxOnly(filter), options.projection ?? undefined);
      if (options.sort) query = query.sort(options.sort);
      if (Number.isFinite(want)) query = query.limit(want);
      const [curxx, memory] = [(await query.lean()) as Doc[], fromMemory(filter)];
      let all = memory.length ? [...curxx, ...memory] : curxx;
      if (options.sort && memory.length) all = sortBy(all, options.sort);
      const page = Number.isFinite(want) ? all.slice(skip, want) : skip ? all.slice(skip) : all;
      return memory.length && options.projection
        ? page.map((d) => (d.source === 'doctar' ? project(d, options.projection) : d))
        : page;
    },
    async findOne(filter: Filter, projection?: Projection): Promise<Doc | null> {
      const curxx = (await model
        .findOne(curxxOnly(filter), projection ?? undefined)
        .lean()) as Doc | null;
      if (curxx) return curxx;
      const hit = fromMemory(filter)[0];
      return hit ? (projection ? project(hit, projection) : hit) : null;
    },
    async count(filter: Filter = {}): Promise<number> {
      return (await model.countDocuments(curxxOnly(filter))) + fromMemory(filter).length;
    },
    async distinct(field: string, filter: Filter = {}): Promise<unknown[]> {
      const curxx = await model.distinct(field, curxxOnly(filter));
      const values = new Set<unknown>(curxx);
      for (const d of fromMemory(filter)) {
        const v = d[field];
        for (const x of Array.isArray(v) ? v : [v]) if (x !== undefined) values.add(x);
      }
      return [...values];
    },
    /** { _id: value, count } per value of a field (array fields count each element, like $unwind). */
    async countBy(field: string, filter: Filter = {}): Promise<{ _id: any; count: number }[]> {
      const unwind = (await model.schema.path(field))?.instance === 'Array';
      const curxx = await model.aggregate<{ _id: unknown; count: number }>([
        { $match: curxxOnly(filter) },
        ...(unwind ? [{ $unwind: `$${field}` }] : []),
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      ]);
      const counts = new Map<unknown, number>(curxx.map((r) => [r._id, r.count]));
      for (const d of fromMemory(filter)) {
        const v = d[field];
        for (const x of Array.isArray(v) ? v : [v])
          counts.set(x ?? null, (counts.get(x ?? null) ?? 0) + 1);
      }
      return [...counts].map(([_id, count]) => ({ _id, count }));
    },
  };
}

/** For a doctor or hospital that isn't found: while Doctar's records aren't loaded it may just be missing for now (503, not 404). */
export const notListed = (message: string) =>
  directoryUnavailable() ? unavailable() : notFound(message);

export const Doctors = store(DoctorModel, 'doctors');
export const Facilities = store(FacilityModel, 'facilities');
