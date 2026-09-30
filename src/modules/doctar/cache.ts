/**
 * The cold-start copy of the Doctar directory: the last good index, gzipped into the Curxx DB
 * (directory_cache) and loaded at start-up, so a restart serves listings at once.
 * - Written and read as a stream of JSON lines (a header, then one record per line), so memory only ever
 *   holds a small piece of text and one gzip part. One JSON.stringify of the whole index (well over 100 MB
 *   of text for 62,000 doctors) ran V8 out of heap right after a build.
 * - Parts are stored as they fill and marked complete at the end: a save that stops half-way is never
 *   loaded, and the previous copy stays until the new one is complete.
 */
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { StringDecoder } from 'node:string_decoder';
import { createGunzip, createGzip } from 'node:zlib';
import type { BuildReport, Index } from './directory.js';
import type { DoctorDoc, FacilityDoc } from './mapping.js';
import { DirectoryCacheModel } from './models.js';

/** Copies in this format. The older copies (one JSON document, saved as "doctar-directory") are never read; the next save removes them. */
const CACHE_NAME = 'doctar-directory-v2';
const OLD_CACHE_NAMES = ['doctar-directory'];
const FORMAT = 2;
/** gzipped bytes per cache document (a MongoDB document is capped at 16 MB). */
export const CACHE_PART_BYTES = 8 * 1024 * 1024;
/**
 * Text handed to gzip at a time. Kept under V8's large-object size (128 KB; text with any character like
 * ’ or हि takes two bytes each), so each piece is freed by the quick young-generation GC. Measured on the
 * full directory: writing the copy adds ~45 MB this way, ~110 MB with 256 KB pieces.
 */
const CHUNK_CHARS = 32 * 1024;
/** Hundreds of times longer than a record (~1 KB): a longer line means the data isn't in this format, and it's refused before it grows. */
const MAX_LINE_CHARS = 1024 * 1024;

type Header = {
  format: number;
  builtAt: string;
  report: BuildReport | null;
  doctors: number;
  facilities: number;
};

/** The index as text, about 32 KB at a time: a header line, then one line per doctor, then per hospital. */
function* lines(ix: Index): Generator<Buffer> {
  let text = `${JSON.stringify({
    format: FORMAT,
    builtAt: ix.builtAt,
    report: ix.report,
    doctors: ix.doctors.length,
    facilities: ix.facilities.length,
  })}\n`;
  for (const records of [ix.doctors, ix.facilities])
    for (const record of records) {
      // JSON never contains a raw newline (it's escaped inside strings), so a line is exactly one record.
      text += `${JSON.stringify(record)}\n`;
      if (text.length >= CHUNK_CHARS) {
        yield Buffer.from(text);
        text = '';
      }
    }
  yield Buffer.from(text);
}

/**
 * Serialises and gzips the index as a stream, handing over parts of at most `partBytes` in order; the
 * next part is only produced once `savePart` has finished with the previous one.
 */
export async function writeIndexCache(
  ix: Index,
  savePart: (data: Buffer, part: number) => Promise<unknown>,
  partBytes = CACHE_PART_BYTES,
): Promise<{ parts: number; bytes: number }> {
  let parts = 0;
  let bytes = 0;
  let pending: Buffer[] = [];
  let size = 0;
  const flush = async () => {
    await savePart(Buffer.concat(pending, size), parts);
    parts += 1;
    pending = [];
    size = 0;
  };
  await pipeline(
    Readable.from(lines(ix), { highWaterMark: 1 }),
    createGzip(),
    async (gzipped: AsyncIterable<Buffer>) => {
      for await (const chunk of gzipped) {
        bytes += chunk.length;
        for (let at = 0; at < chunk.length;) {
          const piece = chunk.subarray(at, at + partBytes - size);
          pending.push(piece);
          size += piece.length;
          at += piece.length;
          if (size === partBytes) await flush();
        }
      }
      if (size || !parts) await flush();
    },
  );
  return { parts, bytes };
}

/** The index back from its parts (in order), one record at a time. Throws if the copy is damaged or incomplete. */
export async function readIndexCache(
  parts: AsyncIterable<Buffer> | Iterable<Buffer>,
): Promise<Index> {
  // (Assigned inside the callback below, so TypeScript must not narrow it to undefined here.)
  let header = undefined as Header | undefined;
  const doctors: DoctorDoc[] = [];
  const facilities: FacilityDoc[] = [];
  const take = (line: string) => {
    if (!line) return;
    if (!header) {
      header = JSON.parse(line) as Header;
      if (header?.format !== FORMAT) throw new Error('not a saved directory index');
    } else if (doctors.length < header.doctors) doctors.push(JSON.parse(line) as DoctorDoc);
    else facilities.push(JSON.parse(line) as FacilityDoc);
  };
  const decoder = new StringDecoder('utf8');
  let rest = '';
  await pipeline(
    Readable.from(parts, { highWaterMark: 1 }),
    createGunzip(),
    async (text: AsyncIterable<Buffer>) => {
      for await (const chunk of text) {
        const split = (rest + decoder.write(chunk)).split('\n');
        rest = split.pop()!;
        if (rest.length > MAX_LINE_CHARS) throw new Error('saved directory index is not in lines');
        for (const line of split) take(line);
      }
      take(rest + decoder.end());
    },
  );
  if (!header || doctors.length !== header.doctors || facilities.length !== header.facilities)
    throw new Error('saved directory index is incomplete');
  return {
    doctors,
    facilities,
    builtAt: new Date(header.builtAt),
    from: 'cache',
    report: header.report,
  };
}

/** Saves the index part by part. `partBytes` is only changed by tests. */
export async function saveCache(ix: Index, partBytes = CACHE_PART_BYTES) {
  const generation = ix.builtAt.getTime();
  // parts: 0 until every part is in, so a half-written copy is never loaded.
  const saved = await writeIndexCache(
    ix,
    (data, part) =>
      DirectoryCacheModel.updateOne(
        { name: CACHE_NAME, generation, part },
        { $set: { parts: 0, data, builtAt: ix.builtAt } },
        { upsert: true },
      ),
    partBytes,
  );
  await DirectoryCacheModel.updateMany(
    { name: CACHE_NAME, generation },
    { $set: { parts: saved.parts } },
  );
  await DirectoryCacheModel.deleteMany({
    $or: [
      { name: CACHE_NAME, generation: { $ne: generation } },
      { name: { $in: OLD_CACHE_NAMES } },
    ],
  });
  return saved;
}

/** The newest complete copy, read one part at a time; null when there is none. */
export async function loadCache(): Promise<Index | null> {
  const newest = await DirectoryCacheModel.findOne(
    { name: CACHE_NAME, parts: { $gt: 0 } },
    { generation: 1, parts: 1 },
  )
    .sort({ generation: -1 })
    .lean();
  if (!newest) return null;
  const filter = { name: CACHE_NAME, generation: newest.generation };
  if ((await DirectoryCacheModel.countDocuments(filter)) !== newest.parts) return null;
  const rows = DirectoryCacheModel.find(filter, { part: 1, data: 1 })
    .sort({ part: 1 })
    .batchSize(1)
    .lean()
    .cursor();
  // lean() gives BSON Binary values, not Buffers.
  const bytes = (v: unknown) =>
    Buffer.isBuffer(v) ? v : Buffer.from((v as { buffer: Uint8Array }).buffer);
  return readIndexCache(
    (async function* () {
      for await (const row of rows) yield bytes(row.data);
    })(),
  );
}
