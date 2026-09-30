/**
 * Sample data: the generated seed doctors, facilities, reviews and testimonials. They stay in the
 * database (flagged `sample: true` by the catalogue sync) but, unless SHOW_SAMPLE_DATA is on, every
 * public query leaves them out. The rule lives on the models, so a new route can't forget it:
 * - public: records added in the admin panel (`managed`) or imported (`source`), minus anything flagged
 *   `sample`. Reviews: ones patients wrote (`user`) or the team added.
 * - everything: the admin panel, the catalogue sync and the import script, which run inside
 *   `withSampleData`.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Aggregate, Query, Schema } from 'mongoose';
import { env } from '../config/env.js';

const scope = new AsyncLocalStorage<true>();

/**
 * Runs `fn` (and everything it awaits) with sample data visible, e.g. for the admin panel. Awaits inside
 * the scope because a Mongoose query only runs once it's awaited.
 */
export const withSampleData = <R>(fn: () => R): Promise<Awaited<R>> =>
  scope.run(true, async (): Promise<Awaited<R>> => await fn());

/** True when queries made right now leave sample records out. */
export const sampleHidden = () => !env.SHOW_SAMPLE_DATA && !scope.getStore();

const QUERY_OPS = [
  'find',
  'findOne',
  'countDocuments',
  'distinct',
  'findOneAndUpdate',
  'updateOne',
  'updateMany',
  'findOneAndDelete',
  'deleteOne',
  'deleteMany',
  'replaceOne',
  'findOneAndReplace',
] as const;

/**
 * Hides sample records from the schema's queries and aggregates. `real` says which records are real;
 * a record flagged `sample: true` stays hidden even if it matches (e.g. a seed doctor edited in the admin).
 * The schema needs a `sample` boolean.
 */
export function hideSampleData(schema: Schema, real: () => Record<string, unknown>) {
  const visible = () => ({ sample: { $ne: true }, ...real() });
  schema.pre(
    [...QUERY_OPS],
    { document: false, query: true },
    function (this: Query<unknown, unknown>) {
      if (sampleHidden()) this.and([visible()]);
    },
  );
  schema.pre('aggregate', function (this: Aggregate<unknown>) {
    if (!sampleHidden()) return;
    const pipeline = this.pipeline();
    // $geoNear has to stay the first stage.
    pipeline.splice(pipeline[0] && '$geoNear' in pipeline[0] ? 1 : 0, 0, { $match: visible() });
  });
}

/** Admin-added or imported: the rule for doctors and facilities. */
export const addedOrImported = () => ({
  $or: [{ managed: true }, { source: { $nin: [null, ''] } }],
});
