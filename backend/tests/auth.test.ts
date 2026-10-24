import { api, createTestUser, auth, relativeDate, today } from './helpers';

describe('POST /api/auth/otp/request', () => {
  it('issues an OTP and echoes the mock code in test mode', async () => {
    const res = await api().post('/api/auth/otp/request').send({ phone: '9876543210' });

    expect(res.status).toBe(200);
    expect(res.body.phone).toBe('9876543210');
    expect(res.body.expiresInSeconds).toBeGreaterThan(0);
    expect(res.body.debugCode).toMatch(/^\d{6}$/);
  });

  it('normalises the phone number before storing it', async () => {
    const res = await api()
      .post('/api/auth/otp/request')
      .send({ phone: '+91 98765 43210' });

    expect(res.status).toBe(200);
    expect(res.body.phone).toBe('9876543210');
  });

  it('rejects a missing phone number', async () => {
    const res = await api().post('/api/auth/otp/request').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a phone number that is too short', async () => {
    const res = await api().post('/api/auth/otp/request').send({ phone: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a phone number containing letters', async () => {
    const res = await api().post('/api/auth/otp/request').send({ phone: 'not-a-phone' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('invalidates the previous OTP when a new one is requested', async () => {
    const first = await api().post('/api/auth/otp/request').send({ phone: '9876543210' });
    await api().post('/api/auth/otp/request').send({ phone: '9876543210' });

    const res = await api()
      .post('/api/auth/otp/verify')
      .send({ phone: '9876543210', otp: first.body.debugCode });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_OTP');
  });
});

describe('POST /api/auth/otp/verify', () => {
  it('verifies the OTP and returns a token + user', async () => {
    const requested = await api().post('/api/auth/otp/request').send({ phone: '9876543210' });

    const res = await api()
      .post('/api/auth/otp/verify')
      .send({ phone: '9876543210', otp: requested.body.debugCode });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.phone).toBe('9876543210');
    expect(res.body.user.id).toEqual(expect.any(String));
  });

  it('creates the user on the first successful login', async () => {
    const user = await createTestUser('9000000001');

    expect(user.id).toEqual(expect.any(String));

    const me = await api().get('/api/auth/me').set(auth(user.token));
    expect(me.status).toBe(200);
    expect(me.body.user.phone).toBe('9000000001');
  });

  it('reuses the same user id on subsequent logins', async () => {
    const first = await createTestUser('9000000002');
    const second = await createTestUser('9000000002');

    expect(second.id).toBe(first.id);
  });

  it('rejects an incorrect OTP', async () => {
    await api().post('/api/auth/otp/request').send({ phone: '9876543210' });

    const res = await api()
      .post('/api/auth/otp/verify')
      .send({ phone: '9876543210', otp: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_OTP');
  });

  it('rejects an OTP that was already used', async () => {
    const requested = await api().post('/api/auth/otp/request').send({ phone: '9876543210' });
    const code = requested.body.debugCode;

    await api().post('/api/auth/otp/verify').send({ phone: '9876543210', otp: code });
    const second = await api()
      .post('/api/auth/otp/verify')
      .send({ phone: '9876543210', otp: code });

    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe('INVALID_OTP');
  });

  it('rejects an OTP for a phone number that never requested one', async () => {
    const res = await api()
      .post('/api/auth/otp/verify')
      .send({ phone: '9876543210', otp: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_OTP');
  });

  it('rejects a non-numeric OTP', async () => {
    await api().post('/api/auth/otp/request').send({ phone: '9876543210' });

    const res = await api()
      .post('/api/auth/otp/verify')
      .send({ phone: '9876543210', otp: 'abcdef' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/auth/me', () => {
  it('rejects a request without a token', async () => {
    const res = await api().get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a malformed token', async () => {
    const res = await api().get('/api/auth/me').set({ Authorization: 'Bearer nonsense' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a token signed with the wrong secret', async () => {
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign({ sub: 'some-id', phone: '9876543210' }, 'wrong-secret');

    const res = await api().get('/api/auth/me').set({ Authorization: `Bearer ${forged}` });

    expect(res.status).toBe(401);
  });
});

describe('health & 404', () => {
  it('reports healthy', async () => {
    const res = await api().get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns a structured 404 for unknown routes', async () => {
    const res = await api().get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('loan fixtures sanity', () => {
  it('computes a past and a future date correctly', () => {
    expect(relativeDate(-5) < today()).toBe(true);
    expect(relativeDate(5) > today()).toBe(true);
  });
});
