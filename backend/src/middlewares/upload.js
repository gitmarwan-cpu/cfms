'use strict';

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 3;

/**
 * تنبيه أمني (تمت معالجته): سابقاً كان امتداد الملف المُخزَّن يُؤخذ مباشرة
 * من originalname الذي يرسله العميل (path.extname(file.originalname))،
 * بينما فحص النوع يعتمد فقط على file.mimetype (وهو أيضاً قيمة يُصرِّح بها
 * العميل في هيدر الطلب ولا تعكس محتوى الملف الفعلي). كان يمكن نظرياً
 * لملف يدّعي mimetype صورة أن يُخزَّن بامتداد عشوائي (.php, .html...) لأن
 * الامتداد مأخوذ من اسم الملف لا من النوع المُتحقَّق منه فعلاً.
 * الحل: امتداد التخزين يُشتق من خريطة ثابتة (mimetype -> extension)،
 * ويُتجاهل امتداد اسم الملف الأصلي كلياً عند بناء اسم التخزين.
 */
const MIME_TO_EXTENSION = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    // الامتداد يُشتق حصراً من MIME_TO_EXTENSION (خريطة ثابتة)، وليس من
    // اسم الملف الأصلي - يمنع تخزين ملف بامتداد غير متوقع عبر تسمية
    // العميل للملف بامتداد مغاير لنوعه المُعلَن.
    const ext = MIME_TO_EXTENSION[file.mimetype] || '';
    cb(null, `${Date.now()}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new ApiError(422, 'نوع الملف غير مدعوم. الأنواع المسموحة: JPG, PNG, WEBP, PDF'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILES },
});

module.exports = upload;
