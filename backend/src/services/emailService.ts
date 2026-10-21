import nodemailer from 'nodemailer';
import type { Transporter, SendMailOptions } from 'nodemailer';
import { getActiveSmtpCredentials, type InternalSmtpCredentials } from './platformSettingsService';
import ApiError from '../utils/ApiError';

/**
 * Validates and normalizes the frontend application origin for password reset links.
 * In production, strictly requires a valid FRONTEND_URL.
 * Never uses untrusted request Host headers.
 */
export const validateFrontendUrl = (): string => {
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredUrl = process.env.FRONTEND_URL?.trim();

  if (isProduction && !configuredUrl) {
    throw new ApiError(500, 'متغير البيئة FRONTEND_URL مطلوب في البيئة الإنتاجية لإنشاء روابط الاسترداد');
  }

  const rawUrl = configuredUrl || process.env.CORS_ORIGIN || 'http://localhost:5173';

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ApiError(500, 'عنوان FRONTEND_URL غير صالح: يجب أن يكون رابطاً كاملاً يبدأ بـ http:// أو https://');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ApiError(500, 'بروتوكول FRONTEND_URL يجب أن يكون http أو https');
  }

  return parsed.origin;
};

/**
 * Maps Nodemailer errors to clean, localized Arabic messages without exposing
 * internal hostnames, stack traces, or credentials.
 */
export const sanitizeEmailError = (error: any): string => {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '');

  if (code === 'EAUTH' || message.includes('Invalid login') || message.includes('Username and Password not accepted')) {
    return 'فشل التحقق من اسم المستخدم أو كلمة المرور الخاصة بخادم البريد (Authentication Failed)';
  }

  if (code === 'ESOCKET' || code === 'ECONNREFUSED' || code === 'ECONNECTION') {
    return 'تعذر الاتصال بخادم البريد: يرجى التحقق من صحة عنوان الخادم والمنفذ (Connection Failed)';
  }

  if (code === 'ETIMEDOUT' || code === 'ETIME') {
    return 'انتهت مهلة الاتصال بخادم البريد (Connection Timed Out)';
  }

  if (code === 'EENVELOPE') {
    return 'تم رفض عنوان البريد المرسل أو المستلم من قبل خادم البريد (Envelope Rejected)';
  }

  return 'فشل إرسال البريد الإلكتروني. يرجى مراجعة إعدادات خادم البريد.';
};

/**
 * Creates a Nodemailer transport instance using the authoritative platform settings.
 * Validates host, port, security mode, and credentials.
 */
export const createSmtpTransporter = (credentials: InternalSmtpCredentials): Transporter => {
  if (!credentials.host || !credentials.username || !credentials.password) {
    throw new ApiError(503, 'إعدادات خادم البريد غير مكتملة (المضيف، اسم المستخدم، وكلمة المرور مطلوبة)');
  }

  const isGmail = credentials.host.toLowerCase().includes('gmail.com');
  const port = credentials.port || (credentials.secure ? 465 : 587);

  // STARTTLS configuration for port 587 (RFC 6409 standard for submission)
  const transportOptions: nodemailer.TransportOptions = {
    host: credentials.host,
    port,
    secure: credentials.secure, // true for port 465, false for 587
    auth: {
      user: credentials.username,
      pass: credentials.password,
    },
    requireTLS: !credentials.secure && port === 587,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  } as any;

  if (isGmail) {
    (transportOptions as any).service = undefined; // Rely on explicit host/port
  }

  return nodemailer.createTransport(transportOptions);
};

/**
 * Composes and dispatches a password-reset email to the recipient.
 * Awaits delivery synchronously within the request lifecycle to catch errors.
 * Never logs raw reset tokens or complete reset URLs.
 */
