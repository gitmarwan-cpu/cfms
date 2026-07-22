'use strict';

const { Organization, Governorate } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * النظام حالياً Multi-Organization-Ready وليس Multi-Tenant بعد (حسب النطاق
 * المتفق عليه)، لذا نتعامل مع أول مؤسسة مفعّلة كإعدادات المنصة الحالية.
 * عند الانتقال إلى Multi-Tenant مستقبلاً، تُحدَّد المؤسسة عبر النطاق (domain)
 * أو التوكن بدلاً من "أول سجل" دون الحاجة لتغيير هذه الواجهة (Service API).
 */
const getActiveOrganization = async () => {
  const organization = await Organization.findOne({
    where: { isActive: true },
    order: [['id', 'ASC']],
    include: [{ model: Governorate, as: 'governorate', attributes: ['id', 'nameAr', 'nameEn'] }],
  });
  if (!organization) {
    throw new ApiError(404, 'لا توجد بيانات مؤسسة مُعرَّفة بعد');
  }
  return organization;
};

const updateOrganization = async (id, payload) => {
  const organization = await Organization.findByPk(id);
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

module.exports = { getActiveOrganization, updateOrganization };
