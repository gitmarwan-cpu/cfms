import crypto from 'node:crypto';
import ApiError from './ApiError';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // 96-bit IV recommended by NIST for GCM
const AUTH_TAG_LENGTH_BYTES = 16; // 128-bit authentication tag

export class DecryptionError extends Error {
  code: string;
  constructor(message: string, code = 'DECRYPTION_FAILED') {
    super(message);
    this.name = 'DecryptionError';
    this.code = code;
  }
}

/**
 * Validates and resolves the 32-byte (256-bit) encryption key on demand.
 * The application boot does not depend on this key unless an operation
 * explicitly encrypts or decrypts stored platform secrets.
 */
export const resolveEncryptionKey = (explicitKey?: string): Buffer => {
  const rawKey = (explicitKey ?? process.env.SETTINGS_ENCRYPTION_KEY ?? '').trim();
  if (!rawKey) {
    throw new ApiError(500, 'لم يتم ضبط مفتاح تشفير الإعدادات على الخادم (SETTINGS_ENCRYPTION_KEY is required)');
  }

  // 1. Try 64-character hexadecimal representation (32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }

  // 2. Try raw 32-byte UTF-8 string
  if (Buffer.byteLength(rawKey, 'utf8') === 32) {
    return Buffer.from(rawKey, 'utf8');
  }

  // 3. Try base64-encoded 32-byte key
  try {
    const fromBase64 = Buffer.from(rawKey, 'base64');
    if (fromBase64.length === 32) {
      return fromBase64;
    }
  } catch {
    // Ignore base64 parse failure, will throw below
  }

  throw new ApiError(500, 'مفتاح تشفير الإعدادات غير صالح: يجب أن يكون 32 بايت (256-bit) بصيغة hex من 64 خانة');
};

/**
 * Encrypts plaintext string using AES-256-GCM.
 * Returns formatted ciphertext string: "ivHex:authTagHex:ciphertextHex".
 */
export const encryptSecret = (plainText: string, keyBuffer?: Buffer): string => {
  if (typeof plainText !== 'string' || plainText.length === 0) {
    throw new ApiError(400, 'القيمة المراد تشفيرها يجب أن تكون نصاً غير فارغ');
  }

  const key = keyBuffer ?? resolveEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
};

/**
 * Decrypts an AES-256-GCM ciphertext payload ("ivHex:authTagHex:ciphertextHex").
 * Throws DecryptionError if the key does not match or the ciphertext is tampered.
 */
export const decryptSecret = (payload: string, keyBuffer?: Buffer): string => {
  if (typeof payload !== 'string' || !payload.includes(':')) {
    throw new DecryptionError('صيغة البيانات المشفرة غير صالحة', 'INVALID_CIPHERTEXT_FORMAT');
  }

  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new DecryptionError('صيغة البيانات المشفرة غير صالحة', 'INVALID_CIPHERTEXT_FORMAT');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  if (iv.length !== IV_LENGTH_BYTES || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new DecryptionError('أبعاد التشفير أو علامة التحقق غير مطابقة للمواصفات', 'INVALID_CIPHERTEXT_DIMENSIONS');
  }

  const key = keyBuffer ?? resolveEncryptionKey();

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error: any) {
    throw new DecryptionError('فشل فك تشفير البيانات: تعذر التحقق من صحة مفتاح التشفير أو سلامة البيانات', 'AUTH_TAG_MISMATCH');
  }
};
