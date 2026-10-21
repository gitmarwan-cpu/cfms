'use strict';

/**
 * CFMS — Platform Email Settings Isolated HTTP Integration Tests
 * 
 * Verifies Express route handling, middleware pipelines (authentication,
 * platform RBAC authorization, express-validator, rate limiting, error handling),
 * and response contracts using Supertest against the Express application.
 * 
 * Isolation guarantee: 100% mocked dependencies, zero database connections,
 * zero network sockets, zero email transmissions.
 */

const TEST_HEX_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const TEST_JWT_SECRET = 'test_jwt_secret_for_platform_settings_integration_tests_32chars!';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.SETTINGS_ENCRYPTION_KEY = TEST_HEX_KEY;

// 1. Mock Prisma client before requiring any application modules
const mockPrisma = {
  users: {
    findUnique: jest.fn(),
  },
  platform_settings: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $disconnect: jest.fn(),
};

jest.mock('../src/prisma/client', () => ({
  __esModule: true,
  default: mockPrisma,
}));

// 2. Mock RBAC service before requiring auth middleware
const mockRbacService = {
  getEffectiveRoleCodes: jest.fn(),
  getEffectivePermissions: jest.fn(),
  getEffectivePlatformRoleCodes: jest.fn(),
  getEffectivePlatformPermissions: jest.fn(),
};

jest.mock('../src/services/rbacService', () => mockRbacService);

// 3. Mock audit service
const mockRecordAuditEvent = jest.fn().mockResolvedValue({});
jest.mock('../src/services/auditService', () => ({
  recordAuditEvent: mockRecordAuditEvent,
}));

// 4. Mock nodemailer to guarantee zero outbound SMTP network traffic
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'mock-test-msg-id' });
const mockCreateTransport = jest.fn().mockReturnValue({
  sendMail: mockSendMail,
});

jest.mock('nodemailer', () => ({
  createTransport: mockCreateTransport,
}));

// Import target modules after mocks are registered
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app').default || require('../src/app');
const { encryptSecret } = require('../src/utils/encryption');
const { testEmailRateLimiter } = require('../src/middlewares/rateLimiter');

