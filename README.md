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

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | – | Liveness probe |
| POST | `/api/v1/auth/otp/request` | – | Send a login code (returns `devCode` outside production) |
| POST | `/api/v1/auth/otp/verify` | – | Exchange the code for a 30-day JWT |
| GET | `/api/v1/auth/me` | Bearer | Current account |
| PATCH | `/api/v1/auth/me` | Bearer | Update name / ABHA id |
| GET | `/api/v1/specialties` | – | Specialty list |
| GET | `/api/v1/doctors` | – | Filter by `city`, `specialty`, `q`, `maxFee`, `minExperience`; `sort`, `page`, `limit` |
| GET | `/api/v1/doctors/:slug` | – | One doctor |
| GET | `/api/v1/doctors/:slug/slots` | – | Open slots, filter by `mode` and `days` |
| POST | `/api/v1/slots/:id/hold` | Bearer | Reserve a slot for 8 minutes |
| POST | `/api/v1/appointments` | Bearer | Book a held or open slot |
| GET | `/api/v1/appointments` | Bearer | Your appointments |
| PATCH | `/api/v1/appointments/:id/cancel` | Bearer | Cancel and release the slot |

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
