'use strict';

const { ReferenceList, ReferenceListItem } = require('../models');
const ApiError = require('../utils/ApiError');

const getAllLists = async () => {
  return ReferenceList.findAll({
    order: [['key', 'ASC']],
    include: [{ model: ReferenceListItem, as: 'items', separate: true, order: [['sortOrder', 'ASC']] }],
  });
};

const getListByKey = async (key) => {
  const list = await ReferenceList.findOne({ where: { key } });
  if (!list) {
    throw new ApiError(404, `القائمة المرجعية '${key}' غير موجودة`);
  }
  return list;
};

/**
 * يُستخدم من الواجهة العامة (نموذج تقديم الشكوى) لجلب عناصر قائمة معيّنة.
 * افتراضياً يعيد العناصر المفعّلة فقط، بترتيبها المحدد من لوحة الإدارة.
 */
const getItemsByListKey = async (key, { includeInactive = false } = {}) => {
  const list = await getListByKey(key);
  const where = includeInactive ? {} : { isActive: true };

  return ReferenceListItem.findAll({
    where: { referenceListId: list.id, ...where },
    order: [['sortOrder', 'ASC']],
  });
};

/**
 * يتحقق أن code معيّن ينتمي لقائمة key ومفعّل، ويعيد العنصر نفسه.
 * يُستخدم في التحقق من صحة بيانات الشكوى (بدلاً من isIn(ثابتة)).
 */
const resolveActiveItem = async (key, code) => {
  if (!code) return null;
  const list = await getListByKey(key);
  const item = await ReferenceListItem.findOne({
    where: { referenceListId: list.id, code, isActive: true },
  });
  if (!item) {
    throw new ApiError(422, `القيمة '${code}' غير صالحة ضمن القائمة '${key}'`);
  }
  return item;
};

const createItem = async (listKey, payload) => {
  const list = await getListByKey(listKey);
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

const updateItem = async (listKey, itemId, payload) => {
  const list = await getListByKey(listKey);
  const item = await ReferenceListItem.findOne({ where: { id: itemId, referenceListId: list.id } });
  if (!item) {
    throw new ApiError(404, 'العنصر المرجعي غير موجود');
  }

  const fields = ['labelAr', 'labelEn', 'sortOrder', 'isActive', 'isDefault', 'meta'];
  fields.forEach((field) => {
    if (payload[field] !== undefined) item[field] = payload[field];
  });

  await item.save();
  return item;
};

/**
 * لا يُسمح بالحذف الفعلي للعناصر المرتبطة ببيانات موجودة (سلامة مرجعية)،
 * لذلك يتم إلغاء تفعيل العنصر (Soft Disable) بدلاً من حذفه.
 */
const deactivateItem = async (listKey, itemId) => {
  return updateItem(listKey, itemId, { isActive: false });
};

module.exports = {
  getAllLists,
  getListByKey,
  getItemsByListKey,
  resolveActiveItem,
  createItem,
  updateItem,
  deactivateItem,
};