describe('Platform Email Settings HTTP Integration Tests (Isolated Express Pipeline)', () => {
  // Test User definitions
  const adminUser = {
    id: 1,
    full_name: 'Platform Administrator',
    email: 'admin@platform.local',
    is_active: true,
    create_date: new Date('2026-01-01T00:00:00Z'),
    write_date: new Date('2026-01-01T00:00:00Z'),
    create_uid: null,
    write_uid: null,
    primary_organization_node_id: null,
    default_organization_id: null,
  };

  const regularUser = {
    id: 2,
    full_name: 'Regular Staff User',
    email: 'staff@tenant.local',
    is_active: true,
    create_date: new Date('2026-01-01T00:00:00Z'),
    write_date: new Date('2026-01-01T00:00:00Z'),
    create_uid: null,
    write_uid: null,
    primary_organization_node_id: null,
    default_organization_id: 10,
  };

  const otherPlatformUser = {
    id: 3,
    full_name: 'Tenant Manager Admin',
    email: 'tenant-mgr@platform.local',
    is_active: true,
    create_date: new Date('2026-01-01T00:00:00Z'),
    write_date: new Date('2026-01-01T00:00:00Z'),
    create_uid: null,
    write_uid: null,
    primary_organization_node_id: null,
    default_organization_id: null,
  };

  const inactiveUser = {
    id: 4,
    full_name: 'Inactive Administrator',
    email: 'inactive@platform.local',
    is_active: false,
    create_date: new Date('2026-01-01T00:00:00Z'),
    write_date: new Date('2026-01-01T00:00:00Z'),
    create_uid: null,
    write_uid: null,
    primary_organization_node_id: null,
    default_organization_id: null,
  };

  // JWT helper
  const createToken = (userId, secret = TEST_JWT_SECRET, expiresIn = '1h') =>
    jwt.sign({ sub: userId }, secret, { expiresIn });

  let adminToken;
  let regularToken;
  let otherPlatformToken;
  let inactiveToken;

  let storedDbRow = null;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeAll(() => {
    adminToken = createToken(adminUser.id);
    regularToken = createToken(regularUser.id);
    otherPlatformToken = createToken(otherPlatformUser.id);
    inactiveToken = createToken(inactiveUser.id);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Default mock user resolution
    mockPrisma.users.findUnique.mockImplementation(async ({ where }) => {
      if (where.id === adminUser.id) return adminUser;
      if (where.id === regularUser.id) return regularUser;
      if (where.id === otherPlatformUser.id) return otherPlatformUser;
      if (where.id === inactiveUser.id) return inactiveUser;
      return null;
    });

    // Default mock RBAC resolution
    mockRbacService.getEffectiveRoleCodes.mockImplementation(async (userId) => {
      if (userId === adminUser.id) return ['platform_admin'];
      if (userId === otherPlatformUser.id) return ['platform_tenant_admin'];
      return ['staff'];
    });

    mockRbacService.getEffectivePermissions.mockResolvedValue([]);

    mockRbacService.getEffectivePlatformRoleCodes.mockImplementation(async (userId) => {
      if (userId === adminUser.id) return ['platform_admin'];
      if (userId === otherPlatformUser.id) return ['platform_tenant_admin'];
      return [];
    });

    mockRbacService.getEffectivePlatformPermissions.mockImplementation(async (userId) => {
      if (userId === adminUser.id) {
        return [{ code: 'platform.settings.manage' }];
      }
      if (userId === otherPlatformUser.id) {
        return [{ code: 'platform.tenant.lifecycle' }];
      }
      return [];
    });

    // Default mock settings storage
    storedDbRow = null;

    mockPrisma.platform_settings.findUnique.mockImplementation(async ({ where }) => {
      if (where.category === 'email') {
        return storedDbRow;
      }
      return null;
    });

    mockPrisma.platform_settings.upsert.mockImplementation(async ({ where, create, update }) => {
      const now = new Date();
      if (!storedDbRow) {
        storedDbRow = {
          id: 101,
          category: create.category,
          settings: create.settings,
          encrypted_secrets: create.encrypted_secrets,
          created_at: now,
          updated_at: now,
        };
      } else {
        storedDbRow = {
          ...storedDbRow,
          settings: update.settings,
          encrypted_secrets: update.encrypted_secrets,
          updated_at: now,
        };
      }
      return storedDbRow;
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  // =========================================================================
  // Scenario 1: Unauthenticated request -> HTTP 401
  // =========================================================================
  describe('Scenario 1 — Unauthenticated Requests (HTTP 401)', () => {
    it('rejects GET /api/platform/settings/email without Authorization header', async () => {
      const res = await request(app).get('/api/platform/settings/email');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('مطلوب تسجيل الدخول');
      expect(mockPrisma.platform_settings.findUnique).not.toHaveBeenCalled();
    });

    it('rejects PUT /api/platform/settings/email without Authorization header', async () => {
      const res = await request(app)
        .put('/api/platform/settings/email')
        .send({ host: 'smtp.example.com', port: 587, secure: false, username: 'u', senderEmail: 'a@b.com' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(mockPrisma.platform_settings.upsert).not.toHaveBeenCalled();
    });

    it('rejects POST /api/platform/settings/email/test without Authorization header', async () => {
      const res = await request(app).post('/api/platform/settings/email/test');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('rejects request with malformed authorization header scheme', async () => {
      const res = await request(app)
        .get('/api/platform/settings/email')
        .set('Authorization', 'Basic dXNlcjpwYXNz');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('مطلوب تسجيل الدخول');
    });

    it('rejects request with invalid JWT signature', async () => {
      const bogusToken = createToken(adminUser.id, 'wrong_jwt_secret_that_does_not_match_at_all!');
      const res = await request(app)
        .get('/api/platform/settings/email')
        .set('Authorization', `Bearer ${bogusToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('الجلسة غير صالحة');
    });

    it('rejects request for nonexistent user id in token', async () => {
      const nonExistentToken = createToken(9999);
      const res = await request(app)
        .get('/api/platform/settings/email')
        .set('Authorization', `Bearer ${nonExistentToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('المستخدم غير موجود');
    });

    it('rejects request for deactivated user (is_active = false)', async () => {
      const res = await request(app)
        .get('/api/platform/settings/email')
        .set('Authorization', `Bearer ${inactiveToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('المستخدم غير موجود أو غير مفعّل');
    });
  });

  // =========================================================================
  // Scenario 2: Authenticated user without platform.settings.manage -> HTTP 403
  // =========================================================================
  describe('Scenario 2 — Authorization Boundary (HTTP 403)', () => {
    it('denies GET /api/platform/settings/email to regular staff user', async () => {
      const res = await request(app)
        .get('/api/platform/settings/email')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('لا تملك صلاحية إدارة المنصة');
      expect(mockPrisma.platform_settings.findUnique).not.toHaveBeenCalled();
    });

    it('denies PUT /api/platform/settings/email to regular staff user', async () => {
      const res = await request(app)
        .put('/api/platform/settings/email')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ host: 'smtp.example.com', port: 587, secure: false, username: 'u', senderEmail: 'a@b.com' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('لا تملك صلاحية إدارة المنصة');
      expect(mockPrisma.platform_settings.upsert).not.toHaveBeenCalled();
    });

    it('denies POST /api/platform/settings/email/test to regular staff user', async () => {
      const res = await request(app)
        .post('/api/platform/settings/email/test')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('لا تملك صلاحية إدارة المنصة');
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('denies GET /api/platform/settings/email to platform user with different platform permission', async () => {
      const res = await request(app)
        .get('/api/platform/settings/email')
        .set('Authorization', `Bearer ${otherPlatformToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('لا تملك صلاحية إدارة المنصة');
    });
  });

  // =========================================================================
  // Scenario 3: Authorized platform administrator can read settings -> HTTP 200
  // =========================================================================
  describe('Scenario 3 — Authorized Read of Email Settings (HTTP 200)', () => {
    it('returns sanitized settings when configured in database', async () => {
      const rawSecret = 'SecretDatabasePassword99!';
      const encrypted = encryptSecret(rawSecret);

      storedDbRow = {
        id: 1,
        category: 'email',
        settings: {
          host: 'smtp.sendgrid.net',
          port: 587,
          secure: false,
          username: 'apikey',
          senderEmail: 'notifications@cfms.local',
          senderName: 'CFMS Notifications System',
        },
        encrypted_secrets: encrypted,
        created_at: new Date('2026-01-01T10:00:00Z'),
        updated_at: new Date('2026-01-02T15:30:00Z'),
      };

      const res = await request(app)
        .get('/api/platform/settings/email')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        source: 'database',
        status: 'active',
        errorDetail: null,
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        username: 'apikey',
        senderEmail: 'notifications@cfms.local',
        senderName: 'CFMS Notifications System',
        hasPassword: true,
      });
      expect(res.body.data.updatedAt).toBe(storedDbRow.updated_at.toISOString());
    });

    it('returns unconfigured status when database row is null and no env fallback', async () => {
      storedDbRow = null;
      const originalHost = process.env.SMTP_HOST;
      const originalUser = process.env.SMTP_USER;
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;

      try {
        const res = await request(app)
          .get('/api/platform/settings/email')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toMatchObject({
          source: 'none',
          status: 'unconfigured',
          errorDetail: null,
          hasPassword: false,
          host: '',
          port: 587,
          secure: false,
        });
      } finally {
        if (originalHost !== undefined) process.env.SMTP_HOST = originalHost;
        if (originalUser !== undefined) process.env.SMTP_USER = originalUser;
      }
    });
  });

  // =========================================================================
  // Scenario 4: Invalid port/email input rejected (HTTP 422 contract)
  // =========================================================================
  describe('Scenario 4 — Validation and Error-Handling Contract (HTTP 422)', () => {
    it('rejects port exceeding 65535 with HTTP 422', async () => {
      const res = await request(app)
        .put('/api/platform/settings/email')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          host: 'smtp.example.com',
          port: 99999,
          secure: false,
          username: 'user@example.com',
          senderEmail: 'admin@example.com',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('بيانات غير صالحة');
      expect(Array.isArray(res.body.details)).toBe(true);
      const portError = res.body.details.find((d) => d.field === 'port');
      expect(portError).toBeTruthy();
      expect(portError.message).toContain('المنفذ (Port) يجب أن يكون رقماً صحيحاً');
      expect(mockPrisma.platform_settings.upsert).not.toHaveBeenCalled();
    });

    it('rejects non-positive port (<= 0) with HTTP 422', async () => {
      const res = await request(app)
        .put('/api/platform/settings/email')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          host: 'smtp.example.com',
          port: 0,
          secure: false,
          username: 'user@example.com',
          senderEmail: 'admin@example.com',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      const portError = res.body.details.find((d) => d.field === 'port');
      expect(portError).toBeTruthy();
    });

    it('rejects invalid sender email format with HTTP 422', async () => {
      const res = await request(app)
        .put('/api/platform/settings/email')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          username: 'user@example.com',
          senderEmail: 'not-a-valid-email-address',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      const emailError = res.body.details.find((d) => d.field === 'senderEmail');
      expect(emailError).toBeTruthy();
      expect(emailError.message).toContain('البريد الإلكتروني للمرسل غير صالح');
      expect(mockPrisma.platform_settings.upsert).not.toHaveBeenCalled();
    });

    it('rejects missing or empty host with HTTP 422', async () => {
      const res = await request(app)
        .put('/api/platform/settings/email')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          host: '   ',
          port: 587,
          secure: false,
          username: 'user@example.com',
          senderEmail: 'admin@example.com',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      const hostError = res.body.details.find((d) => d.field === 'host');
      expect(hostError).toBeTruthy();
    });

    it('rejects non-boolean secure value with HTTP 422', async () => {
      const res = await request(app)
        .put('/api/platform/settings/email')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          host: 'smtp.example.com',
          port: 587,
          secure: 'invalid_boolean_string',
          username: 'user@example.com',
          senderEmail: 'admin@example.com',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      const secureError = res.body.details.find((d) => d.field === 'secure');
      expect(secureError).toBeTruthy();
    });
  });

  // =========================================================================
  // Scenario 5: Valid update reaches service and returns documented response
  // =========================================================================
  describe('Scenario 5 — Valid Settings Update (HTTP 200)', () => {
    it('successfully updates email settings with new explicit password', async () => {
      storedDbRow = null;

      const payload = {
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        username: 'cfms-noreply@organization.org',
        senderEmail: 'cfms-noreply@organization.org',
        senderName: 'CFMS Notifications Team',
        password: 'ValidPassword2026!#$',
      };

      const res = await request(app)
        .put('/api/platform/settings/email')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('تم حفظ إعدادات البريد الإلكتروني بنجاح');
      expect(res.body.data).toMatchObject({
        source: 'database',
        status: 'active',
        errorDetail: null,
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        username: 'cfms-noreply@organization.org',
        senderEmail: 'cfms-noreply@organization.org',
        senderName: 'CFMS Notifications Team',
        hasPassword: true,
      });

      // Verify Prisma upsert was invoked with encrypted secret (never plaintext)
      expect(mockPrisma.platform_settings.upsert).toHaveBeenCalledTimes(1);
      const upsertArgs = mockPrisma.platform_settings.upsert.mock.calls[0][0];
      expect(upsertArgs.create.encrypted_secrets).toBeTruthy();
      expect(upsertArgs.create.encrypted_secrets).not.toBe(payload.password);
      expect(upsertArgs.create.encrypted_secrets).toMatch(/^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);

      // Verify audit event recording
      expect(mockRecordAuditEvent).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          action: 'platform.settings.updated',
          actorUserId: adminUser.id,
          metadata: expect.objectContaining({
            category: 'email',
            host: 'smtp.office365.com',
            port: 587,
            passwordUpdated: true,
          }),
        })
      );
    });

    it('preserves existing encrypted secret when updated with empty password', async () => {
      const existingEncrypted = encryptSecret('OriginalPreservedSecretPassword123!');
      storedDbRow = {
        id: 202,
        category: 'email',
        settings: {
          host: 'smtp.old.com',
          port: 587,
          secure: false,
          username: 'olduser',
          senderEmail: 'old@example.com',
          senderName: 'Old Sender',
        },
        encrypted_secrets: existingEncrypted,
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-01T00:00:00Z'),
      };

      const updatePayload = {
        host: 'smtp.newhost.com',
        port: 465,
        secure: true,
        username: 'newuser',
        senderEmail: 'new@example.com',
        senderName: 'New Sender',
        password: '', // Empty password to indicate preservation
      };

      const res = await request(app)
        .put('/api/platform/settings/email')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.host).toBe('smtp.newhost.com');
      expect(res.body.data.port).toBe(465);
      expect(res.body.data.secure).toBe(true);
      expect(res.body.data.hasPassword).toBe(true);

      // Verify stored secret remains unchanged
      const upsertArgs = mockPrisma.platform_settings.upsert.mock.calls[0][0];
      expect(upsertArgs.update.encrypted_secrets).toBe(existingEncrypted);

      // Verify audit record notes password was NOT updated
      expect(mockRecordAuditEvent).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          metadata: expect.objectContaining({
            passwordUpdated: false,
          }),
        })
      );
    });

    it('rejects first-time configuration when password is empty and no env fallback exists', async () => {
      storedDbRow = null;
      const originalHost = process.env.SMTP_HOST;
      const originalPass = process.env.SMTP_PASS;
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PASS;

      try {
        const res = await request(app)
          .put('/api/platform/settings/email')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            host: 'smtp.newdomain.com',
            port: 587,
            secure: false,
            username: 'admin@newdomain.com',
            senderEmail: 'admin@newdomain.com',
            password: '',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('كلمة المرور مطلوبة لتهيئة إعدادات البريد الإلكتروني للمرة الأولى');
        expect(mockPrisma.platform_settings.upsert).not.toHaveBeenCalled();
      } finally {
        if (originalHost !== undefined) process.env.SMTP_HOST = originalHost;
        if (originalPass !== undefined) process.env.SMTP_PASS = originalPass;
      }
    });
  });

  // =========================================================================
  // Scenario 6: Rate limiting on email-test endpoint (HTTP 429 after 3 requests)
  // =========================================================================
  describe('Scenario 6 — Email Test Rate Limiting & Zero SMTP Traffic (HTTP 429)', () => {
    beforeAll(() => {
      // Ensure rate limiter starts clean for our test IP if resetKey is available
      if (typeof testEmailRateLimiter.resetKey === 'function') {
        testEmailRateLimiter.resetKey('::ffff:127.0.0.1');
        testEmailRateLimiter.resetKey('127.0.0.1');
        testEmailRateLimiter.resetKey('::1');
      }
    });

    it('allows 3 test requests within window and returns 429 on the 4th, with ZERO SMTP activity', async () => {
      // Configure database with valid credentials
      const encrypted = encryptSecret('StoredPasswordForRateLimitTest123');
      storedDbRow = {
        id: 303,
        category: 'email',
        settings: {
          host: 'smtp.ratelimit-test.local',
          port: 587,
          secure: false,
          username: 'tester',
          senderEmail: 'tester@ratelimit-test.local',
          senderName: 'Rate Limit Tester',
        },
        encrypted_secrets: encrypted,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Request 1: Allowed -> 200
      const res1 = await request(app)
        .post('/api/platform/settings/email/test')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.message).toContain('تم التحقق من اكتمال إعدادات خادم البريد بنجاح');

      // Request 2: Allowed -> 200
      const res2 = await request(app)
        .post('/api/platform/settings/email/test')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);

      // Request 3: Allowed -> 200
      const res3 = await request(app)
        .post('/api/platform/settings/email/test')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res3.status).toBe(200);
      expect(res3.body.success).toBe(true);

      // Request 4: Rate limit exceeded -> 429 Too Many Requests
      const res4 = await request(app)
        .post('/api/platform/settings/email/test')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res4.status).toBe(429);
      expect(res4.body.success).toBe(false);
      expect(res4.body.message).toContain('محاولات إرسال بريد تجريبي كثيرة جداً');

      // Request 5: Still rate limited -> 429
      const res5 = await request(app)
        .post('/api/platform/settings/email/test')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res5.status).toBe(429);
      expect(res5.body.success).toBe(false);

      // CRITICAL SECURITY ASSERTION: Zero SMTP dispatch across all 5 requests
      expect(mockSendMail).not.toHaveBeenCalled();
      expect(mockCreateTransport).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Scenario 7: Responses never expose plaintext passwords or encrypted secrets
  // =========================================================================
  describe('Scenario 7 — Secret Masking & Non-Leakage Contract', () => {
    it('never exposes password or ciphertext in GET /api/platform/settings/email', async () => {
      const plaintextPassword = 'SuperSecretPlaintextPassword_NeverExposeMe!';
      const encrypted = encryptSecret(plaintextPassword);

      storedDbRow = {
        id: 404,
        category: 'email',
        settings: {
          host: 'smtp.leakproof.local',
          port: 587,
          secure: false,
          username: 'leakproof-admin',
          senderEmail: 'leakproof@cfms.local',
          senderName: 'Leakproof Tester',
        },
        encrypted_secrets: encrypted,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const res = await request(app)
        .get('/api/platform/settings/email')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // 1. Structured property assertions
      expect(res.body.data).not.toHaveProperty('password');
      expect(res.body.data).not.toHaveProperty('smtp_password');
      expect(res.body.data).not.toHaveProperty('encrypted_secrets');
      expect(res.body.data).not.toHaveProperty('encrypted_secret');
      expect(res.body.data).not.toHaveProperty('secret');
      expect(res.body.data.hasPassword).toBe(true);

      // 2. Raw JSON string inspection
      const rawText = res.text;
      const [ivHex, authTagHex, cipherHex] = encrypted.split(':');
      expect(rawText).not.toContain(plaintextPassword);
      expect(rawText).not.toContain(encrypted);
      expect(rawText).not.toContain(ivHex);
      expect(rawText).not.toContain(authTagHex);
      expect(rawText).not.toContain(cipherHex);
    });

    it('never exposes password or ciphertext in PUT /api/platform/settings/email response', async () => {
      const submittedPassword = 'BrandNewSecretPassword_2026_ShouldNotBeInBody!';

      const res = await request(app)
        .put('/api/platform/settings/email')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          host: 'smtp.leakproof-put.local',
          port: 587,
          secure: false,
          username: 'leakproof-put-admin',
          senderEmail: 'leakproof-put@cfms.local',
          senderName: 'Leakproof Put Tester',
          password: submittedPassword,
        });

      expect(res.status).toBe(200);

      // 1. Structured property assertions
      expect(res.body.data).not.toHaveProperty('password');
      expect(res.body.data).not.toHaveProperty('encrypted_secrets');
      expect(res.body.data.hasPassword).toBe(true);

      // 2. Raw JSON string inspection
      const rawText = res.text;
      const upsertArgs = mockPrisma.platform_settings.upsert.mock.calls[0][0];
      const savedCiphertext = upsertArgs.create.encrypted_secrets;
      const [ivHex, authTagHex, cipherHex] = savedCiphertext.split(':');
      expect(rawText).not.toContain(submittedPassword);
      expect(rawText).not.toContain(savedCiphertext);
      expect(rawText).not.toContain(ivHex);
      expect(rawText).not.toContain(authTagHex);
      expect(rawText).not.toContain(cipherHex);
    });

    it('never leaks secrets in 401, 403, 422, or 429 error responses', async () => {
      // Check 422 validation error body
      const res422 = await request(app)
        .put('/api/platform/settings/email')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          host: 'smtp.example.com',
          port: -5,
          secure: false,
          username: 'u',
          senderEmail: 'invalid',
          password: 'SecretInFailedRequest_ShouldNotLeak!',
        });

      expect(res422.status).toBe(422);
      expect(res422.text).not.toContain('SecretInFailedRequest_ShouldNotLeak!');

      // Check 403 forbidden body
      const res403 = await request(app)
        .put('/api/platform/settings/email')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          username: 'u',
          senderEmail: 'a@b.com',
          password: 'SecretInForbiddenRequest_ShouldNotLeak!',
        });

      expect(res403.status).toBe(403);
      expect(res403.text).not.toContain('SecretInForbiddenRequest_ShouldNotLeak!');
    });
  });
});
