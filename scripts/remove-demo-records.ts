/**
 * Removes the sample "demo locker" that older versions gave every new account (src/modules/me/demo-locker.ts):
 * the made-up prescriptions, lab reports and consents, and the made-up ABHA number. A patient's own uploads
 * and consents are never touched: only records and consents that match the demo set exactly, on accounts
 * that were given the demo locker.
 *
 *   npm run records:remove-demo -- --db curxx-dev            (dry run: counts only)
 *   npm run records:remove-demo -- --db curxx-dev --apply    (removes them)
 *
 * - --db is required and must match the database MONGODB_URI points at.
 * - With --apply, everything removed is first saved to curxx-backup-demo-records-<db>-<time>/ (JSON), and
 *   nothing is deleted unless that copy was written. Run a full backup of the database first as well.
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import mongoose from 'mongoose';
import { AccessGrantModel } from '../src/models/access-grant.model.js';
import { HealthRecordModel } from '../src/models/health-record.model.js';
import { UserModel } from '../src/models/user.model.js';
import { demoAbhaFor, demoLockerKeys } from '../src/modules/me/demo-locker.js';

const args = process.argv.slice(2);
const at = args.indexOf('--db');
const CONFIRM_DB = at === -1 ? undefined : args[at + 1];
const APPLY = args.includes('--apply');

async function main() {
  if (!CONFIRM_DB) throw new Error('Name the database: --db <name> (add --apply to remove).');
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15_000,
    autoIndex: false,
    autoCreate: false,
  });
  const target = mongoose.connection.db!.databaseName;
  if (CONFIRM_DB !== target)
    throw new Error(`Refusing: MONGODB_URI points at "${target}", not "${CONFIRM_DB}".`);

  const keys = demoLockerKeys();
  const users = await UserModel.find(
    { demoSeededAt: { $exists: true } },
    { phone: 1, abhaId: 1 },
  ).lean();
  const userIds = users.map((u) => u._id);
  const records = await HealthRecordModel.find({
    user: { $in: userIds },
    $or: keys.records.map((r) => ({ title: r.title, fileName: r.fileName })),
  }).lean();
  const grants = await AccessGrantModel.find({
    user: { $in: userIds },
    'grantee.name': { $in: keys.grantees },
  }).lean();
  const abhaUsers = users.filter((u) => u.abhaId && u.abhaId === demoAbhaFor(u.phone));
  console.log(
    `Curxx database "${target}": ${users.length} accounts were given the demo locker; ${records.length} demo records, ${grants.length} demo consents, ${abhaUsers.length} made-up ABHA numbers.`,
  );
  if (!APPLY) {
    console.log(`Dry run, nothing changed. To remove them add --apply.`);
    return;
  }
  if (!records.length && !grants.length && !abhaUsers.length) return;

  const dir = join(
    process.cwd(),
    `curxx-backup-demo-records-${target}-${new Date().toISOString().replace(/[:.]/g, '-')}`,
  );
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'healthrecords.json'), JSON.stringify(records, null, 2));
  writeFileSync(join(dir, 'accessgrants.json'), JSON.stringify(grants, null, 2));
  writeFileSync(
    join(dir, 'abha-ids.json'),
    JSON.stringify(
      abhaUsers.map((u) => ({ _id: u._id, abhaId: u.abhaId })),
      null,
      2,
    ),
  );
  console.log(`Saved a copy to ${dir}`);

  const [r, g, a] = await Promise.all([
    HealthRecordModel.deleteMany({ _id: { $in: records.map((x) => x._id) } }),
    AccessGrantModel.deleteMany({ _id: { $in: grants.map((x) => x._id) } }),
    UserModel.updateMany({ _id: { $in: abhaUsers.map((u) => u._id) } }, { $set: { abhaId: '' } }),
  ]);
  // demoSeededAt stays, so these accounts are never seeded again.
  console.log(
    `Removed ${r.deletedCount} records and ${g.deletedCount} consents; cleared ${a.modifiedCount} ABHA numbers.`,
  );
}

main()
  .catch((error) => {
    console.error(String(error?.message ?? error).replace(/mongodb(\+srv)?:\/\/\S+/g, '<uri>'));
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
