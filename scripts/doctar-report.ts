/**
 * Read-only report on what the Doctar directory would list: counts per city and specialty, skip reasons,
 * build time, peak memory and the size of the saved cold-start cache. Writes nothing, anywhere.
 *
 *   npm run doctar:report                    (DOCTAR_DB_URL and MONGODB_URI from backend/.env)
 *   DOCTAR_VERIFIED_ONLY=true npm run doctar:report
 *
 * Replaces the retired import-doctar.ts: Curxx no longer copies Doctar records, it reads them live
 * (src/modules/doctar).
 */
import 'dotenv/config';
import { gzipSync } from 'node:zlib';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { reloadCatalogue } from '../src/lib/catalogue-store.js';
import { buildIndex } from '../src/modules/doctar/directory.js';
import { mongoDoctarSource } from '../src/modules/doctar/source.js';

const line = (label: string, rows: Record<string, number>, top = 20) =>
  [
    `  ${label}:`,
    ...Object.entries(rows)
      .sort((a, b) => b[1] - a[1])
      .slice(0, top)
      .map(([k, n]) => `    ${String(n).padStart(7)}  ${k}`),
  ].join('\n');

async function main() {
  if (!process.env.MONGODB_URI || !env.DOCTAR_DB_URL)
    throw new Error('MONGODB_URI and DOCTAR_DB_URL must be set in backend/.env');
  // Curxx is only read (cities, specialties); no indexes or collections are created.
  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: false,
    autoCreate: false,
    serverSelectionTimeoutMS: 15_000,
  });
  const src = mongoDoctarSource(env.DOCTAR_DB_URL, {
    poolSize: env.DOCTAR_POOL_SIZE,
    timeoutMs: env.DOCTAR_TIMEOUT_MS,
  });
  try {
    await reloadCatalogue();
    console.log(
      `Doctar directory report (read-only) · ${env.DOCTAR_VERIFIED_ONLY ? 'admin-verified doctors only' : 'all doctors'} · page size ${env.DOCTAR_PAGE_SIZE}`,
    );
    const ix = await buildIndex(src);
    const r = ix.report!;
    const perCity: Record<string, number> = {};
    const perSpecialty: Record<string, number> = {};
    for (const d of ix.doctors) {
      perCity[d.city] = (perCity[d.city] ?? 0) + 1;
      perSpecialty[d.specialty] = (perSpecialty[d.specialty] ?? 0) + 1;
    }
    const hospitalsPerCity: Record<string, number> = {};
    for (const f of ix.facilities) hospitalsPerCity[f.city] = (hospitalsPerCity[f.city] ?? 0) + 1;
    const gz = gzipSync(
      Buffer.from(JSON.stringify({ doctors: ix.doctors, facilities: ix.facilities })),
    );
    console.log(
      `  Doctors listed: ${r.doctors} of ${r.scanned} scanned${r.capped ? ' (capped by DOCTAR_MAX_DOCTORS)' : ''} · hospitals: ${r.facilities}`,
    );
    console.log(
      `  Linked to a hospital page: ${ix.doctors.filter((d) => d.facilitySlug).length} · with weekly hours: ${ix.doctors.filter((d) => d.consultHours).length} · with gender: ${ix.doctors.filter((d) => d.gender).length} · Doctar-verified: ${ix.doctors.filter((d) => d.doctarVerified).length}`,
    );
    console.log(
      `  Build: ${r.seconds}s · peak memory ${r.peakRssMb} MB RSS / ${r.peakHeapMb} MB heap · cold-start cache ${(gz.length / 1e6).toFixed(1)} MB gzipped`,
    );
    console.log(line('Doctors per city', perCity, 30));
    console.log(line('Hospitals per city', hospitalsPerCity, 30));
    console.log(line('Top specialties', perSpecialty, 15));
    console.log(line('Doctors skipped', r.skippedDoctors));
    console.log(line('Hospitals skipped', r.skippedFacilities));
  } finally {
    await Promise.all([mongoose.disconnect(), src.close()]);
  }
}

main().catch((error) => {
  console.error(String(error?.message ?? error).replace(/mongodb(\+srv)?:\/\/\S+/g, '<uri>'));
  process.exit(1);
});
