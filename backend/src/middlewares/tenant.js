'use strict';

const ApiError = require('../utils/ApiError');
const { Organization, UserOrganization } = require('../models');

/**
 * =====================================================================
 * آلية عزل المؤسسات (Tenant Isolation) — الطبقة المركزية الوحيدة
 * =====================================================================
 * القاعدة الذهبية: req.organizationId هو المصدر الوحيد المعتمد لتحديد
 * نطاق البيانات في أي Controller/Service لاحق. لا يُسمح أبداً بأخذ
 * organizationId من body الطلب أو query params مباشرة دون المرور من هنا،
 * لأن ذلك يعني الاعتماد على الواجهة الأمامية للعزل (بالضبط ما مُنع صراحة).
 *
 * نوعان من الحل:
 * 1) resolvePublicTenant  → لمسارات عامة غير مصادَق عليها (نموذج الشكوى)،
 *    يعتمد على slug صريح في الرابط، لأن المستفيد لا يملك حساباً أصلاً.
 * 2) resolveAuthenticatedTenant → لمسارات الموظفين/الإدارة، يتحقق أن
 *    المستخدم المسجّل دخوله عضو فعلاً في المؤسسة المطلوبة عبر
 *    user_organizations، ويرفض أي محاولة انتحال لمؤسسة لا ينتمي إليها.
 */

/**
 * يُستخدم في مسارات عامة مثل: GET /api/public/:orgSlug/organization
 * أو: POST /api/public/:orgSlug/complaints
 */
const resolvePublicTenant = async (req, res, next) => {
  try {
    const slug = req.params.orgSlug;
    if (!slug) {
      throw new ApiError(400, 'معرّف المؤسسة (orgSlug) مطلوب في الرابط');
    }

    const organization = await Organization.findOne({ where: { slug, isActive: true } });
    if (!organization) {
      throw new ApiError(404, 'المؤسسة غير موجودة أو غير مفعّلة');
    }

    req.organizationId = organization.id;
    req.organization = organization;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * يُستخدم بعد authenticate في المسارات الداخلية. يقرأ نطاق المؤسسة
 * المطلوب من هيدر X-Organization-Id (لأن المستخدم قد ينتمي لأكثر من
 * مؤسسة عبر user_organizations)، ويتحقق فعلياً من العضوية قبل المتابعة.
 * إن لم يُرسَل الهيدر، يُستخدم عضوية المستخدم الأساسية (is_primary) تلقائياً.
 */
const resolveAuthenticatedTenant = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'مطلوب تسجيل الدخول أولاً');
    }

    const requestedOrgId = req.headers['x-organization-id'];
    let membership;

    if (requestedOrgId) {
      membership = await UserOrganization.findOne({
        where: { userId: req.user.id, organizationId: Number(requestedOrgId), isActive: true },
      });
      if (!membership) {
        // رفض صريح - لا يُسمح بانتحال مؤسسة لا ينتمي إليها المستخدم
        throw new ApiError(403, 'لا تملك عضوية في هذه المؤسسة');
      }
    } else {
      if (!req.user.defaultOrganizationId) {
        throw new ApiError(403, 'لا تنتمي إلى أي مؤسسة افتراضية على المنصة');
      }
      membership = await UserOrganization.findOne({
        where: { userId: req.user.id, organizationId: req.user.defaultOrganizationId, isActive: true },
      });
      if (!membership) {
        throw new ApiError(403, 'المؤسسة الافتراضية لم تعد فعّالة لهذا المستخدم');
      }
    }

    req.organizationId = membership.organizationId;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { resolvePublicTenant, resolveAuthenticatedTenant };
