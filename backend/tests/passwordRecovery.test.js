'use strict';

const bcrypt = require('bcryptjs');
const request = require('supertest');
const { default: app } = require('../src/app');
const { default: prisma } = require('../src/prisma/client');
const {
  issuePasswordResetToken,
  resetPasswordWithToken,
} = require('../src/services/passwordRecoveryService');
const { createUserWithRole, getDefaultOrg } = require('./setup');

const uniqueEmail = (label) => `${label}.${Date.now()}.${Math.random().toString(36).slice(2)}@cfms.local`;

describe('Password recovery foundation', () => {
  let user;

  beforeAll(async () => {
    const result = await createUserWithRole({
      fullName: 'مستخدم استرداد كلمة المرور',
      email: uniqueEmail('recovery'),
      roleCode: 'staff',
    }, 'Password123');
    user = result.user;
  });

  it('returns the same generic response for existing and nonexistent emails', async () => {
    const existing = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: user.email });
    const missing = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: uniqueEmail('missing') });

    expect(existing.status).toBe(200);
    expect(missing.status).toBe(200);
    expect(existing.body).toEqual(missing.body);
    expect(existing.body).not.toHaveProperty('token');
  });

  it('stores only a hash of a high-entropy reset token', async () => {
    const token = await issuePasswordResetToken(user.email);
    const row = await prisma.password_reset_tokens.findFirst({
      where: { user_id: user.id },
      orderBy: { created_at: 'desc' },
    });

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(row).toBeTruthy();
    expect(row.token_hash).not.toBe(token);
    expect(row.token_hash).toHaveLength(64);
    expect(row.consumed_at).toBeNull();
  });

  it('resets the password, consumes the token, and does not reactivate an inactive user', async () => {
    const token = await issuePasswordResetToken(user.email);
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'NewPassword123' });

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty('token');

    const updated = await prisma.users.findUnique({ where: { id: user.id } });
    expect(await bcrypt.compare('NewPassword123', updated.password_hash)).toBe(true);

    const consumed = await prisma.password_reset_tokens.findFirst({
      where: { user_id: user.id },
      orderBy: { created_at: 'desc' },
    });
    expect(consumed.consumed_at).toBeTruthy();

    await prisma.users.update({ where: { id: user.id }, data: { is_active: false } });
    const inactiveToken = await issuePasswordResetToken(user.email);
    await resetPasswordWithToken(inactiveToken, 'InactiveUser123');
    const inactive = await prisma.users.findUnique({ where: { id: user.id } });
    expect(inactive.is_active).toBe(false);
  });

  it('keeps valid login behavior after a successful reset', async () => {
    await prisma.users.update({ where: { id: user.id }, data: { is_active: true } });
    const token = await issuePasswordResetToken(user.email);
    await resetPasswordWithToken(token, 'LoginAfterReset123');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'LoginAfterReset123' });
    expect(login.status).toBe(200);
    expect(login.body.data).toHaveProperty('token');
  });

  it('rejects malformed, expired, consumed, and replayed tokens', async () => {
    const malformed = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'bad-token', newPassword: 'ValidPassword123' });
    expect(malformed.status).toBe(422);

    const expiredToken = await issuePasswordResetToken(user.email);
    await prisma.password_reset_tokens.updateMany({
      where: { user_id: user.id, consumed_at: null },
      data: { expires_at: new Date(Date.now() - 1000) },
    });
    const expired = await resetPasswordWithToken(expiredToken, 'ExpiredPassword123').catch((error) => error);
    expect(expired.statusCode).toBe(400);

    const token = await issuePasswordResetToken(user.email);
    await resetPasswordWithToken(token, 'ConsumedPassword123');
    const replay = await resetPasswordWithToken(token, 'ReplayPassword123').catch((error) => error);
    expect(replay.statusCode).toBe(400);
  });

  it('allows only one concurrent request to consume the same token', async () => {
    const token = await issuePasswordResetToken(user.email);
    const results = await Promise.allSettled([
      resetPasswordWithToken(token, 'ConcurrentPassword123'),
      resetPasswordWithToken(token, 'ConcurrentPassword456'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected.reason.statusCode).toBe(400);
  });

  it('rejects password-policy violations without consuming the token', async () => {
    const token = await issuePasswordResetToken(user.email);
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'short' });

    expect(response.status).toBe(422);
    const row = await prisma.password_reset_tokens.findFirst({
      where: { token_hash: require('crypto').createHash('sha256').update(token).digest('hex') },
    });
    expect(row.consumed_at).toBeNull();
  });

  it('allows only the configured recovery request rate', async () => {
    const responses = [];
    for (let i = 0; i < 6; i += 1) {
      responses.push(await request(app)
        .post('/api/auth/forgot-password')
        .set('X-Forwarded-For', `192.0.2.${i + 10}`)
        .send({ email: uniqueEmail(`rate-${i}`) }));
    }

    expect(responses.some((response) => response.status === 429)).toBe(true);
  });

  it('records recovery audit events without passwords or raw tokens', async () => {
    const token = await issuePasswordResetToken(user.email);
    await resetPasswordWithToken(token, 'AuditedPassword123');
    const rows = await prisma.audit_logs.findMany({
      where: {
        entity_id: user.id,
        action: 'user.password_reset',
      },
      orderBy: { created_at: 'desc' },
    });

    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(JSON.stringify(rows)).not.toContain('AuditedPassword123');
    expect(rows.every((row) => row.organization_id === null || row.organization_id === getDefaultOrg().id)).toBe(true);
  });
});
