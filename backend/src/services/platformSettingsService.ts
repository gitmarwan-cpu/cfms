import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';
import { encryptSecret, decryptSecret, DecryptionError } from '../utils/encryption';
import { recordAuditEvent } from './auditService';

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  senderEmail: string;
  senderName: string;
}

export interface PublicEmailSettings extends SmtpSettings {
  source: 'database' | 'environment' | 'none';
  status: 'active' | 'error' | 'unconfigured';
  errorDetail: 'decryption_failed' | 'database_unavailable' | 'migration_missing' | 'key_missing' | null;
  hasPassword: boolean;
  updatedAt: string | null;
}

export interface InternalSmtpCredentials extends SmtpSettings {
  source: 'database' | 'environment';
  password?: string;
}

const isTableMissingError = (error: any): boolean => {
  if (!error) return false;
  if (error.code === 'P2021') return true; // Prisma table does not exist
  if (error.code === '42P01') return true; // PostgreSQL undefined_table
  const message = String(error.message || '').toLowerCase();
  return (
    message.includes('does not exist') ||
    message.includes('relation "platform_settings" does not exist') ||
    message.includes('table "platform_settings" does not exist') ||
    message.includes('the table `public.platform_settings` does not exist')
  );
};

const readEnvSmtpSettings = (): { settings: SmtpSettings; password?: string } | null => {
  const host = process.env.SMTP_HOST?.trim();
  const username = (process.env.SMTP_USER || process.env.SMTP_USERNAME)?.trim();
  if (!host || !username) {
    return null;
  }

  const port = Number.parseInt(process.env.SMTP_PORT || '587', 10) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const senderEmail = (process.env.SMTP_FROM_EMAIL || username).trim();
  const senderName = (process.env.SMTP_FROM_NAME || 'نظام إدارة الشكاوى والمقترحات (CFMS)').trim();
  const password = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

  return {
    settings: {
      host,
      port,
      secure,
      username,
      senderEmail,
      senderName,
    },
    password: password || undefined,
  };
};

/**
 * Queries the platform_settings table, handling missing table vs DB connectivity failure.
 */
