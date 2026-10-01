# Curxx Backend

Node + TypeScript API for the Curxx healthcare app. Fastify, MongoDB (Mongoose), JWT auth.

## Quick start

```bash
npm install
cp .env.example .env     # then set JWT_SECRET
npm run seed             # specialties, doctors and 7 days of slots
npm run dev              # http://localhost:4000
```

No database install needed in development: if `MONGODB_URI` is empty, a local MongoDB is
downloaded once and started automatically, storing data in `.data/mongo`. For production set
`MONGODB_URI` to a MongoDB Atlas connection string.

## Project commands

```bash
npm run format
npm run format:check
npm run lint
npm run test
```

`npm run test` always uses the local `mongodb-memory-server` setup and clears `MONGODB_URI`.
It defaults to port `27018`; set `MONGODB_PORT=27019 npm run test` to use another port. Its
database name and local data directory default from that port and can also be overridden with
`MONGODB_DB` and `MONGODB_DATA_PATH`.

## Endpoints

| Method | Path                                              | Auth   | Purpose                                                                                |
| ------ | ------------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| GET    | `/health`                                         | –      | Liveness probe                                                                         |
| POST   | `/api/v1/auth/otp/request`                        | –      | Send a login code (returns `devCode` outside production)                               |
| POST   | `/api/v1/auth/otp/verify`                         | –      | Exchange the code for a 30-day JWT                                                     |
| GET    | `/api/v1/auth/me`                                 | Bearer | Current account                                                                        |
| PATCH  | `/api/v1/auth/me`                                 | Bearer | Update name / ABHA id                                                                  |
| GET    | `/api/v1/specialties`                             | –      | Specialty list                                                                         |
| GET    | `/api/v1/doctors`                                 | –      | Filter by `city`, `specialty`, `q`, `maxFee`, `minExperience`; `sort`, `page`, `limit` |
| GET    | `/api/v1/doctors/:slug`                           | –      | One doctor                                                                             |
| GET    | `/api/v1/doctors/:slug/slots`                     | –      | Open slots, filter by `mode` and `days`                                                |
| POST   | `/api/v1/slots/:id/hold`                          | Bearer | Reserve a slot for 8 minutes                                                           |
| POST   | `/api/v1/appointments`                            | Bearer | Book a held or open slot                                                               |
| GET    | `/api/v1/appointments`                            | Bearer | Your appointments                                                                      |
| PATCH  | `/api/v1/appointments/:id/cancel`                 | Bearer | Cancel and release the slot                                                            |
| GET    | `/api/v1/site/settings`                           | –      | Editable claims, links and images, by key                                              |
| GET    | `/api/v1/site/stats`                              | –      | Live counts (doctors, clinics, NABH, labs, tests, cities, average rating…)             |
| GET    | `/api/v1/content/:page[,page]`                    | –      | Editable page sections (FAQs, bands, cards, legal copy), keyed `page/section`          |
| GET    | `/api/v1/testimonials?audience=patient\|provider` | –      | Published testimonials                                                                 |
| GET    | `/api/v1/plans?audience=plus\|provider`           | –      | Curxx Plus and provider plans                                                          |
| GET    | `/api/v1/catalogue/routing`                       | –      | Cities, specialties, conditions, surgeries, facility types for website routing         |

## Editable website data

Cities, conditions, surgeries, site settings, page content, testimonials and plans live in MongoDB and are
edited in the admin panel. `db/data/*.ts` holds their seed copies: `syncCatalogue` upserts them on every
`DATA_VERSION` bump, skipping records flagged `managed` (created or edited in the admin). Routes read
cities, conditions and surgeries through `lib/catalogue-store.ts`, an in-memory copy reloaded every minute
and immediately after an admin edit.

## Sample data

The seed doctors, facilities, reviews and testimonials are generated examples, flagged `sample: true`. Unless
`SHOW_SAMPLE_DATA=true`, every public route leaves them out: only imported (`source`) and admin-added
(`managed`) records show, and the sync never writes, restores or deletes sample records. The rule is a
Mongoose plugin on the models (`lib/sample-data.ts`), so new routes get it for free; the admin panel, the
sync and the scripts see everything through `withSampleData`. Seeded marketing claims (site settings of
kind `claim`) also stay hidden until someone saves them in the admin. Tests run with sample data on.

