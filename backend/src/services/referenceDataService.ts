import type { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';
import { withTenantScope } from '../utils/prismaTenantScope';

export interface ReferenceItemInput {
  code: string;
  labelAr: string;
  labelEn?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
  meta?: Prisma.InputJsonValue | null;
}

export interface ReferenceItemUpdateInput {
  labelAr?: string;
  labelEn?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
  meta?: Prisma.InputJsonValue | null;
}

export interface ReferenceItemsOptions {
  includeInactive?: boolean;
}

export interface ReferenceListResponse {
  id: number;
  key: string;
  nameAr: string;
  nameEn: string | null;
  description: string | null;
  isSystem: boolean;
  organizationId: number | null;
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
  created_at: true,
  updated_at: true,
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
  created_at: true,
  updated_at: true,
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
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
};

const toListCamel = (list: ReferenceListForMapping | null): ReferenceListResponse | null => {
  if (!list) return null;
  return {
    id: list.id,
    key: list.key,
    nameAr: list.name_ar,
    nameEn: list.name_en,
    description: list.description,
    isSystem: list.is_system,
    organizationId: list.organization_id,
    createdAt: list.created_at,
    updatedAt: list.updated_at,
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

  const forkedList = await prisma.reference_lists.create({
    data: {
      key: systemList.key,
      name_ar: systemList.name_ar,
      name_en: systemList.name_en,
      description: systemList.description,
      is_system: false,
      organization_id: organizationId,
      created_at: new Date(),
      updated_at: new Date(),
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
        created_at: new Date(),
        updated_at: new Date(),
      })),
    });
  }

  return forkedList;
};

export const getAllLists = async (organizationId: number): Promise<ReferenceListResponse[]> => {
  if (!organizationId) {
    throw new ApiError(500, 'خطأ داخلي: لم يتم تحديد سياق المؤسسة قبل تنفيذ الاستعلام');
  }

  const [ownLists, systemLists] = await Promise.all([
    prisma.reference_lists.findMany(
      withTenantScope(organizationId, {
        select: {
          ...LIST_SELECT,
          reference_list_items: { select: ITEM_SELECT, orderBy: { sort_order: 'asc' } },
        },
      })
    ),
    prisma.reference_lists.findMany({
      where: { organization_id: null },
      select: {
        ...LIST_SELECT,
        reference_list_items: { select: ITEM_SELECT, orderBy: { sort_order: 'asc' } },
      },
    }),
  ]);

  const ownKeys = new Set(ownLists.map((list) => list.key));
  const inheritedSystemLists = systemLists.filter((list) => !ownKeys.has(list.key));

  return [...ownLists, ...inheritedSystemLists]
    .map((list) => toListCamel(list) as ReferenceListResponse)
    .sort((a, b) => a.key.localeCompare(b.key));
};

export const getItemsByListKey = async (
  key: string,
  organizationId: number,
  { includeInactive = false }: ReferenceItemsOptions = {}
): Promise<ReferenceItemResponse[]> => {
  const list = await getEffectiveList(key, organizationId);

  const items = await prisma.reference_list_items.findMany({
    where: { reference_list_id: list.id, ...(includeInactive ? {} : { is_active: true }) },
    orderBy: { sort_order: 'asc' },
    select: ITEM_SELECT,
  });

  return items.map((item) => toItemCamel(item) as ReferenceItemResponse);
};

export const resolveActiveItem = async (
  key: string,
  code: string,
  organizationId: number
): Promise<ReferenceListItem | null> => {
  if (!code) return null;
  const list = await getEffectiveList(key, organizationId);
  const item = await prisma.reference_list_items.findFirst({
    where: { reference_list_id: list.id, code, is_active: true },
  });
  if (!item) {
    throw new ApiError(422, `القيمة '${code}' غير صالحة ضمن القائمة '${key}'`);
  }
  return item;
};

export const createItem = async (
  listKey: string,
  organizationId: number,
  payload: ReferenceItemInput
): Promise<ReferenceItemResponse> => {
  const list = await getOrCreateOwnList(listKey, organizationId);
  const existing = await prisma.reference_list_items.findFirst({
    where: { reference_list_id: list.id, code: payload.code },
  });
  if (existing) {
    throw new ApiError(409, 'الرمز (code) مستخدم بالفعل ضمن هذه القائمة');
  }

  const item = await prisma.reference_list_items.create({
    data: {
      reference_list_id: list.id,
      code: payload.code,
      label_ar: payload.labelAr,
      label_en: payload.labelEn || null,
      sort_order: payload.sortOrder || 0,
      is_active: payload.isActive !== undefined ? payload.isActive : true,
      is_default: !!payload.isDefault,
      meta: nullableJsonInput(payload.meta || null),
      created_at: new Date(),
      updated_at: new Date(),
    },
    select: ITEM_SELECT,
  });

  return toItemCamel(item) as ReferenceItemResponse;
};

type EditableField = keyof ReferenceItemUpdateInput;
type EditableColumn = 'label_ar' | 'label_en' | 'sort_order' | 'is_active' | 'is_default' | 'meta';

const fieldToColumn = (field: EditableField): EditableColumn => {
  const map: Record<EditableField, EditableColumn> = {
    labelAr: 'label_ar',
    labelEn: 'label_en',
    sortOrder: 'sort_order',
    isActive: 'is_active',
    isDefault: 'is_default',
    meta: 'meta',
  };
  return map[field];
};

export const updateItem = async (
  listKey: string,
  organizationId: number,
  itemId: string | number,
  payload: ReferenceItemUpdateInput
): Promise<ReferenceItemResponse> => {
  const list = await getOrCreateOwnList(listKey, organizationId);
  const numericItemId = Number(itemId);
  if (!Number.isSafeInteger(numericItemId) || numericItemId < 1) {
    throw new ApiError(422, 'Invalid reference item ID');
  }

  const item = await prisma.reference_list_items.findFirst({
    where: { id: numericItemId, reference_list_id: list.id },
  });
  if (!item) {
    throw new ApiError(404, 'العنصر المرجعي غير موجود ضمن نسخة مؤسستك من هذه القائمة');
  }

  const data: Prisma.reference_list_itemsUpdateInput = { updated_at: new Date() };
  const fields: EditableField[] = ['labelAr', 'labelEn', 'sortOrder', 'isActive', 'isDefault', 'meta'];
  const dataRecord = data as Record<string, unknown>;
  fields.forEach((field) => {
    if (payload[field] !== undefined) dataRecord[fieldToColumn(field)] = payload[field];
  });

  const updated = await prisma.reference_list_items.update({
    where: { id: item.id },
    data,
    select: ITEM_SELECT,
  });

  return toItemCamel(updated) as ReferenceItemResponse;
};

export const deactivateItem = async (
  listKey: string,
  organizationId: number,
  itemId: string | number
): Promise<ReferenceItemResponse> => updateItem(listKey, organizationId, itemId, { isActive: false });