export const sendPasswordResetEmail = async (
  recipientEmail: string,
  resetToken: string,
  userId?: number
): Promise<{ accepted: boolean }> => {
  const credentials = await getActiveSmtpCredentials();
  if (!credentials) {
    console.warn(`[EmailService] Password reset requested for user id=${userId ?? 'unknown'}, but SMTP is not configured`);
    return { accepted: false };
  }

  const frontendUrl = validateFrontendUrl();
  const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

  const transporter = createSmtpTransporter(credentials);

  const fromAddress = credentials.senderName
    ? `"${credentials.senderName}" <${credentials.senderEmail}>`
    : credentials.senderEmail;

  const mailOptions: SendMailOptions = {
    from: fromAddress,
    to: recipientEmail.trim(),
    subject: 'إعادة تعيين كلمة المرور - نظام إدارة الشكاوى والمقترحات (CFMS)',
    text: [
      'مرحباً،',
      '',
      'تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابكم في نظام إدارة الشكاوى والمقترحات (CFMS).',
      'لاستكمال تعيين كلمة مرور جديدة، يرجى فتح الرابط التالي:',
      resetUrl,
      '',
      'ملاحظة: هذا الرابط صالح لمدة 60 دقيقة فقط ويمكن استخدامه لمرة واحدة.',
      'إذا لم تقم بطلب إعادة التعيين، يمكنك تجاهل هذه الرسالة بأمان.',
      '',
      'نظام إدارة الشكاوى والمقترحات (CFMS)',
    ].join('\n'),
    html: `
      <div dir="rtl" style="font-family: Arial, Tahoma, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #0e5f66; margin-top: 0;">إعادة تعيين كلمة المرور</h2>
        <p>مرحباً،</p>
        <p>تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابكم في <strong>نظام إدارة الشكاوى والمقترحات (CFMS)</strong>.</p>
        <p>يرجى النقر على الزر أدناه لتعيين كلمة مرور جديدة لحسابك:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #0e5f66; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
            تعيين كلمة مرور جديدة
          </a>
        </div>
        <p style="font-size: 0.9em; color: #666;">
          إذا واجهت مشكلة في النقر على الزر، يمكنك نسخ الرابط التالي ولصقه في متصفحك مباشرة:<br/>
          <a href="${resetUrl}" style="color: #0e5f66; word-break: break-all;">${resetUrl}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;" />
        <p style="font-size: 0.85em; color: #888;">
          • هذا الرابط صالح لمدة <strong>60 دقيقة</strong> فقط ولا يمكن استخدامه إلا لمرة واحدة.<br/>
          • إذا لم تكن قد طلبت استرداد كلمة المرور بنفسك، يمكنك تجاهل هذا البريد ولن يطرأ أي تغيير على حسابك.
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Password reset email accepted by SMTP for user id=${userId ?? 'unknown'} (messageId=${info.messageId})`);
    return { accepted: true };
  } catch (error: any) {
    const sanitized = sanitizeEmailError(error);
    console.error(`[EmailService] Password reset SMTP delivery failed for user id=${userId ?? 'unknown'}: ${error?.code || 'UNKNOWN'} - ${sanitized}`);
    throw new ApiError(502, sanitized);
  }
};

/**
 * Validates active email configuration for testing purposes.
 * In Phase 2, this function strictly validates configuration without calling sendMail()
 * or initiating network connections, keeping test email dispatch disabled.
 */
export const testEmailConnection = async (adminEmail: string): Promise<{ success: boolean; message: string }> => {
  if (!adminEmail) {
    throw new ApiError(400, 'البريد الإلكتروني لمدير المنصة غير محدد');
  }

  const credentials = await getActiveSmtpCredentials();
  if (!credentials) {
    throw new ApiError(503, 'إعدادات خادم البريد غير مهيأة أو غير متوفرة');
  }

  if (!credentials.host || !credentials.username || !credentials.password) {
    throw new ApiError(400, 'إعدادات خادم البريد غير مكتملة (تأكد من ضبط المضيف واسم المستخدم وكلمة المرور)');
  }

  // Phase 2: Configuration validated successfully, transport test kept disabled per policy
  return {
    success: true,
    message: `تم التحقق من اكتمال إعدادات خادم البريد بنجاح (${credentials.host}:${credentials.port}). اختبار الإرسال الفعلي معطل في هذه المرحلة بانتظار الاعتماد.`,
  };
};
