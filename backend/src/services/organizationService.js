'use strict';

const { Organization, Governorate } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * عام (بدون مصادقة): يُستخدم من نموذج تقديم الشكوى العام لجلب الهوية
 * البصرية للمؤسسة عبر slug الظاهر في الرابط - راجع middlewares/tenant.js
 * (resolvePublicTenant) الذي يحقنه في req.organization أصلاً؛ هذه الدالة
 * موجودة للاستخدام المباشر إن احتاجتها خدمة أخرى.
 */
const getBySlug = async (slug) => {
  const organization = await Organization.findOne({
    where: { slug, isActive: true },
    include: [{ model: Governorate, as: 'governorate', attributes: ['id', 'nameAr', 'nameEn'] }],
  });
  if (!organization) {
    throw new ApiError(404, 'المؤسسة غير موجودة');
  }
  return organization;
};

/**
 * محمي: يعيد إعدادات مؤسسة المستخدم الحالي فقط (organizationId من سياق
 * المصادقة، وليس أي معرّف يُرسله العميل).
 */
const getOwnOrganization = async (organizationId) => {
  const organization = await Organization.findByPk(organizationId, {
    include: [{ model: Governorate, as: 'governorate', attributes: ['id', 'nameAr', 'nameEn'] }],
  });
  if (!organization) {
    throw new ApiError(404, 'المؤسسة غير موجودة');
  }
  return organization;
};

/**
 * تنبيه أمني (تمت معالجته): كانت هذه الدالة سابقاً تقبل أي id يُرسله
 * العميل عبر رابط الطلب (PUT /api/organization/:id) دون أي تحقق أنه
 * يخص مؤسسة المستخدم الحالي - أي أن أي admin في أي مؤسسة كان يمكنه
 * نظرياً تعديل إعدادات مؤسسة أخرى بتخمين الرقم. الآن organizationId
 * يأتي حصراً من resolveAuthenticatedTenant (سياق العضوية الفعلي للمستخدم).
 */
const updateOrganization = async (organizationId, payload) => {
  const organization = await Organization.findByPk(organizationId);
  if (!organization) {
    throw new ApiError(404, 'المؤسسة غير موجودة');
  }

  const editableFields = [
    'legalName',
    'shortName',
    'logoUrl',
    'faviconUrl',
    'description',
    'vision',
    'mission',
    'phone',
    'email',
    'website',
    'country',
    'governorateId',
    'city',
    'address',
    'latitude',
    'longitude',
    'defaultLanguage',
    'timezone',
    'dateFormat',
    'primaryColor',
    'secondaryColor',
    'accentColor',
    'anonymousComplaintsPolicy',
    'notificationSettings',
    'isActive',
  ];

  editableFields.forEach((field) => {
    if (payload[field] !== undefined) organization[field] = payload[field];
  });

  await organization.save();
  return organization;
};

module.exports = { getBySlug, getOwnOrganization, updateOrganization };
