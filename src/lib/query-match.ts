/**
 * MongoDB-style filters and sorts on plain objects in memory, so a filter built for a Mongoose query also
 * works on records held in memory (the Doctar directory). Covers the operators the routes use: equality
 * (including arrays and RegExp values), $in, $nin, $ne, $gt, $gte, $lt, $lte, $exists, $regex/$options,
 * $elemMatch, $size, $or, $and, $nor and dotted paths.
 */
type Filter = Record<string, unknown>;

/** Values at a dotted path; arrays along the way fan out, as in MongoDB ("hospitals.name"). */
function valuesAt(doc: unknown, path: string): unknown[] {
  let current: unknown[] = [doc];
  for (const key of path.split('.')) {
    const next: unknown[] = [];
    for (const value of current) {
      if (Array.isArray(value)) {
        for (const item of value)
          if (item && typeof item === 'object' && key in item)
            next.push((item as Record<string, unknown>)[key]);
        if (/^\d+$/.test(key) && value[Number(key)] !== undefined) next.push(value[Number(key)]);
      } else if (value && typeof value === 'object' && key in (value as object))
        next.push((value as Record<string, unknown>)[key]);
      else next.push(undefined);
    }
    current = next;
  }
  return current;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' &&
  v !== null &&
  !Array.isArray(v) &&
  !(v instanceof RegExp) &&
  !(v instanceof Date) &&
  !('_bsontype' in (v as object));

/** Comparable form: dates and ObjectIds compare by value. */
const plain = (v: unknown) =>
  v instanceof Date
    ? v.getTime()
    : v && typeof v === 'object' && '_bsontype' in (v as object)
      ? String(v)
      : v;

function equals(value: unknown, target: unknown): boolean {
  // A regex matches an array when any string in it matches ({ departments: /^Oral/i }).
  if (target instanceof RegExp)
    return Array.isArray(value)
      ? value.some((v) => typeof v === 'string' && target.test(v))
      : typeof value === 'string' && target.test(value);
  if (Array.isArray(value))
    return value.some((v) => equals(v, target)) || JSON.stringify(value) === JSON.stringify(target);
  if (target === null) return value === null || value === undefined;
  return plain(value) === plain(target);
}

function compare(a: unknown, b: unknown) {
  const x = plain(a);
  const y = plain(b);
  if (typeof x === 'number' && typeof y === 'number') return x - y;
  if (typeof x === 'string' && typeof y === 'string') return x < y ? -1 : x > y ? 1 : 0;
  return NaN;
}

/** Primitive $in lists as Sets, so a long list (e.g. a page's slugs) costs one lookup per value. */
const primitiveSets = new WeakMap<unknown[], Set<unknown> | null>();
function inList(values: unknown[], list: unknown[]): boolean {
  let set = primitiveSets.get(list);
  if (set === undefined) {
    set =
      list.length > 8 && list.every((t) => typeof t === 'string' || typeof t === 'number')
        ? new Set(list)
        : null;
    primitiveSets.set(list, set);
  }
  if (!set) return list.some((t) => values.some((v) => equals(v, t)));
  return values.some((v) => (Array.isArray(v) ? v.some((x) => set!.has(x)) : set!.has(v)));
}

function matchOperators(values: unknown[], ops: Record<string, unknown>): boolean {
  const flat = values.flatMap((v) => (Array.isArray(v) ? [v, ...v] : [v]));
  const any = (test: (v: unknown) => boolean) => flat.some(test);
  for (const [op, arg] of Object.entries(ops)) {
    switch (op) {
      case '$eq':
        if (!values.some((v) => equals(v, arg))) return false;
        break;
      case '$ne':
        if (values.some((v) => equals(v, arg))) return false;
        break;
      case '$in':
        if (!inList(values, arg as unknown[])) return false;
        break;
      case '$nin':
        if (inList(values, arg as unknown[])) return false;
        break;
      case '$gt':
        if (!any((v) => compare(v, arg) > 0)) return false;
        break;
      case '$gte':
        if (!any((v) => compare(v, arg) >= 0)) return false;
        break;
      case '$lt':
        if (!any((v) => compare(v, arg) < 0)) return false;
        break;
      case '$lte':
        if (!any((v) => compare(v, arg) <= 0)) return false;
        break;
      case '$exists':
        if (values.some((v) => v !== undefined) !== Boolean(arg)) return false;
        break;
      case '$regex': {
        const re =
          arg instanceof RegExp ? arg : new RegExp(String(arg), String(ops.$options ?? ''));
        if (!any((v) => typeof v === 'string' && re.test(v))) return false;
        break;
      }
      case '$options':
        break;
      case '$size':
        if (!values.some((v) => Array.isArray(v) && v.length === arg)) return false;
        break;
      case '$elemMatch':
        if (
          !values.some(
            (v) =>
              Array.isArray(v) &&
              v.some((item) =>
                isPlainObject(item)
                  ? matches(item, arg as Filter)
                  : matchOperators([item], arg as Record<string, unknown>),
              ),
          )
        )
          return false;
        break;
      case '$not':
        if (matchOperators(values, isPlainObject(arg) ? arg : { $regex: arg })) return false;
        break;
      default:
        throw new Error(`query-match: unsupported operator ${op}`);
    }
  }
  return true;
}

/** True when `doc` matches the MongoDB filter. */
export function matches(doc: unknown, filter: Filter): boolean {
  for (const [key, condition] of Object.entries(filter)) {
    if (key === '$or') {
      if (!(condition as Filter[]).some((f) => matches(doc, f))) return false;
      continue;
    }
    if (key === '$and') {
      if (!(condition as Filter[]).every((f) => matches(doc, f))) return false;
      continue;
    }
    if (key === '$nor') {
      if ((condition as Filter[]).some((f) => matches(doc, f))) return false;
      continue;
    }
    const values = valuesAt(doc, key);
    if (isPlainObject(condition) && Object.keys(condition).some((k) => k.startsWith('$'))) {
      if (!matchOperators(values, condition)) return false;
    } else if (!values.some((v) => equals(v, condition))) return false;
  }
  return true;
}

/** MongoDB's sort order: missing/null first ascending (last descending), numbers before strings. */
export function sortBy<T>(docs: T[], sort: Record<string, 1 | -1>): T[] {
  const keys = Object.entries(sort);
  const rank = (v: unknown) =>
    v === undefined || v === null ? 0 : typeof v === 'number' ? 1 : typeof v === 'string' ? 2 : 3;
  return docs.sort((a, b) => {
    for (const [key, dir] of keys) {
      const x = plain(valuesAt(a, key)[0]);
      const y = plain(valuesAt(b, key)[0]);
      const r = rank(x) - rank(y);
      const c =
        r !== 0
          ? r
          : x === y
            ? 0
            : rank(x) === 0
              ? 0
              : (x as number | string) < (y as number | string)
                ? -1
                : 1;
      if (c !== 0) return c * dir;
    }
    return 0;
  });
}

/** Keeps only the listed fields (inclusion projection) or drops the excluded ones; `_id` stays unless excluded. */
export function project<T extends Record<string, unknown>>(
  doc: T,
  projection?: Record<string, 0 | 1> | string,
): T {
  if (!projection) return doc;
  const spec: Record<string, 0 | 1> =
    typeof projection === 'string'
      ? Object.fromEntries(
          projection
            .split(/\s+/)
            .filter(Boolean)
            .map((f) => (f.startsWith('-') ? [f.slice(1), 0] : [f, 1])),
        )
      : projection;
  const includes = Object.entries(spec)
    .filter(([k, v]) => v && k !== '_id')
    .map(([k]) => k);
  if (includes.length) {
    const out: Record<string, unknown> = spec._id === 0 ? {} : { _id: doc._id };
    for (const path of includes) {
      const top = path.split('.')[0]!;
      if (top in doc) out[top] = doc[top];
    }
    return out as T;
  }
  const out = { ...doc };
  for (const [k, v] of Object.entries(spec)) if (!v) delete out[k];
  return out;
}
