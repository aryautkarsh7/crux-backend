import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { buildApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/db/connect.js';
import {
  resetTokenCache,
  isMessageCentralConfigured,
  getAuthToken,
  sendOtpMessageCentral,
  validateOtpMessageCentral,
} from '../src/lib/notify/message-central.js';

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;

async function call(method: string, url: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await app.inject({
    method: method as 'GET',
    url: `/api/v1${url}`,
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
    payload: opts.body as object | undefined,
  });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
}

const randomPhone = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;

describe('Message Central VerifyNow client & OTP flow', () => {
  const originalFetch = globalThis.fetch;

  before(async () => {
    await connectDatabase();
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    globalThis.fetch = originalFetch;
    await app.close();
    // Also stops the mongod this file started, so the test process can exit.
    await disconnectDatabase();
  });

  beforeEach(() => {
    resetTokenCache();
    globalThis.fetch = originalFetch;
  });

  test('Message Central token caching and API calls with mocked fetch', async () => {
    let tokenFetchCount = 0;
    const testPhone = '9876543210';
    const fakeToken = 'mocked-jwt-token-12345';
    const fakeVerificationId = 'ver-99887766';

    env.MSGCENTRAL_CUSTOMER_ID = 'CUST_TEST_123';
    env.MSGCENTRAL_BASE64_KEY = 'KEY_TEST_BASE64';

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlString = input.toString();
      if (urlString.includes('/auth/v1/authentication/token')) {
        tokenFetchCount++;
        return new Response(JSON.stringify({ responseCode: 200, token: fakeToken }), {
          status: 200,
        });
      }
      if (urlString.includes('/verification/v3/send')) {
        assert.equal(init?.headers && (init.headers as any).authToken, fakeToken);
        return new Response(
          JSON.stringify({ responseCode: 200, data: { verificationId: fakeVerificationId } }),
          { status: 200 },
        );
      }
      if (urlString.includes('/verification/v3/validateOtp')) {
        assert.equal(init?.headers && (init.headers as any).authToken, fakeToken);
        assert.ok(urlString.includes(`verificationId=${fakeVerificationId}`));
        assert.ok(urlString.includes('code=1234'));
        return new Response(
          JSON.stringify({
            responseCode: 200,
            data: { verificationStatus: 'VERIFICATION_COMPLETED' },
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch URL: ${urlString}`);
    };

    assert.equal(isMessageCentralConfigured(), true);

    const token1 = await getAuthToken();
    assert.equal(token1, fakeToken);

    // Second call should use cached token
    const token2 = await getAuthToken();
    assert.equal(token2, fakeToken);
    assert.equal(tokenFetchCount, 1);

    // Test send OTP
    const sendRes = await sendOtpMessageCentral(testPhone);
    assert.equal(sendRes.verificationId, fakeVerificationId);

    // Test validate OTP
    const valid = await validateOtpMessageCentral(testPhone, fakeVerificationId, '1234');
    assert.equal(valid, true);

    // Clean up env overrides
    delete env.MSGCENTRAL_CUSTOMER_ID;
    delete env.MSGCENTRAL_BASE64_KEY;
  });

  test('OTP request enforces 60s resend cooldown', async () => {
    const p = randomPhone();
    const first = await call('POST', '/auth/otp/request', { body: { phone: p } });
    assert.equal(first.status, 200);

    // Immediate second call should hit resend cooldown
    const second = await call('POST', '/auth/otp/request', { body: { phone: p } });
    assert.equal(second.status, 400);
    assert.equal(second.body.error, 'resend_cooldown');
    assert.match(second.body.message, /Please wait \d+ seconds/);
  });

  test('OTP verification enforces 4-digit code and max 5 attempts', async () => {
    const p = randomPhone();
    const req = await call('POST', '/auth/otp/request', { body: { phone: p } });
    assert.equal(req.status, 200);

    // 6-digit code should fail validation format
    const badFormat = await call('POST', '/auth/otp/verify', {
      body: { phone: p, code: '123456' },
    });
    assert.equal(badFormat.status, 400);
    assert.equal(badFormat.body.error, 'invalid_code');

    const wrongCode = req.body.devCode === '0000' ? '9999' : '0000';

    // 4 wrong attempts
    for (let i = 1; i <= 4; i++) {
      const wrong = await call('POST', '/auth/otp/verify', { body: { phone: p, code: wrongCode } });
      assert.equal(wrong.status, 401);
    }

    // 5th wrong attempt invalidates the challenge
    const fifthWrong = await call('POST', '/auth/otp/verify', {
      body: { phone: p, code: wrongCode },
    });
    assert.equal(fifthWrong.status, 401);
    assert.equal(fifthWrong.body.error, 'too_many_attempts');
  });

  test('OTP request fails closed in production if Message Central is not configured', async () => {
    delete env.MSGCENTRAL_CUSTOMER_ID;
    delete env.MSGCENTRAL_BASE64_KEY;
    env.isProduction = true;

    try {
      const p = randomPhone();
      const res = await call('POST', '/auth/otp/request', { body: { phone: p } });
      assert.equal(res.status, 500);
      assert.equal(res.body.error, 'otp_service_unavailable');
    } finally {
      env.isProduction = false;
    }
  });
});
