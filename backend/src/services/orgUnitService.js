'use strict';

const { OrgUnit, OrgUnitType, User, UserOrganization } = require('../models');
const ApiError = require('../utils/ApiError');

const buildIncludes = () => [
  { model: OrgUnitType, as: 'unitType', attributes: ['id', 'code', 'nameAr', 'nameEn', 'hierarchyLevel'] },
  { model: User, as: 'manager', attributes: ['id', 'fullName', 'email'] },
];

/**
 * تنبيه أمني (تمت معالجته): كان managerUserId يُقبل ويُخزَّن دون أي تحقق
 * أنه ينتمي فعلاً لهذه المؤسسة - ما يسمح نظرياً بربط وحدة تنظيمية بمدير
 * من مؤسسة مختلفة تماماً (خطأ تكامل بيانات يكسر افتراض العزل بين المؤسسات).
 */
const validateManagerBelongsToOrganization = async (managerUserId, organizationId) => {
  if (!managerUserId) return;
  const membership = await UserOrganization.findOne({
    where: { userId: managerUserId, organizationId, isActive: true },
  });
  if (!membership) {
    throw new ApiError(422, 'المستخدم المحدد كمدير للوحدة ليس عضواً في هذه المؤسسة');
  }
};

/**
 * يتحقق أن نوع الوحدة الجديدة متوافق مع نوع الوحدة الأم حسب allowedParentTypeId
 * المُعرَّف في org_unit_types، فيمنع مثلاً إلحاق "قسم" مباشرة تحت المؤسسة إن
 * كانت إعدادات الهيكل تشترط مروره عبر "فرع/قطاع" أولاً.
 */
const validateParentTypeCompatibility = async (orgUnitTypeId, parentId, organizationId) => {
  const unitType = await OrgUnitType.findOne({ where: { id: orgUnitTypeId, organizationId } });
  if (!unitType) {
    throw new ApiError(422, 'نوع الوحدة التنظيمية غير صالح ضمن هذه المؤسسة');
  }

  if (!parentId) {
    if (unitType.allowedParentTypeId) {
      throw new ApiError(422, 'هذا النوع من الوحدات لا يمكن إلحاقه مباشرة بالمؤسسة، يجب تحديد وحدة أم');
    }
    return;
  }

  const parentUnit = await OrgUnit.findOne({ where: { id: parentId, organizationId } });
  if (!parentUnit) {
    throw new ApiError(422, 'الوحدة الأم المحددة غير موجودة ضمن هذه المؤسسة');
  }

  if (unitType.allowedParentTypeId && unitType.allowedParentTypeId !== parentUnit.orgUnitTypeId) {
    throw new ApiError(
      422,
      'نوع الوحدة الأم لا يتوافق مع الهيكل التنظيمي المُعرَّف لهذا النوع من الوحدات'
    );
  }
};

const listUnits = async (organizationId) => {
  return OrgUnit.findAll({
    where: { organizationId },
    include: buildIncludes(),
    order: [['id', 'ASC']],
  });
};

const createUnit = async (organizationId, payload) => {
  await validateParentTypeCompatibility(payload.orgUnitTypeId, payload.parentId, organizationId);
  await validateManagerBelongsToOrganization(payload.managerUserId, organizationId);

  return OrgUnit.create({
    organizationId,
    orgUnitTypeId: payload.orgUnitTypeId,
    parentId: payload.parentId || null,
    name: payload.name,
    code: payload.code || null,
    managerUserId: payload.managerUserId || null,
    phone: payload.phone || null,
    email: payload.email || null,
    address: payload.address || null,
    latitude: payload.latitude || null,
    longitude: payload.longitude || null,
    isActive: payload.isActive !== undefined ? payload.isActive : true,
  });
};

const updateUnit = async (organizationId, unitId, payload) => {
  const unit = await OrgUnit.findOne({ where: { id: unitId, organizationId } });
  if (!unit) {
    throw new ApiError(404, 'الوحدة التنظيمية غير موجودة');
  }

  const nextOrgUnitTypeId = payload.orgUnitTypeId || unit.orgUnitTypeId;
  const nextParentId = payload.parentId !== undefined ? payload.parentId : unit.parentId;

  if (nextParentId === unit.id) {
    throw new ApiError(422, 'لا يمكن أن تكون الوحدة أباً لنفسها');
  }

  if (payload.orgUnitTypeId !== undefined || payload.parentId !== undefined) {
    await validateParentTypeCompatibility(nextOrgUnitTypeId, nextParentId, organizationId);
  }

  if (payload.managerUserId !== undefined) {
    await validateManagerBelongsToOrganization(payload.managerUserId, organizationId);
  }

  const fields = [
    'orgUnitTypeId',
    'parentId',
    'name',
    'code',
    'managerUserId',
    'phone',
    'email',
    'address',
    'latitude',
    'longitude',
    'isActive',
  ];
  fields.forEach((field) => {
    if (payload[field] !== undefined) unit[field] = payload[field];
  });

  await unit.save();
  return unit;
};

/**
 * حذف منطقي فقط (Soft Delete) حسب المتطلبات المعمارية - لا يُسمح بحذف
 * وحدة تنظيمية لديها وحدات فرعية تابعة نشطة، حفاظاً على تكامل الهيكل.
 */
const deactivateUnit = async (organizationId, unitId) => {
  const unit = await OrgUnit.findOne({ where: { id: unitId, organizationId } });
  if (!unit) {
    throw new ApiError(404, 'الوحدة التنظيمية غير موجودة');
  }

  const activeChildren = await OrgUnit.count({ where: { parentId: unitId, isActive: true } });
  if (activeChildren > 0) {
    throw new ApiError(409, 'لا يمكن إلغاء تفعيل وحدة لديها وحدات فرعية نشطة تابعة لها');
  }

  unit.isActive = false;
  await unit.save();
  await unit.destroy(); // soft delete (paranoid) - يُبقي السجل مع تعبئة deleted_at
  return unit;
};

module.exports = { listUnits, createUnit, updateUnit, deactivateUnit };
