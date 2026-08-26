import ApiError from '../utils/ApiError';

export const GROUPS_FROZEN_MESSAGE = 'المجموعات مجمّدة حالياً للقراءة والتدقيق فقط؛ لا يمكن إنشاء أو تعديل أو حذف بياناتها';

export const throwGroupsFrozen = (): never => {
  throw new ApiError(410, GROUPS_FROZEN_MESSAGE);
};
