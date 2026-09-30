import { createHash, randomInt } from 'node:crypto';
import { env } from '../../config/env.js';
import { HttpError, badRequest, conflict, unauthorized } from '../../lib/errors.js';
import { OtpModel } from '../../models/otp.model.js';
import { UserModel } from '../../models/user.model.js';
import { isMessageCentralConfigured, sendOtpMessageCentral, validateOtpMessageCentral } from '../../lib/notify/message-central.js';

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

const hash = (code: string) => createHash('sha256').update(code).digest('hex');

export function normalisePhone(input: string) {
  const digits = input.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (!INDIAN_MOBILE.test(digits)) throw badRequest('Enter a valid 10-digit Indian mobile number', 'invalid_phone');
  return digits;
}

/**
 * Issues a 4-digit one-time code via Message Central VerifyNow API.
 * Outside production, if Message Central is not configured, a dev fallback code is returned.
 * In production, if Message Central is not configured, it fails closed.
 */
export async function requestOtp(rawPhone: string, intent: 'login' | 'register' | 'any' = 'any') {
  const phone = normalisePhone(rawPhone);

  const existing = await UserModel.findOne({ phone }, { name: 1 }).lean();
  const registered = Boolean(existing?.name);
  if (intent === 'login' && !existing) throw new HttpError(404, 'No Curxx account uses this number yet. Create one — it takes 30 seconds.', 'not_registered');
  if (intent === 'register' && registered) throw conflict('This number already has a Curxx account. Log in instead.', 'already_registered');

  const existingChallenge = await OtpModel.findOne({ phone }).lean();
  if (existingChallenge?.lastSentAt) {
    const elapsed = Date.now() - new Date(existingChallenge.lastSentAt).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      throw badRequest(`Please wait ${waitSeconds} seconds before requesting a new code`, 'resend_cooldown');
    }
  }

  const configured = isMessageCentralConfigured();

  if (configured) {
    const { verificationId } = await sendOtpMessageCentral(phone);

    await OtpModel.findOneAndUpdate(
      { phone },
      { phone, verificationId, lastSentAt: new Date(), attempts: 0, expiresAt: new Date(Date.now() + OTP_TTL_MS), $unset: { codeHash: 1 } },
      { upsert: true },
    );

    return { phone, registered, expiresInSeconds: OTP_TTL_MS / 1000 };
  } else if (!env.isProduction) {
    const code = String(randomInt(0, 10_000)).padStart(4, '0');

    await OtpModel.findOneAndUpdate(
      { phone },
      { phone, codeHash: hash(code), lastSentAt: new Date(), attempts: 0, expiresAt: new Date(Date.now() + OTP_TTL_MS), $unset: { verificationId: 1 } },
      { upsert: true },
    );

    return { phone, registered, expiresInSeconds: OTP_TTL_MS / 1000, devCode: code };
  } else {
    throw new HttpError(500, 'OTP service is not configured on the server', 'otp_service_unavailable');
  }
}

export type Registration = { name: string; email?: string; gender?: 'female' | 'male' | 'other' | ''; dob?: Date };

export async function verifyOtp(rawPhone: string, code: string, registration?: Registration) {
  const phone = normalisePhone(rawPhone);
  if (!/^\d{4}$/.test(code)) throw badRequest('Enter the 4-digit code', 'invalid_code');

  const challenge = await OtpModel.findOne({ phone });
  if (!challenge || challenge.expiresAt <= new Date()) {
    throw unauthorized('That code is incorrect or has expired');
  }

  if (challenge.attempts >= MAX_ATTEMPTS) {
    await OtpModel.deleteOne({ phone });
    throw unauthorized('Too many failed attempts. Please request a new code.', 'too_many_attempts');
  }

  let isValid = false;

  if (challenge.verificationId) {
    isValid = await validateOtpMessageCentral(phone, challenge.verificationId, code);
  } else if (challenge.codeHash) {
    isValid = challenge.codeHash === hash(code);
  }

  if (!isValid) {
    if (challenge.attempts + 1 >= MAX_ATTEMPTS) {
      await OtpModel.deleteOne({ phone });
      throw unauthorized('Too many failed attempts. Please request a new code.', 'too_many_attempts');
    } else {
      await OtpModel.updateOne({ phone }, { $inc: { attempts: 1 } });
      throw unauthorized('That code is incorrect or has expired');
    }
  }

  await OtpModel.deleteOne({ phone });
  const existing = await UserModel.findOne({ phone }, { name: 1 }).lean();

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
