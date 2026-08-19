const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const fsPromises = fs.promises;
const ApiError = require('../utils/ApiError') as typeof import('../utils/ApiError').default;

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 3;
const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

const uploadDirectory = process.env.CFMS_UPLOAD_DIR || path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: (error: Error | null, destination?: string) => void) => {
    cb(null, uploadDirectory);
  },
  filename: (req: any, file: { mimetype: string }, cb: (error: Error | null, filename?: string) => void) => {
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = MIME_TO_EXTENSION[file.mimetype] || '';
    cb(null, `${Date.now()}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req: any, file: { mimetype: string }, cb: (error: Error | null, accept?: boolean) => void) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new ApiError(422, 'نوع الملف غير مدعوم. الأنواع المسموحة: JPG, PNG, WEBP, PDF'));
  }
  cb(null, true);
};

const hasValidFileSignature = async (file: { path: string; mimetype: string }): Promise<boolean> => {
  const header = await fsPromises.readFile(file.path, { encoding: null, flag: 'r' });
  if (file.mimetype === 'image/jpeg') return header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  if (file.mimetype === 'image/png') return header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (file.mimetype === 'image/webp') return header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP';
  if (file.mimetype === 'application/pdf') return header.subarray(0, 5).toString('ascii') === '%PDF-';
  return false;
};

export const validateUploadedFileSignatures = async (req: any, res: any, next: (error?: unknown) => void): Promise<void> => {
  const files = Array.isArray(req.files) ? req.files : [];
  try {
    const valid = await Promise.all(files.map(hasValidFileSignature));
    if (valid.every(Boolean)) {
      next();
      return;
    }
    await Promise.all(files.map((file: { path?: string }) => (file.path ? fsPromises.unlink(file.path).catch(() => undefined) : undefined)));
    next(new ApiError(422, 'محتوى أحد الملفات لا يطابق نوعه المعلن'));
  } catch {
    await Promise.all(files.map((file: { path?: string }) => (file.path ? fsPromises.unlink(file.path).catch(() => undefined) : undefined)));
    next(new ApiError(422, 'تعذر التحقق من محتوى الملفات المرفوعة'));
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILES } });

export default upload;
module.exports = upload;
module.exports.validateUploadedFileSignatures = validateUploadedFileSignatures;
