import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';

export interface ReferenceItemPayload {
  code: string;
  labelAr: string;
  labelEn?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
  meta?: Prisma.InputJsonValue | null;
}

export interface ReferenceItemUpdatePayload {
  labelAr?: string;
  labelEn?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
  meta?: Prisma.InputJsonValue | null;
}

export interface ReferenceListResponse {
  id: number;
  key: string;
  nameAr: string;
  nameEn: string | null;
  description: string | null;
  isSystem: boolean;
  organizationId: number | null;
  createDate: Date;
  writeDate: Date;
  createUid: number | null;
  writeUid: number | null;
  createdAt: Date;
  updatedAt: Date;
  items?: ReferenceItemResponse[];
}

export interface ReferenceItemResponse {
  id: number;
  referenceListId: number;
  code: string;
  labelAr: string;
  labelEn: string | null;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
  meta: Prisma.JsonValue | null;
  createDate: Date;
  writeDate: Date;
  createUid: number | null;
  writeUid: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const LIST_SELECT = {
  id: true,
  key: true,
  name_ar: true,
  name_en: true,
  description: true,
  is_system: true,
  organization_id: true,
  create_date: true,
  write_date: true,
  create_uid: true,
  write_uid: true,
} satisfies Prisma.reference_listsSelect;

const ITEM_SELECT = {
  id: true,
  reference_list_id: true,
  code: true,
  label_ar: true,
  label_en: true,
  sort_order: true,
  is_active: true,
  is_default: true,
  meta: true,
  create_date: true,
  write_date: true,
  create_uid: true,
  write_uid: true,
} satisfies Prisma.reference_list_itemsSelect;

type ReferenceList = Prisma.reference_listsGetPayload<{}>;
type ReferenceListItem = Prisma.reference_list_itemsGetPayload<{}>;
type SelectedReferenceList = Prisma.reference_listsGetPayload<{ select: typeof LIST_SELECT }>;
type SelectedReferenceItem = Prisma.reference_list_itemsGetPayload<{ select: typeof ITEM_SELECT }>;
type ReferenceListForMapping = SelectedReferenceList & {
  reference_list_items?: SelectedReferenceItem[];
};

const nullableJsonInput = (
  value: Prisma.InputJsonValue | null
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput =>
  value === null ? (null as unknown as Prisma.NullableJsonNullValueInput) : value;

const toItemCamel = (item: SelectedReferenceItem | ReferenceListItem | null): ReferenceItemResponse | null => {
  if (!item) return null;
  const anyItem = item as any;
  return {
    id: item.id,
    referenceListId: item.reference_list_id,
    code: item.code,
    labelAr: item.label_ar,
    labelEn: item.label_en,
    sortOrder: item.sort_order,
    isActive: item.is_active,
    isDefault: item.is_default,
    meta: item.meta,
    createDate: anyItem.create_date,
    writeDate: anyItem.write_date,
    createUid: anyItem.create_uid,
    writeUid: anyItem.write_uid,
    createdAt: anyItem.create_date,
    updatedAt: anyItem.write_date,
  };
};

const toListCamel = (list: ReferenceListForMapping | null): ReferenceListResponse | null => {
  if (!list) return null;
  const anyList = list as any;
  return {
    id: list.id,
    key: list.key,
    nameAr: list.name_ar,
    nameEn: list.name_en,
    description: list.description,
    isSystem: list.is_system,
    organizationId: list.organization_id,
    createDate: anyList.create_date,
    writeDate: anyList.write_date,
    createUid: anyList.create_uid,
    writeUid: anyList.write_uid,
    createdAt: anyList.create_date,
    updatedAt: anyList.write_date,
    ...(list.reference_list_items
      ? { items: list.reference_list_items.map((item) => toItemCamel(item) as ReferenceItemResponse) }
      : {}),
  };
};

const getEffectiveList = async (key: string, organizationId: number): Promise<ReferenceList> => {
  const ownList = await prisma.reference_lists.findFirst({ where: { key, organization_id: organizationId } });
  if (ownList) return ownList;

  const systemList = await prisma.reference_lists.findFirst({ where: { key, organization_id: null } });
  if (!systemList) {
    throw new ApiError(404, `القائمة المرجعية '${key}' غير موجودة`);
  }
  return systemList;
};

const getOrCreateOwnList = async (key: string, organizationId: number): Promise<ReferenceList> => {
  const existing = await prisma.reference_lists.findFirst({ where: { key, organization_id: organizationId } });
  if (existing) return existing;

  const systemList = await prisma.reference_lists.findFirst({
    where: { key, organization_id: null },
    include: { reference_list_items: true },
  });
  if (!systemList) {
    throw new ApiError(404, `القائمة المرجعية '${key}' غير موجودة كنموذج نظامي لاستنساخها`);
  }

  const now = new Date();
  const forkedList = await prisma.reference_lists.create({
    data: {
      key: systemList.key,
      name_ar: systemList.name_ar,
      name_en: systemList.name_en,
      description: systemList.description,
      is_system: false,
      organization_id: organizationId,
      create_date: now,
      write_date: now,
    },
  });

  if (systemList.reference_list_items?.length) {
    await prisma.reference_list_items.createMany({
      data: systemList.reference_list_items.map((item) => ({
        reference_list_id: forkedList.id,
        code: item.code,
        label_ar: item.label_ar,
        label_en: item.label_en,
        sort_order: item.sort_order,
        is_active: item.is_active,
        is_default: item.is_default,
        meta: nullableJsonInput(item.meta === null ? null : (item.meta as Prisma.InputJsonValue)),
        create_date: now,
        write_date: now,
      })),
    });
  }

  return forkedList;
};

export const listReferenceLists = async (organizationId: number): Promise<ReferenceListResponse[]> => {
  const ownLists = await prisma.reference_lists.findMany({
    where: { organization_id: organizationId },
    select: LIST_SELECT,
    orderBy: { key: 'asc' },
  });
  const ownKeys = new Set(ownLists.map((l) => l.key));

  const systemLists = await prisma.reference_lists.findMany({
    where: { organization_id: null },
    select: LIST_SELECT,
    orderBy: { key: 'asc' },
  });

  const merged = [
    ...ownLists,
    ...systemLists.filter((s) => !ownKeys.has(s.key)),
  ].sort((a, b) => a.key.localeCompare(b.key));

  return merged.map((list) => toListCamel(list) as ReferenceListResponse);
};

export const getListByKey = async (key: string, organizationId: number): Promise<ReferenceListResponse> => {
  const list = await getEffectiveList(key, organizationId);
  const items = await prisma.reference_list_items.findMany({
    where: { reference_list_id: list.id },
    select: ITEM_SELECT,
    orderBy: [{ sort_order: 'asc' }, { code: 'asc' }],
  });

  return toListCamel({ ...list, reference_list_items: items }) as ReferenceListResponse;
};

export const createItem = async (
  key: string,
  organizationId: number,
  payload: ReferenceItemPayload
): Promise<ReferenceItemResponse> => {
  const list = await getOrCreateOwnList(key, organizationId);

  const existingCode = await prisma.reference_list_items.findFirst({
    where: { reference_list_id: list.id, code: payload.code },
  });
  if (existingCode) {
    throw new ApiError(409, `العنصر بالرمز '${payload.code}' موجود بالفعل في هذه القائمة`);
  }

  const now = new Date();
  if (payload.isDefault) {
    await prisma.reference_list_items.updateMany({
      where: { reference_list_id: list.id },
      data: { is_default: false },
    });
  }

  const item = await prisma.reference_list_items.create({
    data: {
      reference_list_id: list.id,
      code: payload.code,
      label_ar: payload.labelAr,
      label_en: payload.labelEn || null,
      sort_order: payload.sortOrder ?? 0,
      is_active: payload.isActive !== false,
      is_default: !!payload.isDefault,
      meta: payload.meta !== undefined ? nullableJsonInput(payload.meta) : undefined,
      create_date: now,
      write_date: now,
    },
    select: ITEM_SELECT,
  });

  return toItemCamel(item) as ReferenceItemResponse;
};

export const updateItem = async (
  key: string,
  itemId: number | string,
  organizationId: number,
  payload: ReferenceItemUpdatePayload
): Promise<ReferenceItemResponse> => {
  const parsedItemId = typeof itemId === 'number' ? itemId : Number(itemId);
  if (!Number.isSafeInteger(parsedItemId)) throw new ApiError(400, 'عنصر القائمة غير صالح');

  const list = await getOrCreateOwnList(key, organizationId);

  const existingItem = await prisma.reference_list_items.findFirst({
    where: { id: parsedItemId, reference_list_id: list.id },
  });
  if (!existingItem) {
    throw new ApiError(404, 'عنصر القائمة المرجعية غير موجود ضمن هذه القائمة لمؤسستك');
  }

  if (payload.isDefault) {
    await prisma.reference_list_items.updateMany({
      where: { reference_list_id: list.id, id: { not: parsedItemId } },
      data: { is_default: false },
    });
  }

  const data: Prisma.reference_list_itemsUpdateInput = {
    write_date: new Date(),
  };

  if (payload.labelAr !== undefined) data.label_ar = payload.labelAr;
  if (payload.labelEn !== undefined) data.label_en = payload.labelEn || null;
  if (payload.sortOrder !== undefined) data.sort_order = payload.sortOrder;
  if (payload.isActive !== undefined) data.is_active = payload.isActive;
  if (payload.isDefault !== undefined) data.is_default = payload.isDefault;
  if (payload.meta !== undefined) data.meta = nullableJsonInput(payload.meta);

  const updated = await prisma.reference_list_items.update({
    where: { id: parsedItemId },
    data,
    select: ITEM_SELECT,
  });

  return toItemCamel(updated) as ReferenceItemResponse;
};

export const resolveActiveItem = async (key: string, code: string, organizationId: number) => {
  const list = await getEffectiveList(key, organizationId);
  const item = await prisma.reference_list_items.findFirst({
    where: { reference_list_id: list.id, code, is_active: true },
    select: ITEM_SELECT,
  });
  if (!item) {
    throw new ApiError(422, `عنصر القائمة المرجعية '${code}' غير موجود أو غير مفعّل في قائمة '${key}'`);
  }
  return item;
};

export const deactivateItem = async (key: string, organizationId: number, itemId: number | string) =>
  updateItem(key, itemId, organizationId, { isActive: false });

export const getItemsByListKey = async (key: string, organizationId: number): Promise<ReferenceItemResponse[]> => {
  const list = await getListByKey(key, organizationId);
  return (list.items || []).filter((item) => item.isActive);
};
