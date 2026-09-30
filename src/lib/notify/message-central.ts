import { env } from '../../config/env.js';

let cachedToken: { token: string; expiresAt: number } | null = null;

export function isMessageCentralConfigured(): boolean {
  return Boolean(env.MSGCENTRAL_CUSTOMER_ID?.trim() && env.MSGCENTRAL_BASE64_KEY?.trim());
}

export function resetTokenCache(): void {
  cachedToken = null;
}

export async function getAuthToken(): Promise<string> {
  const customerId = env.MSGCENTRAL_CUSTOMER_ID?.trim();
  const key = env.MSGCENTRAL_BASE64_KEY?.trim();
  const email = env.MSGCENTRAL_EMAIL?.trim() ?? '';
  const country = env.MSGCENTRAL_COUNTRY?.trim() || 'IN';

  if (!customerId || !key) {
    throw new Error(
      'Message Central credentials (MSGCENTRAL_CUSTOMER_ID, MSGCENTRAL_BASE64_KEY) are not configured',
    );
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token;
  }

  const url = new URL('https://cpaas.messagecentral.com/auth/v1/authentication/token');
  url.searchParams.set('customerId', customerId);
  url.searchParams.set('key', key);
  url.searchParams.set('scope', 'NEW');
  url.searchParams.set('country', country);
  if (email) url.searchParams.set('email', email);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { accept: '*/*' },
    signal: AbortSignal.timeout(10_000),
  });

  const data = (await res.json().catch(() => null)) as Record<string, any> | null;
  if (!res.ok || !data) {
    throw new Error(
      `Message Central token fetch failed (${res.status}): ${data?.message ?? 'Unknown error'}`,
    );
  }

  const token = data.token ?? data.authToken ?? data.data?.token ?? data.data?.authToken;
  if (!token || typeof token !== 'string') {
    throw new Error(`Message Central token response missing token property`);
  }

  // Cache token for 23 hours (token typically valid 24h)
  cachedToken = {
    token,
    expiresAt: now + 23 * 60 * 60 * 1000,
  };

  return token;
}

export async function sendOtpMessageCentral(phone: string): Promise<{ verificationId: string }> {
  const token = await getAuthToken();
  const countryCode = '91';

  const url = new URL('https://cpaas.messagecentral.com/verification/v3/send');
  url.searchParams.set('countryCode', countryCode);
  url.searchParams.set('mobileNumber', phone);
  url.searchParams.set('flowType', 'SMS');
  url.searchParams.set('type', 'OTP');
  url.searchParams.set('otpLength', '4');

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      authToken: token,
      accept: '*/*',
    },
    signal: AbortSignal.timeout(10_000),
  });

  const body = (await res.json().catch(() => null)) as Record<string, any> | null;
  const responseCode = body?.responseCode ?? body?.status;
  const verificationId = body?.data?.verificationId ?? body?.verificationId;

  if (!res.ok || (responseCode !== 200 && responseCode !== '200') || !verificationId) {
    throw new Error(
      `Message Central send OTP failed: ${body?.message ?? body?.data?.errorMessage ?? 'Unknown error'}`,
    );
  }

  return { verificationId: String(verificationId) };
}

export async function validateOtpMessageCentral(
  phone: string,
  verificationId: string,
  code: string,
): Promise<boolean> {
  const token = await getAuthToken();
  const customerId = env.MSGCENTRAL_CUSTOMER_ID?.trim() ?? '';
  const countryCode = '91';

  const url = new URL('https://cpaas.messagecentral.com/verification/v3/validateOtp');
  url.searchParams.set('countryCode', countryCode);
  url.searchParams.set('mobileNumber', phone);
  url.searchParams.set('verificationId', verificationId);
  url.searchParams.set('customerId', customerId);
  url.searchParams.set('code', code);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      authToken: token,
      accept: '*/*',
    },
    signal: AbortSignal.timeout(10_000),
  });

  const body = (await res.json().catch(() => null)) as Record<string, any> | null;
  const responseCode = body?.responseCode ?? body?.status;
  const status = body?.data?.verificationStatus ?? body?.verificationStatus;

  if (!res.ok) {
    return false;
  }

  if (
    (responseCode === 200 || responseCode === '200') &&
    (status === 'VERIFICATION_COMPLETED' || status === 'SUCCESS' || !status)
  ) {
    return true;
  }

  return false;
}