## Doctar directory

Doctors and hospitals from Doctar are read live from Doctar's database (`DOCTAR_DB_URL`, read-only), not
copied into Curxx (`src/modules/doctar`):

- `directory.ts` builds a lean in-memory listing index (small projections, no bios) by paging through Doctar,
  rebuilds it every `DOCTAR_REFRESH_MINUTES` (default 60) and saves the last good copy gzipped in
  `directory_cache`, so a restart serves listings at once even if Doctar is down. Peak memory is logged.
- `mapping.ts` decides what's listed and how Doctar fields map to Curxx's doctor/facility shapes. Speciality
  and department names lose scraped place tails ("Oral Surgeon In Kolkata" → "Oral Surgeon", for any city
  Doctar or Curxx knows) and duplicates merge.
- `store.ts` (`Doctors`, `Facilities`) is what public routes read: Curxx's own records (MongoDB) plus the
  directory, with the same MongoDB filters and sorts (`lib/query-match.ts`).
- `detail.ts` reads a profile's page-only fields from Doctar, cached (`DOCTAR_DETAIL_TTL_SECONDS`).
- `cache.ts` writes and reads the saved copy (`directory_cache`) as a stream of JSON lines (one record per
  line, in ≤8 MB parts), never as one big string: one `JSON.stringify` of the index ran the server out of heap.
- Curxx-only settings (hide, rank, feature, booking, contact overrides) live in `doctar_overlays`, edited in
  the admin panel (Doctar directory, Rankings).
- While no copy is loaded, listings say "temporarily unavailable" and missing profiles answer 503, not 404.

Settings: `DOCTAR_VERIFIED_ONLY`, `DOCTAR_REFRESH_MINUTES`, `DOCTAR_PAGE_SIZE`, `DOCTAR_MAX_DOCTORS`,
`DOCTAR_TIMEOUT_MS`, `DOCTAR_DETAIL_TTL_SECONDS`, `DOCTAR_POOL_SIZE`, `DOCTAR_ENABLED=false`,
`DOCTAR_SHOW_FACILITY_PHOTOS` (default off: hospitals' own Doctar photos are hidden and the website shows
its placeholder; a photo set in the admin always shows) (see `config/env.ts`). `npm run doctar:report` prints what would be listed; `npm run doctar:remove-imports`
removes the copies left by the old import.

New accounts get a sample "demo locker" (records, consents, a made-up ABHA number) only with
`SHOW_SAMPLE_DATA` on. `npm run records:remove-demo -- --db <name>` counts demo records left from older
versions; add `--apply` to remove them (a JSON copy is saved first).

## Sign-in

Phone → 6-digit code → JWT. Codes are generated, hashed and expire in 5 minutes. Until an SMS
provider is connected, **any 6-digit code is accepted outside production**, and the generated code
comes back as `devCode`. To go live, plug a provider into `requestOtp` in
`src/modules/auth/auth.service.ts` and drop `devCode`; the strict path is already in place for
`NODE_ENV=production`.

## Notes on speed

- Fastify with JSON response schemas for fast serialization, plus gzip/brotli compression.
- Compound indexes matching the listing queries (`city + specialty + fee`, `city + specialty + experience`)
  and a text index for search.
- All reads use `.lean()`; catalogue responses carry `stale-while-revalidate` cache headers so the
  frontend and CDN can serve them without hitting the database.
- Booking claims a slot with one atomic `findOneAndUpdate`, so two patients can't take the same time.
- Expired holds are released automatically by a TTL index.

## Layout

```
src/
  config/env.ts        validated environment
  db/connect.ts        MongoDB connection (Atlas or local)
  db/seed.ts           specialties, doctors, slots
  models/              Mongoose schemas and indexes
  modules/auth/        OTP + JWT
  modules/doctors/     catalogue and availability
  modules/appointments/ holds, booking, cancellation
  lib/                 errors and the auth guard
  app.ts, server.ts    wiring and startup
```
