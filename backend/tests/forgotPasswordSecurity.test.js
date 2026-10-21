'use strict';

const passwordRecoveryService = require('../src/services/passwordRecoveryService');
const emailService = require('../src/services/emailService');
const {
  forgotPassword,
  resolveForgotPasswordMinDelayMs,
  isDevResetLinkEnabled,
  DEFAULT_FORGOT_PASSWORD_DELAY_MS,
  MAX_FORGOT_PASSWORD_DELAY_MS,
} = require('../src/controllers/authController');

const invokeForgotPassword = (email = 'user@cfms.local') => {
  return new Promise((resolve) => {
    const req = { body: { email } };
    const res = {
      statusCode: null,
      payload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.payload = data;
        resolve({ req, res, next });
        return this;
      },
    };
    const next = jest.fn((err) => {
      resolve({ req, res, next, error: err });
    });

    forgotPassword(req, res, next);
  });
};

describe('Password Recovery Security Hardening (Isolated Unit Tests)', () => {
  let originalEnv;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    originalEnv = { ...process.env };
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('resolveForgotPasswordMinDelayMs configuration validation', () => {
    it('defaults to 0 in test environment when unset', () => {
      expect(resolveForgotPasswordMinDelayMs(undefined, 'test')).toBe(0);
      expect(resolveForgotPasswordMinDelayMs('', 'test')).toBe(0);
      expect(resolveForgotPasswordMinDelayMs('   ', 'test')).toBe(0);
    });

    it('defaults to DEFAULT_FORGOT_PASSWORD_DELAY_MS (750ms) in production/development when unset', () => {
      expect(resolveForgotPasswordMinDelayMs(undefined, 'production')).toBe(DEFAULT_FORGOT_PASSWORD_DELAY_MS);
      expect(resolveForgotPasswordMinDelayMs('', 'development')).toBe(DEFAULT_FORGOT_PASSWORD_DELAY_MS);
      expect(resolveForgotPasswordMinDelayMs('   ', 'production')).toBe(DEFAULT_FORGOT_PASSWORD_DELAY_MS);
    });

    it('accepts valid non-negative integer strings', () => {
      expect(resolveForgotPasswordMinDelayMs('1200', 'production')).toBe(1200);
      expect(resolveForgotPasswordMinDelayMs('0', 'production')).toBe(0);
      expect(resolveForgotPasswordMinDelayMs(' 500 ', 'production')).toBe(500);
      expect(resolveForgotPasswordMinDelayMs('300', 'test')).toBe(300);
    });

    it('rejects alphanumeric strings like 750abc and falls back to default', () => {
      expect(resolveForgotPasswordMinDelayMs('750abc', 'production')).toBe(DEFAULT_FORGOT_PASSWORD_DELAY_MS);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid FORGOT_PASSWORD_MIN_DELAY_MS configuration')
      );
      expect(resolveForgotPasswordMinDelayMs('750abc', 'test')).toBe(0);
    });

    it('rejects decimals, negatives, and non-numeric values and falls back to default', () => {
      expect(resolveForgotPasswordMinDelayMs('750.5', 'production')).toBe(DEFAULT_FORGOT_PASSWORD_DELAY_MS);
      expect(resolveForgotPasswordMinDelayMs('-100', 'production')).toBe(DEFAULT_FORGOT_PASSWORD_DELAY_MS);
      expect(resolveForgotPasswordMinDelayMs('invalid', 'production')).toBe(DEFAULT_FORGOT_PASSWORD_DELAY_MS);
    });

    it('clamps values exceeding MAX_FORGOT_PASSWORD_DELAY_MS (5000ms) to the upper bound', () => {
      expect(resolveForgotPasswordMinDelayMs('999999', 'production')).toBe(MAX_FORGOT_PASSWORD_DELAY_MS);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('exceeds maximum allowed limit')
      );
    });
  });

  describe('isDevResetLinkEnabled configuration validation', () => {
    it('strictly returns false in production regardless of ALLOW_DEV_RESET_LINK value', () => {
      expect(isDevResetLinkEnabled('true', 'production')).toBe(false);
      expect(isDevResetLinkEnabled('1', 'production')).toBe(false);
      expect(isDevResetLinkEnabled('TRUE', 'production')).toBe(false);
      expect(isDevResetLinkEnabled(undefined, 'production')).toBe(false);
    });

    it('returns true in non-production when ALLOW_DEV_RESET_LINK is explicitly enabled', () => {
      expect(isDevResetLinkEnabled('true', 'development')).toBe(true);
      expect(isDevResetLinkEnabled('1', 'development')).toBe(true);
      expect(isDevResetLinkEnabled(' true ', 'development')).toBe(true);
      expect(isDevResetLinkEnabled('true', 'test')).toBe(true);
      expect(isDevResetLinkEnabled('1', 'test')).toBe(true);
    });

    it('returns false in non-production when ALLOW_DEV_RESET_LINK is unset or not true', () => {
      expect(isDevResetLinkEnabled(undefined, 'development')).toBe(false);
      expect(isDevResetLinkEnabled('', 'development')).toBe(false);
      expect(isDevResetLinkEnabled('false', 'development')).toBe(false);
      expect(isDevResetLinkEnabled('0', 'development')).toBe(false);
      expect(isDevResetLinkEnabled('invalid', 'development')).toBe(false);
      expect(isDevResetLinkEnabled(undefined, 'test')).toBe(false);
    });
  });

  describe('forgotPassword handler response uniformity', () => {
    const GENERIC_SUCCESS_MESSAGE = 'إذا كان البريد الإلكتروني مرتبطاً بحساب، فسيتم إرسال تعليمات إعادة التعيين إليه';

    it('returns generic 200 response when account exists and email delivery succeeds', async () => {
      jest.spyOn(passwordRecoveryService, 'issuePasswordResetToken').mockResolvedValue('token-12345');
      const sendEmailSpy = jest.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValue({ accepted: true });

      const { res, next } = await invokeForgotPassword('exists@cfms.local');

      expect(res.statusCode).toBe(200);
      expect(res.payload).toEqual({
        success: true,
        message: GENERIC_SUCCESS_MESSAGE,
      });
      expect(sendEmailSpy).toHaveBeenCalledWith('exists@cfms.local', 'token-12345');
      expect(next).not.toHaveBeenCalled();
    });

    it('returns identical generic 200 response when account does not exist', async () => {
      jest.spyOn(passwordRecoveryService, 'issuePasswordResetToken').mockResolvedValue(null);
      const sendEmailSpy = jest.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValue({ accepted: true });

      const { res, next } = await invokeForgotPassword('missing@cfms.local');

      expect(res.statusCode).toBe(200);
      expect(res.payload).toEqual({
        success: true,
        message: GENERIC_SUCCESS_MESSAGE,
      });
      expect(sendEmailSpy).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('returns generic 200 response when email delivery fails (does not leak provider failure)', async () => {
      jest.spyOn(passwordRecoveryService, 'issuePasswordResetToken').mockResolvedValue('token-12345');
      jest.spyOn(emailService, 'sendPasswordResetEmail').mockRejectedValue(new Error('SMTP connection refused'));

      const { res, next } = await invokeForgotPassword('exists@cfms.local');

      expect(res.statusCode).toBe(200);
      expect(res.payload).toEqual({
        success: true,
        message: GENERIC_SUCCESS_MESSAGE,
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith('[Auth] Password reset email dispatch failed');
      expect(next).not.toHaveBeenCalled();
    });

    it('returns generic 200 response when token service throws (does not expose account existence via 500)', async () => {
      jest.spyOn(passwordRecoveryService, 'issuePasswordResetToken').mockRejectedValue(new Error('Database connection timeout'));
      const sendEmailSpy = jest.spyOn(emailService, 'sendPasswordResetEmail');

      const { res, next } = await invokeForgotPassword('user@cfms.local');

      expect(res.statusCode).toBe(200);
      expect(res.payload).toEqual({
        success: true,
        message: GENERIC_SUCCESS_MESSAGE,
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith('[Auth] Password reset token issuance failed');
      expect(sendEmailSpy).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('executes without artificial delay in test mode by default', async () => {
      delete process.env.FORGOT_PASSWORD_MIN_DELAY_MS;
      process.env.NODE_ENV = 'test';

      jest.spyOn(passwordRecoveryService, 'issuePasswordResetToken').mockResolvedValue(null);

      const start = Date.now();
      const { res } = await invokeForgotPassword('user@cfms.local');
      const duration = Date.now() - start;

      expect(res.statusCode).toBe(200);
      // In test mode, default floor is 0ms, so duration should be under 100ms
      expect(duration).toBeLessThan(100);
    });

    it('exposes resetUrl in development when ALLOW_DEV_RESET_LINK is explicitly enabled and email delivery fails', async () => {
      process.env.NODE_ENV = 'development';
      process.env.ALLOW_DEV_RESET_LINK = 'true';
      process.env.FRONTEND_URL = 'http://localhost:5173';

      jest.spyOn(passwordRecoveryService, 'issuePasswordResetToken').mockResolvedValue('token-dev-12345');
      jest.spyOn(emailService, 'sendPasswordResetEmail').mockRejectedValue(new Error('SMTP unreachable'));

      const { res, next } = await invokeForgotPassword('user@cfms.local');

      expect(res.statusCode).toBe(200);
      expect(res.payload.success).toBe(true);
      expect(res.payload.message).toBe(GENERIC_SUCCESS_MESSAGE);
      expect(res.payload.resetUrl).toBe('http://localhost:5173/reset-password?token=token-dev-12345');
      expect(res.payload.devResetUrl).toBe('http://localhost:5173/reset-password?token=token-dev-12345');
      expect(next).not.toHaveBeenCalled();
    });

    it('strictly never exposes resetUrl in production even if ALLOW_DEV_RESET_LINK is true and email delivery fails', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_DEV_RESET_LINK = 'true';
      process.env.FRONTEND_URL = 'https://cfms.example.com';

      jest.spyOn(passwordRecoveryService, 'issuePasswordResetToken').mockResolvedValue('token-prod-12345');
      jest.spyOn(emailService, 'sendPasswordResetEmail').mockRejectedValue(new Error('SMTP unreachable'));

      const { res, next } = await invokeForgotPassword('user@cfms.local');

      expect(res.statusCode).toBe(200);
      expect(res.payload).toEqual({
        success: true,
        message: GENERIC_SUCCESS_MESSAGE,
      });
      expect(res.payload.resetUrl).toBeUndefined();
      expect(res.payload.devResetUrl).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    });

    it('does not expose resetUrl when account does not exist even if ALLOW_DEV_RESET_LINK is true', async () => {
      process.env.NODE_ENV = 'development';
      process.env.ALLOW_DEV_RESET_LINK = 'true';

      jest.spyOn(passwordRecoveryService, 'issuePasswordResetToken').mockResolvedValue(null);
      const sendEmailSpy = jest.spyOn(emailService, 'sendPasswordResetEmail');

      const { res, next } = await invokeForgotPassword('missing@cfms.local');

      expect(res.statusCode).toBe(200);
      expect(res.payload).toEqual({
        success: true,
        message: GENERIC_SUCCESS_MESSAGE,
      });
      expect(res.payload.resetUrl).toBeUndefined();
      expect(sendEmailSpy).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('does not expose resetUrl in development when email delivery succeeds', async () => {
      process.env.NODE_ENV = 'development';
      process.env.ALLOW_DEV_RESET_LINK = 'true';

      jest.spyOn(passwordRecoveryService, 'issuePasswordResetToken').mockResolvedValue('token-dev-12345');
      jest.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValue({ accepted: true });

      const { res, next } = await invokeForgotPassword('user@cfms.local');

      expect(res.statusCode).toBe(200);
      expect(res.payload).toEqual({
        success: true,
        message: GENERIC_SUCCESS_MESSAGE,
      });
      expect(res.payload.resetUrl).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    });
  });
});
