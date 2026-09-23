import { createHash, randomInt } from 'node:crypto';
import { env } from '../../config/env.js';
import { HttpError, badRequest, conflict, unauthorized } from '../../lib/errors.js';
import { OtpModel } from '../../models/otp.model.js';
import { UserModel } from '../../models/user.model.js';

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

const hash = (code: string) => createHash('sha256').update(code).digest('hex');

export function normalisePhone(input: string) {
  const digits = input.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (!INDIAN_MOBILE.test(digits)) throw badRequest('Enter a valid 10-digit Indian mobile number', 'invalid_phone');
  return digits;
}

/**
 * Issues a one-time code. Until an SMS provider is connected the code is returned
 * in the response outside production so the app can complete the flow.
 */
export async function requestOtp(rawPhone: string, intent: 'login' | 'register' | 'any' = 'any') {
  const phone = normalisePhone(rawPhone);
  // Login and Register are separate screens: tell people early if they picked the wrong one.
  const existing = await UserModel.findOne({ phone }, { name: 1 }).lean();
  const registered = Boolean(existing?.name);
  if (intent === 'login' && !existing) throw new HttpError(404, 'No Curxx account uses this number yet. Create one — it takes 30 seconds.', 'not_registered');
  if (intent === 'register' && registered) throw conflict('This number already has a Curxx account. Log in instead.', 'already_registered');
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

  await OtpModel.findOneAndUpdate(
    { phone },
    { phone, codeHash: hash(code), attempts: 0, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    { upsert: true },
  );

  return { phone, registered, expiresInSeconds: OTP_TTL_MS / 1000, devCode: env.isProduction ? undefined : code };
}

/** Outside production any 6-digit code is accepted, so the flow works without SMS. */
export type Registration = { name: string; email?: string; gender?: 'female' | 'male' | 'other' | ''; dob?: Date };

export async function verifyOtp(rawPhone: string, code: string, registration?: Registration) {
  const phone = normalisePhone(rawPhone);
  if (!/^\d{6}$/.test(code)) throw badRequest('Enter the 6-digit code', 'invalid_code');

  const challenge = await OtpModel.findOne({ phone });
  const matches = challenge && challenge.expiresAt > new Date() && challenge.codeHash === hash(code);

  if (!matches && env.isProduction) {
    if (challenge && challenge.attempts + 1 >= MAX_ATTEMPTS) await OtpModel.deleteOne({ phone });
    else if (challenge) await OtpModel.updateOne({ phone }, { $inc: { attempts: 1 } });
    throw unauthorized('That code is incorrect or has expired');
  }

  await OtpModel.deleteOne({ phone });
  const existing = await UserModel.findOne({ phone }, { name: 1 }).lean();
  // Registration details are only applied to a new (or still nameless) account, never over an existing profile.
  const profile = registration && !existing?.name
    ? Object.fromEntries(Object.entries(registration).filter(([, v]) => v !== undefined && v !== ''))
    : {};
  const user = await UserModel.findOneAndUpdate(
    { phone },
    { $set: { lastLoginAt: new Date(), ...profile }, $setOnInsert: { phone } },
    { upsert: true, new: true },
  );

  return user!;
}
