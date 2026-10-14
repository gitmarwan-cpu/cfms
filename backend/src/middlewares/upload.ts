import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
const fsPromises = fs.promises;
import ApiError from '../utils/ApiError';

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

const TRACKED_UPLOAD_NAMES = Symbol('cfmsTrackedUploadNames');
const CLEANED_UPLOAD_NAMES = Symbol('cfmsCleanedUploadNames');
const CLEANED_REQUEST_UPLOADS = Symbol('cfmsCleanedRequestUploads');

type UploadRequest = {
  files?: unknown;
  [TRACKED_UPLOAD_NAMES]?: Set<string>;
  [CLEANED_REQUEST_UPLOADS]?: boolean;
};

const getOrCreateSet = (target: object, key: symbol): Set<string> => {
  const existing = (target as Record<symbol, unknown>)[key];
  if (existing instanceof Set) return existing as Set<string>;
  const created = new Set<string>();
  Object.defineProperty(target, key, { configurable: true, value: created });
  return created;
};

const cleanupStoredUploadNames = async (names: Iterable<string>, cleanedNames: Set<string>): Promise<void> => {
  const pendingNames = [...new Set(names)].filter((name) => {
    if (!name || cleanedNames.has(name)) return false;
    cleanedNames.add(name);
    return true;
  });

  await Promise.all(
    pendingNames.map((name) => {
      const storedPath = resolveStoredUploadPath(name);
      return storedPath ? fsPromises.unlink(storedPath).catch(() => undefined) : undefined;
    })
  );
};

export const cleanupUploadedFiles = async (files: unknown): Promise<void> => {
  if (!Array.isArray(files)) return;
  const cleanedNames = getOrCreateSet(files, CLEANED_UPLOAD_NAMES);
  const names = files.flatMap((file: any) => (typeof file?.filename === 'string' ? [file.filename] : []));
  await cleanupStoredUploadNames(names, cleanedNames);
};

export const cleanupRequestUploadedFiles = async (req: UploadRequest): Promise<void> => {
  if (req[CLEANED_REQUEST_UPLOADS]) return;
  req[CLEANED_REQUEST_UPLOADS] = true;

  const files = Array.isArray(req.files) ? req.files : [];
  const cleanedNames = getOrCreateSet(files, CLEANED_UPLOAD_NAMES);
  const trackedNames = req[TRACKED_UPLOAD_NAMES] || new Set<string>();
  const fileNames = files.flatMap((file: any) => (typeof file?.filename === 'string' ? [file.filename] : []));
  await cleanupStoredUploadNames([...trackedNames, ...fileNames], cleanedNames);
};

export const cleanupUploadedFilesOnError = (
  error: unknown,
  req: UploadRequest,
  res: unknown,
  next: (error?: unknown) => void
): void => {
  void cleanupRequestUploadedFiles(req).finally(() => next(error));
};

export const resolveStoredUploadPath = (storedFileName: string): string | null => {
  if (!storedFileName || storedFileName.includes('\0') || path.basename(storedFileName) !== storedFileName) {
    return null;
  }

  const uploadRoot = path.resolve(uploadDirectory);
  const resolvedPath = path.resolve(uploadRoot, storedFileName);
  const relativePath = path.relative(uploadRoot, resolvedPath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null;
  return resolvedPath;
};

const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: (error: Error | null, destination: string) => void) => {
    cb(null, uploadDirectory);
  },
  filename: (req: any, file: { mimetype: string }, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = MIME_TO_EXTENSION[file.mimetype] || '';
    const filename = `${Date.now()}-${uniqueSuffix}${ext}`;
    getOrCreateSet(req, TRACKED_UPLOAD_NAMES).add(filename);
    cb(null, filename);
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
    await cleanupUploadedFiles(req.files);
    next(new ApiError(422, 'محتوى أحد الملفات لا يطابق نوعه المعلن'));
  } catch {
    await cleanupUploadedFiles(req.files);
    next(new ApiError(422, 'تعذر التحقق من محتوى الملفات المرفوعة'));
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILES } });

export default upload;
