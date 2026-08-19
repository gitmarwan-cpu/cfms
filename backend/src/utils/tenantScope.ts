import ApiError from './ApiError';

interface ScopeOptions {
  where?: Record<string, unknown>;
  [key: string]: unknown;
}

export const withTenantScope = <T extends ScopeOptions>(organizationId: number, options: T = {} as T): T & {
  where: Record<string, unknown>;
} => {
  if (!organizationId) {
    throw new ApiError(500, 'خطأ داخلي: لم يتم تحديد سياق المؤسسة قبل تنفيذ الاستعلام');
  }

  return {
    ...options,
    where: { ...(options.where || {}), organizationId },
  } as T & { where: Record<string, unknown> };
};

export const assertBelongsToTenant = <T extends { organizationId?: number | null }>(
  record: T | null | undefined,
  organizationId: number,
  notFoundMessage = 'السجل غير موجود'
): T => {
  if (!record || record.organizationId !== organizationId) {
    throw new ApiError(404, notFoundMessage);
  }
  return record;
};

module.exports = { withTenantScope, assertBelongsToTenant };