const queryPlatformSettingsCategory = async (category: string): Promise<{ row: any | null; tableMissing: boolean }> => {
  try {
    const client = prisma as any;
    if (typeof client.platform_settings?.findUnique === 'function') {
      const row = await client.platform_settings.findUnique({ where: { category } });
      return { row, tableMissing: false };
    }

    // Fallback to raw query if Prisma client delegate is not yet generated
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, category, settings, encrypted_secrets, created_at, updated_at
      FROM "platform_settings"
      WHERE "category" = ${category}
      LIMIT 1
    `;
    return { row: rows[0] || null, tableMissing: false };
  } catch (error: any) {
    if (isTableMissingError(error)) {
      return { row: null, tableMissing: true };
    }
    // General database connectivity/timeout errors must NEVER be caught as missing config
    console.error('[PlatformSettings] General database query error:', error.message);
    throw new ApiError(500, 'فشل الاتصال بقاعدة البيانات أثناء استرجاع إعدادات المنصة');
  }
};

/**
 * Retrieves platform email settings for administration UI.
 * Plaintext passwords and ciphertexts are never returned.
 */
export const getEmailSettings = async (): Promise<PublicEmailSettings> => {
  const { row, tableMissing } = await queryPlatformSettingsCategory('email');

  if (tableMissing) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_ENV_SMTP_FALLBACK !== 'true') {
      return {
        source: 'none',
        status: 'error',
        errorDetail: 'migration_missing',
        host: '',
        port: 587,
        secure: false,
        username: '',
        senderEmail: '',
        senderName: '',
        hasPassword: false,
        updatedAt: null,
      };
    }

    // In development or when explicit fallback is enabled:
    const envFallback = readEnvSmtpSettings();
    if (envFallback) {
      return {
        source: 'environment',
        status: 'active',
        errorDetail: null,
        ...envFallback.settings,
        hasPassword: Boolean(envFallback.password),
        updatedAt: null,
      };
    }

    return {
      source: 'none',
      status: 'unconfigured',
      errorDetail: null,
      host: '',
      port: 587,
      secure: false,
      username: '',
      senderEmail: '',
      senderName: '',
      hasPassword: false,
      updatedAt: null,
    };
  }

  // Database table exists
  if (row) {
    const parsedSettings: SmtpSettings = typeof row.settings === 'object' && row.settings !== null
      ? row.settings
      : (typeof row.settings === 'string' ? JSON.parse(row.settings) : {});

    let hasPassword = false;
    let errorDetail: PublicEmailSettings['errorDetail'] = null;
    let status: PublicEmailSettings['status'] = 'active';

    if (row.encrypted_secrets) {
      try {
        // Test decryptability without leaking the secret
        decryptSecret(row.encrypted_secrets);
        hasPassword = true;
      } catch (err) {
        hasPassword = true; // Secret exists, but cannot be decrypted with current key
        status = 'error';
        errorDetail = 'decryption_failed';
      }
    }

    return {
      source: 'database',
      status,
      errorDetail,
      host: parsedSettings.host || '',
      port: parsedSettings.port || 587,
      secure: Boolean(parsedSettings.secure),
      username: parsedSettings.username || '',
      senderEmail: parsedSettings.senderEmail || '',
      senderName: parsedSettings.senderName || '',
      hasPassword,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
  }

  // Row is null in database: use environment fallback
  const envFallback = readEnvSmtpSettings();
  if (envFallback) {
    return {
      source: 'environment',
      status: 'active',
      errorDetail: null,
      ...envFallback.settings,
      hasPassword: Boolean(envFallback.password),
      updatedAt: null,
    };
  }

  return {
    source: 'none',
    status: 'unconfigured',
    errorDetail: null,
    host: '',
    port: 587,
    secure: false,
    username: '',
    senderEmail: '',
    senderName: '',
    hasPassword: false,
    updatedAt: null,
  };
};

/**
 * Resolves active SMTP credentials for internal email dispatching.
 * Never silently falls back to .env when a database secret cannot be decrypted!
 */
export const getActiveSmtpCredentials = async (): Promise<InternalSmtpCredentials | null> => {
  const { row, tableMissing } = await queryPlatformSettingsCategory('email');

  if (tableMissing) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_ENV_SMTP_FALLBACK !== 'true') {
      console.error('[PlatformSettings] Outbound email blocked: platform_settings table missing in production');
      return null;
    }
    const envFallback = readEnvSmtpSettings();
    if (envFallback) {
      return { source: 'environment', ...envFallback.settings, password: envFallback.password };
    }
    return null;
  }

  if (row) {
    const parsedSettings: SmtpSettings = typeof row.settings === 'object' && row.settings !== null
      ? row.settings
      : (typeof row.settings === 'string' ? JSON.parse(row.settings) : {});

    let password: string | undefined;

    if (row.encrypted_secrets) {
      try {
        password = decryptSecret(row.encrypted_secrets);
      } catch (err: any) {
        // STRICT RULE: Never fall back to environment variables when DB secret decryption fails!
        console.error('[PlatformSettings] Critical: Decryption failure for stored SMTP credentials. Key mismatch or corrupted secret.');
        throw new DecryptionError('فشل فك تشفير كلمة مرور خادم البريد: يرجى التحقق من مفتاح التشفير أو إعادة تعيين كلمة المرور من لوحة الإدارة');
      }
    }

    return {
      source: 'database',
      ...parsedSettings,
      password,
    };
  }

  // Row is null in DB
  const envFallback = readEnvSmtpSettings();
  if (envFallback) {
    return { source: 'environment', ...envFallback.settings, password: envFallback.password };
  }

  return null;
};

export interface UpdateEmailSettingsInput {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  senderEmail: string;
  senderName?: string;
  password?: string;
}

/**
 * Updates platform email settings. Preserves existing password if empty or omitted.
 */
export const updateEmailSettings = async (
  input: UpdateEmailSettingsInput,
  actorUserId?: number | null
): Promise<PublicEmailSettings> => {
  const { row, tableMissing } = await queryPlatformSettingsCategory('email');

  if (tableMissing) {
    throw new ApiError(500, 'جدول إعدادات المنصة غير موجود. يجب تطبيق هجرة قاعدة البيانات أولاً.');
  }

  const existingEncryptedSecret = row?.encrypted_secrets || null;
  let newEncryptedSecret = existingEncryptedSecret;
  let passwordUpdated = false;

  const trimmedPassword = (input.password || '').trim();
  if (trimmedPassword) {
    newEncryptedSecret = encryptSecret(trimmedPassword);
    passwordUpdated = true;
  } else if (!existingEncryptedSecret) {
    // If no existing secret in DB, import and encrypt password from env fallback if available
    const envFallback = readEnvSmtpSettings();
    if (!envFallback?.password) {
      throw new ApiError(400, 'كلمة المرور مطلوبة لتهيئة إعدادات البريد الإلكتروني للمرة الأولى');
    }
    newEncryptedSecret = encryptSecret(envFallback.password);
    passwordUpdated = true;
  }

  const settingsPayload: SmtpSettings = {
    host: input.host.trim(),
    port: Number(input.port),
    secure: Boolean(input.secure),
    username: input.username.trim(),
    senderEmail: input.senderEmail.trim(),
    senderName: (input.senderName || 'نظام إدارة الشكاوى والمقترحات (CFMS)').trim(),
  };

  const client = prisma as any;
  const now = new Date();

  let updatedRow: any;
  if (typeof client.platform_settings?.upsert === 'function') {
    updatedRow = await client.platform_settings.upsert({
      where: { category: 'email' },
      create: {
        category: 'email',
        settings: settingsPayload,
        encrypted_secrets: newEncryptedSecret,
        created_at: now,
        updated_at: now,
      },
      update: {
        settings: settingsPayload,
        encrypted_secrets: newEncryptedSecret,
        updated_at: now,
      },
    });
  } else {
    // Raw SQL upsert
    const serializedSettings = JSON.stringify(settingsPayload);
    const rows = await prisma.$queryRaw<any[]>`
      INSERT INTO "platform_settings" ("category", "settings", "encrypted_secrets", "created_at", "updated_at")
      VALUES ('email', ${serializedSettings}::jsonb, ${newEncryptedSecret}, ${now}, ${now})
      ON CONFLICT ("category") DO UPDATE
      SET "settings" = ${serializedSettings}::jsonb,
          "encrypted_secrets" = ${newEncryptedSecret},
          "updated_at" = ${now}
      RETURNING id, category, settings, encrypted_secrets, created_at, updated_at
    `;
    updatedRow = rows[0];
  }

  // Audit log
  await recordAuditEvent(prisma, {
    organizationId: null,
    actorUserId: actorUserId ?? null,
    action: 'platform.settings.updated',
    entityType: 'platform_settings',
    entityId: updatedRow?.id ?? null,
    metadata: {
      category: 'email',
      host: settingsPayload.host,
      port: settingsPayload.port,
      secure: settingsPayload.secure,
      senderEmail: settingsPayload.senderEmail,
      passwordUpdated,
    },
  });

  return {
    source: 'database',
    status: 'active',
    errorDetail: null,
    ...settingsPayload,
    hasPassword: Boolean(newEncryptedSecret),
    updatedAt: updatedRow?.updated_at ? new Date(updatedRow.updated_at).toISOString() : now.toISOString(),
  };
};
