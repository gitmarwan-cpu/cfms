import ApiError from './ApiError';
import { assertBelongsToTenant } from './tenantScope';

export const withTenantScope = (organizationId: number, args: any = {}): any => {
  if (!organizationId) {
    throw new ApiError(500, 'خطأ داخلي: لم يتم تحديد سياق المؤسسة قبل تنفيذ الاستعلام');
  }

  return {
    ...args,
    where: { ...(args.where || {}), organization_id: organizationId },
  };
};

export const withTemplateOverrideScope = (organizationId: number, args: any = {}): any => {
  if (!organizationId) {
    throw new ApiError(500, 'خطأ داخلي: لم يتم تحديد سياق المؤسسة قبل تنفيذ الاستعلام');
  }

  const existingWhere = args.where || {};
  return {
    ...args,
    where: {
      ...existingWhere,
      OR: [...(existingWhere.OR || []), { organization_id: null }, { organization_id: organizationId }],
    },
  };
};

export { assertBelongsToTenant };
module.exports = { withTenantScope, withTemplateOverrideScope, assertBelongsToTenant };
