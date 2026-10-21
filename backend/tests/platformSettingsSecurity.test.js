'use strict';

/**
 * CFMS — Platform Settings & Email Security Tests
 * Fully isolated unit test suite: 100% mocked dependencies, zero database or network connections.
 */

// 1. Mock Prisma client before requiring any service
const mockPrisma = {
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

// 2. Mock audit service
jest.mock('../src/services/auditService', () => ({
  recordAuditEvent: jest.fn().mockResolvedValue({}),
}));

// 3. Mock nodemailer
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'mock-msg-id-123' });
const mockCreateTransport = jest.fn().mockReturnValue({
  sendMail: mockSendMail,
});

jest.mock('nodemailer', () => ({
  createTransport: mockCreateTransport,
}));

// Import target modules after mocks are registered
const ApiError = require('../src/utils/ApiError').default || require('../src/utils/ApiError');
const {
  resolveEncryptionKey,
  encryptSecret,
  decryptSecret,
  DecryptionError,
} = require('../src/utils/encryption');

const platformSettingsService = require('../src/services/platformSettingsService');
const emailService = require('../src/services/emailService');

describe('Platform Settings & Email Security Hardening (Isolated Unit Tests)', () => {
  const TEST_HEX_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  let originalEnv;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.SETTINGS_ENCRYPTION_KEY = TEST_HEX_KEY;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  // =========================================================================
  // Section A: Encryption Utilities
  // =========================================================================
  describe('A. Encryption Utilities (encryption.ts)', () => {
    it('resolves valid 64-character hexadecimal key to 32 bytes Buffer', () => {
      const keyBuffer = resolveEncryptionKey(TEST_HEX_KEY);
      expect(Buffer.isBuffer(keyBuffer)).toBe(true);
      expect(keyBuffer.length).toBe(32);
      expect(keyBuffer.toString('hex')).toBe(TEST_HEX_KEY.toLowerCase());
    });

    it('resolves valid raw UTF-8 key of exactly 32 bytes to Buffer', () => {
      const utf8Key = '12345678901234567890123456789012'; // exactly 32 ASCII/UTF-8 bytes
      const keyBuffer = resolveEncryptionKey(utf8Key);
      expect(Buffer.isBuffer(keyBuffer)).toBe(true);
      expect(keyBuffer.length).toBe(32);
      expect(keyBuffer.toString('utf8')).toBe(utf8Key);
    });

    it('resolves valid Base64 key that decodes to exactly 32 bytes', () => {
      const raw32 = Buffer.from('abcdefghijklmnopqrstuvwxyz123456');
      const base64Key = raw32.toString('base64');
      const keyBuffer = resolveEncryptionKey(base64Key);
      expect(Buffer.isBuffer(keyBuffer)).toBe(true);
      expect(keyBuffer.length).toBe(32);
      expect(keyBuffer.equals(raw32)).toBe(true);
    });

    it('throws ApiError(500) when key is missing or blank', () => {
      delete process.env.SETTINGS_ENCRYPTION_KEY;
      expect(() => resolveEncryptionKey()).toThrow(ApiError);
      expect(() => resolveEncryptionKey('')).toThrow(ApiError);
      expect(() => resolveEncryptionKey('   ')).toThrow(ApiError);
    });

    it('throws ApiError(500) when key length or format is invalid', () => {
      // 63 hex characters (1 byte short)
      expect(() => resolveEncryptionKey('a'.repeat(63))).toThrow(ApiError);
      // 65 hex characters
      expect(() => resolveEncryptionKey('a'.repeat(65))).toThrow(ApiError);
      // 31 bytes UTF-8
      expect(() => resolveEncryptionKey('x'.repeat(31))).toThrow(ApiError);
      // 33 bytes UTF-8
      expect(() => resolveEncryptionKey('x'.repeat(33))).toThrow(ApiError);
      // Base64 that decodes to 16 bytes (AES-128, rejected)
      const base64_16 = Buffer.from('1234567890123456').toString('base64');
      expect(() => resolveEncryptionKey(base64_16)).toThrow(ApiError);
    });

    it('successfully encrypts and decrypts Arabic unicode strings round-trip', () => {
      const plainSecret = 'كلمة_سر_خادم_البريد_123!@#$%^&*()_+';
      const keyBuffer = resolveEncryptionKey(TEST_HEX_KEY);

      const ciphertext = encryptSecret(plainSecret, keyBuffer);
      expect(typeof ciphertext).toBe('string');
      expect(ciphertext.split(':').length).toBe(3);

      const decrypted = decryptSecret(ciphertext, keyBuffer);
      expect(decrypted).toBe(plainSecret);
    });

    it('generates unique initialization vectors (IVs) for identical plaintexts', () => {
      const plain = 'identical_password_value';
      const keyBuffer = resolveEncryptionKey(TEST_HEX_KEY);

      const c1 = encryptSecret(plain, keyBuffer);
      const c2 = encryptSecret(plain, keyBuffer);

      expect(c1).not.toBe(c2);
      expect(c1.split(':')[0]).not.toBe(c2.split(':')[0]); // IVs must differ
      expect(decryptSecret(c1, keyBuffer)).toBe(plain);
      expect(decryptSecret(c2, keyBuffer)).toBe(plain);
    });

    it('throws DecryptionError when ciphertext format is invalid (no colons or wrong part count)', () => {
      expect(() => decryptSecret('plain_text_with_no_colons')).toThrow(DecryptionError);
      expect(() => decryptSecret('part1:part2')).toThrow(DecryptionError);
      expect(() => decryptSecret('part1:part2:part3:part4')).toThrow(DecryptionError);
    });

    it('throws DecryptionError when IV or AuthTag dimensions are invalid', () => {
      const keyBuffer = resolveEncryptionKey(TEST_HEX_KEY);
      const badIv = '00'.repeat(8); // 8 bytes instead of 12
      const goodTag = '00'.repeat(16);
      const goodCipher = '00'.repeat(10);
      expect(() => decryptSecret(`${badIv}:${goodTag}:${goodCipher}`, keyBuffer)).toThrow(DecryptionError);

      const goodIv = '00'.repeat(12);
      const badTag = '00'.repeat(12); // 12 bytes instead of 16
      expect(() => decryptSecret(`${goodIv}:${badTag}:${goodCipher}`, keyBuffer)).toThrow(DecryptionError);
    });

    it('throws DecryptionError when ciphertext or auth tag is tampered', () => {
      const keyBuffer = resolveEncryptionKey(TEST_HEX_KEY);
      const validCipher = encryptSecret('sensitive_secret', keyBuffer);
      const parts = validCipher.split(':');

      // Tamper ciphertext
      const tamperedCipher = parts[2].slice(0, -2) + (parts[2].endsWith('a') ? 'b' : 'a');
      expect(() => decryptSecret(`${parts[0]}:${parts[1]}:${tamperedCipher}`, keyBuffer)).toThrow(DecryptionError);

      // Tamper auth tag
      const tamperedTag = (parts[1].startsWith('a') ? 'b' : 'a') + parts[1].slice(1);
      expect(() => decryptSecret(`${parts[0]}:${tamperedTag}:${parts[2]}`, keyBuffer)).toThrow(DecryptionError);
    });

    it('throws DecryptionError when attempting to decrypt with a different valid key', () => {
      const key1 = resolveEncryptionKey('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
      const key2 = resolveEncryptionKey('fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210');

      const cipher = encryptSecret('test_payload', key1);
      expect(() => decryptSecret(cipher, key2)).toThrow(DecryptionError);
    });

    it('demonstrates Base64 resolution behavior consistent with currently implemented resolver', () => {
      // 32-byte Base64 key
      const raw32 = Buffer.alloc(32, 0x41); // 32 'A's
      const b64 = raw32.toString('base64');
      const resolved = resolveEncryptionKey(b64);
      expect(resolved.length).toBe(32);

      // In Node.js Buffer.from(..., 'base64'), if length does not resolve to 32, it fails fast
      const b64Short = Buffer.from('too_short').toString('base64');
      expect(() => resolveEncryptionKey(b64Short)).toThrow(ApiError);
    });
  });

  // =========================================================================
  // Section B: Platform Settings Service
  // =========================================================================
  describe('B. Platform Settings Service (platformSettingsService.ts)', () => {
    it('preserves existing encrypted secret when password field is omitted or empty', async () => {
      const existingSecret = encryptSecret('existing_db_password');
      mockPrisma.platform_settings.findUnique.mockResolvedValue({
        id: 1,
        category: 'email',
        settings: {
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          username: 'admin@example.com',
          senderEmail: 'from@example.com',
          senderName: 'CFMS',
        },
        encrypted_secrets: existingSecret,
      });

      mockPrisma.platform_settings.upsert.mockResolvedValue({
        id: 1,
        category: 'email',
        settings: {},
        encrypted_secrets: existingSecret,
        updated_at: new Date(),
      });

      const updated = await platformSettingsService.updateEmailSettings(
        {
          host: 'smtp.newhost.com',
          port: 587,
          secure: false,
          username: 'new_user',
          senderEmail: 'new@example.com',
          password: '', // Blank password implies: keep existing secret
        },
        1
      );

      expect(mockPrisma.platform_settings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category: 'email' },
          create: expect.objectContaining({ encrypted_secrets: existingSecret }),
          update: expect.objectContaining({ encrypted_secrets: existingSecret }),
        })
      );
      expect(updated.hasPassword).toBe(true);
    });

    it('encrypts and persists environment fallback password on first-time settings creation when request password is blank', async () => {
      // Table exists, but no row for category 'email' in DB (first time setup)
      mockPrisma.platform_settings.findUnique.mockResolvedValue(null);

      // Set environment SMTP credentials
      process.env.SMTP_HOST = 'smtp.envfallback.com';
      process.env.SMTP_USER = 'env_user';
      process.env.SMTP_PASS = 'env_secret_password';

      let capturedUpsertPayload = null;
      mockPrisma.platform_settings.upsert.mockImplementation(({ create, update }) => {
        capturedUpsertPayload = { create, update };
        return Promise.resolve({
          id: 1,
          category: 'email',
          settings: create.settings,
          encrypted_secrets: create.encrypted_secrets,
          updated_at: new Date(),
        });
      });

      const updated = await platformSettingsService.updateEmailSettings(
        {
          host: 'smtp.dbhost.com',
          port: 587,
          secure: false,
          username: 'db_user',
          senderEmail: 'db@example.com',
          password: '', // Blank password on first setup with env fallback present
        },
        1
      );

      // Verifies the fix: newEncryptedSecret is NOT null; it encrypts the env fallback password
      expect(capturedUpsertPayload).not.toBeNull();
      const savedSecret = capturedUpsertPayload.create.encrypted_secrets;
      expect(savedSecret).toBeTruthy();
      expect(typeof savedSecret).toBe('string');
      expect(savedSecret.split(':').length).toBe(3);

      // Decrypting the saved secret recovers the environment fallback password
      const decrypted = decryptSecret(savedSecret, resolveEncryptionKey(TEST_HEX_KEY));
      expect(decrypted).toBe('env_secret_password');

      expect(updated.hasPassword).toBe(true);
    });

    it('encrypts explicit password over environment fallback password on first-time settings creation', async () => {
      mockPrisma.platform_settings.findUnique.mockResolvedValue(null);

      process.env.SMTP_HOST = 'smtp.envfallback.com';
      process.env.SMTP_USER = 'env_user';
      process.env.SMTP_PASS = 'env_secret_password';

      let capturedUpsertPayload = null;
      mockPrisma.platform_settings.upsert.mockImplementation(({ create, update }) => {
        capturedUpsertPayload = { create, update };
        return Promise.resolve({
          id: 1,
          category: 'email',
          settings: create.settings,
          encrypted_secrets: create.encrypted_secrets,
          updated_at: new Date(),
        });
      });

      await platformSettingsService.updateEmailSettings(
        {
          host: 'smtp.dbhost.com',
          port: 587,
          secure: false,
          username: 'db_user',
          senderEmail: 'db@example.com',
          password: 'explicit_override_password',
        },
        1
      );

      const savedSecret = capturedUpsertPayload.create.encrypted_secrets;
      const decrypted = decryptSecret(savedSecret, resolveEncryptionKey(TEST_HEX_KEY));
      expect(decrypted).toBe('explicit_override_password');
    });

    it('throws ApiError(400) on first-time creation when neither request nor environment supplies password', async () => {
      mockPrisma.platform_settings.findUnique.mockResolvedValue(null);

      delete process.env.SMTP_PASS;
      delete process.env.SMTP_PASSWORD;

      await expect(
        platformSettingsService.updateEmailSettings(
          {
            host: 'smtp.dbhost.com',
            port: 587,
            secure: false,
            username: 'db_user',
            senderEmail: 'db@example.com',
            password: '',
          },
          1
        )
      ).rejects.toThrow(ApiError);
    });

    it('throws DecryptionError and NEVER falls back to environment when DB secret decryption fails', async () => {
      process.env.SMTP_HOST = 'smtp.envfallback.com';
      process.env.SMTP_USER = 'env_user';
      process.env.SMTP_PASS = 'env_password';

      mockPrisma.platform_settings.findUnique.mockResolvedValue({
        id: 1,
        category: 'email',
        settings: {
          host: 'smtp.dbhost.com',
          port: 587,
          secure: false,
          username: 'db_user',
          senderEmail: 'db@example.com',
        },
        encrypted_secrets: 'tampered:ciphertext:value',
      });

      // getActiveSmtpCredentials MUST fail-closed with DecryptionError
      await expect(platformSettingsService.getActiveSmtpCredentials()).rejects.toThrow(DecryptionError);
    });

    it('handles missing-table error safely in production (reports migration_missing, no crash)', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_ENV_SMTP_FALLBACK;

      const tableMissingError = new Error('relation "platform_settings" does not exist');
      tableMissingError.code = '42P01';
      mockPrisma.platform_settings.findUnique.mockRejectedValue(tableMissingError);

      const settings = await platformSettingsService.getEmailSettings();
      expect(settings.status).toBe('error');
      expect(settings.errorDetail).toBe('migration_missing');
      expect(settings.source).toBe('none');

      const creds = await platformSettingsService.getActiveSmtpCredentials();
      expect(creds).toBeNull();
    });

    it('handles missing-table error with environment fallback in development or when explicit fallback enabled', async () => {
      process.env.NODE_ENV = 'development';
      process.env.SMTP_HOST = 'smtp.dev.com';
      process.env.SMTP_USER = 'dev_user';
      process.env.SMTP_PASS = 'dev_password';

      const tableMissingError = new Error('relation "platform_settings" does not exist');
      tableMissingError.code = '42P01';
      mockPrisma.platform_settings.findUnique.mockRejectedValue(tableMissingError);

      const settings = await platformSettingsService.getEmailSettings();
      expect(settings.source).toBe('environment');
      expect(settings.status).toBe('active');
      expect(settings.host).toBe('smtp.dev.com');

      const creds = await platformSettingsService.getActiveSmtpCredentials();
      expect(creds).not.toBeNull();
      expect(creds.source).toBe('environment');
      expect(creds.host).toBe('smtp.dev.com');
    });

    it('never exposes raw password or ciphertext in getEmailSettings return object', async () => {
      const secret = encryptSecret('top_secret_password');
      mockPrisma.platform_settings.findUnique.mockResolvedValue({
        id: 1,
        category: 'email',
        settings: {
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          username: 'user@example.com',
          senderEmail: 'from@example.com',
          senderName: 'CFMS',
        },
        encrypted_secrets: secret,
      });

      const publicSettings = await platformSettingsService.getEmailSettings();

      expect(publicSettings.hasPassword).toBe(true);
      expect(publicSettings.password).toBeUndefined();
      expect(publicSettings.encrypted_secrets).toBeUndefined();
      expect(JSON.stringify(publicSettings)).not.toContain('top_secret_password');
      expect(JSON.stringify(publicSettings)).not.toContain(secret);
    });
  });

  // =========================================================================
  // Section C: Email Service & Test Endpoint
  // =========================================================================
  describe('C. Email Service & Non-Sending Guarantees (emailService.ts)', () => {
    it('testEmailConnection validates configuration without creating transport or calling sendMail', async () => {
      mockPrisma.platform_settings.findUnique.mockResolvedValue({
        id: 1,
        category: 'email',
        settings: {
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          username: 'admin@example.com',
          senderEmail: 'from@example.com',
          senderName: 'CFMS',
        },
        encrypted_secrets: encryptSecret('my_smtp_password'),
      });

      const result = await emailService.testEmailConnection('admin@example.com');

      expect(result.success).toBe(true);
      expect(result.message).toContain('اختبار الإرسال الفعلي معطل');
      // Must NOT invoke nodemailer createTransport or sendMail
      expect(mockCreateTransport).not.toHaveBeenCalled();
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('sendPasswordResetEmail invokes mocked sendMail and never touches real transport', async () => {
      process.env.FRONTEND_URL = 'https://portal.cfms.gov.ye';

      mockPrisma.platform_settings.findUnique.mockResolvedValue({
        id: 1,
        category: 'email',
        settings: {
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          username: 'admin@example.com',
          senderEmail: 'from@example.com',
          senderName: 'CFMS',
        },
        encrypted_secrets: encryptSecret('my_smtp_password'),
      });

      const sendResult = await emailService.sendPasswordResetEmail('beneficiary@cfms.local', 'safe-token-xyz', 42);

      expect(sendResult.accepted).toBe(true);
      expect(mockCreateTransport).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'beneficiary@cfms.local',
          subject: expect.stringContaining('إعادة تعيين كلمة المرور'),
          text: expect.stringContaining('https://portal.cfms.gov.ye/reset-password?token=safe-token-xyz'),
        })
      );
    });
  });

  // =========================================================================
  // Section D: URL Safety
  // =========================================================================
  describe('D. URL Safety & Host Header Isolation (emailService.ts)', () => {
    it('strictly uses configured FRONTEND_URL in production environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.FRONTEND_URL = 'https://app.cfms.org';

      const origin = emailService.validateFrontendUrl();
      expect(origin).toBe('https://app.cfms.org');
    });

    it('cannot be overridden by request Host or X-Forwarded-Host headers', () => {
      // validateFrontendUrl accepts 0 arguments and reads strictly from process.env
      expect(emailService.validateFrontendUrl.length).toBe(0);
    });

    it('throws ApiError(500) in production when FRONTEND_URL is missing', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.FRONTEND_URL;

      expect(() => emailService.validateFrontendUrl()).toThrow(ApiError);
    });

    it('throws ApiError(500) when FRONTEND_URL protocol is not http or https', () => {
      process.env.FRONTEND_URL = 'ftp://malicious.org';
      expect(() => emailService.validateFrontendUrl()).toThrow(ApiError);

      process.env.FRONTEND_URL = 'javascript:alert(1)';
      expect(() => emailService.validateFrontendUrl()).toThrow(ApiError);
    });

    it('throws ApiError(500) when FRONTEND_URL is malformed', () => {
      process.env.FRONTEND_URL = 'not_a_valid_url';
      expect(() => emailService.validateFrontendUrl()).toThrow(ApiError);
    });
  });
});
