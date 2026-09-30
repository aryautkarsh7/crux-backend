/**
 * Removes the doctors and hospitals copied in by the old import (scripts/import-doctar.ts, since removed; `source: 'doctar'`)
 * from a Curxx database. The website now reads them live from Doctar (src/modules/doctar), so the copies
 * are no longer used. Doctar itself is not touched.
 *
 *   npm run doctar:remove-imports                       (dry run: counts only)
 *   npm run doctar:remove-imports -- --db curxx-dev     (writes: --db must name the target database)
 *
 * - Every removed record is first saved to curxx-backup-doctar-imports-<db>-<time>/ (JSON), and nothing is
 *   deleted unless that file was written.
 * - A rank or "featured" the team gave an imported record moves to its overlay (doctar_overlays).
 * - Run a full backup of the database first as well.
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import mongoose from 'mongoose';
import { withSampleData } from '../src/lib/sample-data.js';
import { DoctorModel } from '../src/models/doctor.model.js';
import { FacilityModel } from '../src/models/facility.model.js';
import { DoctarOverlayModel } from '../src/modules/doctar/models.js';

const args = process.argv.slice(2);
const at = args.indexOf('--db');
const CONFIRM_DB = at === -1 ? undefined : args[at + 1];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });
  const target = mongoose.connection.db!.databaseName;
  const imported = { source: 'doctar' };
  const [doctors, facilities] = await withSampleData(() =>
    Promise.all([DoctorModel.find(imported).lean(), FacilityModel.find(imported).lean()]),
  );
  console.log(
    `Curxx database "${target}": ${doctors.length} imported doctors, ${facilities.length} imported hospitals/clinics.`,
  );
  if (!CONFIRM_DB) {
    console.log(`Dry run. To remove them: npm run doctar:remove-imports -- --db ${target}`);
    return;
  }
  if (CONFIRM_DB !== target)
    throw new Error(`Refusing to write: MONGODB_URI points at "${target}", not "${CONFIRM_DB}".`);
  if (!doctors.length && !facilities.length) return;

  const dir = join(
    process.cwd(),
    `curxx-backup-doctar-imports-${target}-${new Date().toISOString().replace(/[:.]/g, '-')}`,
  );
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'doctors.json'), JSON.stringify(doctors, null, 2));
  writeFileSync(join(dir, 'facilities.json'), JSON.stringify(facilities, null, 2));
  console.log(`Saved a copy to ${dir}`);

  // Team choices on the old copies carry over to the live records.
  const carried = [
    ...doctors.map((d) => ({ kind: 'doctor' as const, d })),
    ...facilities.map((d) => ({ kind: 'facility' as const, d })),
  ].filter(({ d }) => d.doctarId && (Number(d.rank) > 0 || (d as { featured?: boolean }).featured));
  for (const { kind, d } of carried) {
    await DoctarOverlayModel.updateOne(
      { kind, doctarId: String(d.doctarId) },
      {
        $set: {
          rank: Number(d.rank) || 0,
          featured: Boolean((d as { featured?: boolean }).featured),
          slug: d.slug,
          name: d.name,
        },
      },
      { upsert: true },
    );
  }
  if (carried.length)
    console.log(`Moved ranks/featured of ${carried.length} records to doctar_overlays.`);

  const [removedDoctors, removedFacilities] = await withSampleData(() =>
    Promise.all([DoctorModel.deleteMany(imported), FacilityModel.deleteMany(imported)]),
  );
  console.log(
    `Removed ${removedDoctors.deletedCount} doctors and ${removedFacilities.deletedCount} hospitals/clinics from "${target}".`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
