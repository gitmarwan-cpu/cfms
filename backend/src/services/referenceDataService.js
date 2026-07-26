'use strict';

const { ReferenceList, ReferenceListItem } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * ============================================================
 * نمط Template + Override متعدد المؤسسات
 * ============================================================
 * كل قائمة مرجعية (key) لها نسخة نظامية واحدة افتراضية (organization_id
 * = NULL) تُستخدم من كل المؤسسات كنقطة بداية. أول مرة تُعدِّل فيها مؤسسة
 * معينة تلك القائمة (إضافة/تعديل/تعطيل عنصر)، يتم استنساخ القائمة تلقائياً
 * (Copy-on-Write) إلى نسخة خاصة بتلك المؤسسة فقط، دون التأثير على النسخة
 * النظامية أو أي مؤسسة أخرى. هذا يحل بالضبط مشكلة "التخصيص الذي يكسر
 * الترقيات المستقبلية" الشائعة في SAP/Oracle حين تُعدَّل الكائنات
 * النظامية مباشرة.
 */

const getEffectiveList = async (key, organizationId) => {
  const ownList = await ReferenceList.findOne({ where: { key, organizationId } });
  if (ownList) return ownList;

  const systemList = await ReferenceList.findOne({ where: { key, organizationId: null } });
  if (!systemList) {
    throw new ApiError(404, `القائمة المرجعية '${key}' غير موجودة`);
  }
  return systemList;
};

const getOrCreateOwnList = async (key, organizationId) => {
  const existing = await ReferenceList.findOne({ where: { key, organizationId } });
  if (existing) return existing;

  const systemList = await ReferenceList.findOne({
    where: { key, organizationId: null },
    include: [{ model: ReferenceListItem, as: 'items' }],
  });
  if (!systemList) {
    throw new ApiError(404, `القائمة المرجعية '${key}' غير موجودة كنموذج نظامي لاستنساخها`);
  }

  const forkedList = await ReferenceList.create({
    key: systemList.key,
    nameAr: systemList.nameAr,
    nameEn: systemList.nameEn,
    description: systemList.description,
    isSystem: false,
    organizationId,
  });

  if (systemList.items?.length) {
    await ReferenceListItem.bulkCreate(
      systemList.items.map((item) => ({
        referenceListId: forkedList.id,
        code: item.code,
        labelAr: item.labelAr,
        labelEn: item.labelEn,
        sortOrder: item.sortOrder,
        isActive: item.isActive,
        isDefault: item.isDefault,
        meta: item.meta,
      }))
    );
  }

  return forkedList;
};

const getAllLists = async (organizationId) => {
  const [ownLists, systemLists] = await Promise.all([
    ReferenceList.findAll({
      where: { organizationId },
      include: [{ model: ReferenceListItem, as: 'items', separate: true, order: [['sortOrder', 'ASC']] }],
    }),
    ReferenceList.findAll({
      where: { organizationId: null },
      include: [{ model: ReferenceListItem, as: 'items', separate: true, order: [['sortOrder', 'ASC']] }],
    }),
  ]);

  const ownKeys = new Set(ownLists.map((l) => l.key));
  const inheritedSystemLists = systemLists.filter((l) => !ownKeys.has(l.key));

  return [...ownLists, ...inheritedSystemLists].sort((a, b) => a.key.localeCompare(b.key));
};

const getItemsByListKey = async (key, organizationId, { includeInactive = false } = {}) => {
  const list = await getEffectiveList(key, organizationId);
  const where = includeInactive ? {} : { isActive: true };

  return ReferenceListItem.findAll({
    where: { referenceListId: list.id, ...where },
    order: [['sortOrder', 'ASC']],
  });
};

const resolveActiveItem = async (key, code, organizationId) => {
  if (!code) return null;
  const list = await getEffectiveList(key, organizationId);
  const item = await ReferenceListItem.findOne({
    where: { referenceListId: list.id, code, isActive: true },
  });
  if (!item) {
    throw new ApiError(422, `القيمة '${code}' غير صالحة ضمن القائمة '${key}'`);
  }
  return item;
};

const createItem = async (listKey, organizationId, payload) => {
  const list = await getOrCreateOwnList(listKey, organizationId);
  const existing = await ReferenceListItem.findOne({
    where: { referenceListId: list.id, code: payload.code },
  });
  if (existing) {
    throw new ApiError(409, 'الرمز (code) مستخدم بالفعل ضمن هذه القائمة');
  }

  return ReferenceListItem.create({
    referenceListId: list.id,
    code: payload.code,
    labelAr: payload.labelAr,
    labelEn: payload.labelEn || null,
    sortOrder: payload.sortOrder || 0,
    isActive: payload.isActive !== undefined ? payload.isActive : true,
    isDefault: !!payload.isDefault,
    meta: payload.meta || null,
  });
};

const updateItem = async (listKey, organizationId, itemId, payload) => {
  const list = await getOrCreateOwnList(listKey, organizationId);
  const item = await ReferenceListItem.findOne({ where: { id: itemId, referenceListId: list.id } });
  if (!item) {
    throw new ApiError(404, 'العنصر المرجعي غير موجود ضمن نسخة مؤسستك من هذه القائمة');
  }

  const fields = ['labelAr', 'labelEn', 'sortOrder', 'isActive', 'isDefault', 'meta'];
  fields.forEach((field) => {
    if (payload[field] !== undefined) item[field] = payload[field];
  });

  await item.save();
  return item;
};

const deactivateItem = async (listKey, organizationId, itemId) => {
  return updateItem(listKey, organizationId, itemId, { isActive: false });
};

module.exports = {
  getEffectiveList,
  getAllLists,
  getItemsByListKey,
  resolveActiveItem,
  createItem,
  updateItem,
  deactivateItem,
};
