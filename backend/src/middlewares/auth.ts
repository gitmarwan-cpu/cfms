import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';
import { getEffectivePermissions, getEffectiveRoleCodes } from '../services/rbacService';

const INVALID_SESSION_MESSAGE = 'الجلسة غير صالحة أو منتهية، الرجاء تسجيل الدخول مجدداً';

const toSafeInteger = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const mapUser = (user: {
  id: number;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  org_unit_id: number | null;
  default_organization_id: number | null;
}) => ({
  id: user.id,
  fullName: user.full_name,
  email: user.email,
  isActive: user.is_active,
  createdAt: user.created_at,
  updatedAt: user.updated_at,
  orgUnitId: user.org_unit_id,
  defaultOrganizationId: user.default_organization_id,
});

const getJwtPayload = (token: string): { sub?: unknown } => {
  const jwt = require('jsonwebtoken');
  return jwt.verify(token, process.env.JWT_SECRET) as { sub?: unknown };
};

export const authenticate = async (req: any, res: any, next: (error?: unknown) => void): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'مطلوب تسجيل الدخول للوصول لهذا المورد');
    }

    const token = authHeader.split(' ')[1];
    const payload = getJwtPayload(token);
    const userId = toSafeInteger(payload.sub);
    const user = userId
      ? await prisma.users.findUnique({
          where: { id: userId },
          select: {
            id: true,
            full_name: true,
            email: true,
            is_active: true,
            created_at: true,
            updated_at: true,
            org_unit_id: true,
            default_organization_id: true,
          },
        })
      : null;

    if (!user || !user.is_active) {
      throw new ApiError(401, 'المستخدم غير موجود أو غير مفعّل');
    }

    const [roleCodes, permissions] = await Promise.all([
      getEffectiveRoleCodes(user.id),
      getEffectivePermissions(user.id),
    ]);

    req.user = { ...mapUser(user), roleCodes, permissions };
    next();
  } catch (error: any) {
    if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') {
      next(new ApiError(401, INVALID_SESSION_MESSAGE));
      return;
    }
    next(error);
  }
};

export const authorize = (...allowedRoles: string[]) => (req: any, res: any, next: (error?: unknown) => void): void => {
  if (!req.user || !req.user.roleCodes?.some((code: string) => allowedRoles.includes(code))) {
    next(new ApiError(403, 'لا تملك صلاحية الوصول لهذا المورد'));
    return;
  }
  next();
};

export const authorizePermission = (
  permissionCode: string,
  resolveOrgUnitId: ((req: any) => unknown) | null = null
) => (req: any, res: any, next: (error?: unknown) => void): void => {
  if (!req.user) {
    next(new ApiError(401, 'مطلوب تسجيل الدخول للوصول لهذا المورد'));
    return;
  }
  if (!req.organizationId) {
    next(new ApiError(500, 'خطأ داخلي: لم يتم تحديد سياق المؤسسة قبل التحقق من الصلاحية'));
    return;
  }

  const orgUnitId = resolveOrgUnitId ? Number(resolveOrgUnitId(req)) || null : null;
  const hasPermission = req.user.permissions?.some((permission: any) => {
    if (permission.code !== permissionCode) return false;
    if (permission.organizationId !== req.organizationId) return false;
    if (orgUnitId === null) return true;
    return permission.orgUnitId === null || permission.orgUnitId === orgUnitId;
  });

  if (!hasPermission) {
    next(new ApiError(403, 'لا تملك صلاحية الوصول لهذا المورد ضمن هذه المؤسسة'));
    return;
  }
  next();
};

