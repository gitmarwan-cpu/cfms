'use strict';

const { withTenantScope, withTemplateOverrideScope, assertBelongsToTenant } = require('../src/utils/prismaTenantScope');
const ApiError = require('../src/utils/ApiError');

describe('prismaTenantScope — withTenantScope', () => {
  test('injects organizationId into an empty where clause', () => {
    const result = withTenantScope(7, {});
    expect(result).toEqual({ where: { organization_id: 7 } });
  });

  test('merges organizationId into an existing where clause', () => {
    const result = withTenantScope(7, { where: { status: 'new' }, include: { attachments: true } });
    expect(result).toEqual({
      where: { status: 'new', organization_id: 7 },
      include: { attachments: true },
    });
  });

  test('preserves OR conditions and other args', () => {
    const result = withTenantScope(7, { where: { OR: [{ status: 'new' }, { status: 'open' }] }, orderBy: { createdAt: 'desc' } });
    expect(result).toEqual({
      where: { OR: [{ status: 'new' }, { status: 'open' }], organization_id: 7 },
      orderBy: { createdAt: 'desc' },
    });
  });

  test('throws ApiError 500 when organizationId is missing', () => {
    expect(() => withTenantScope(undefined, {})).toThrow(ApiError);
    expect(() => withTenantScope(null, {})).toThrow(ApiError);
  });

  test('throws with the friendly Arabic message', () => {
    try {
      withTenantScope(null, {});
    } catch (err) {
      expect(err.statusCode).toBe(500);
      expect(err.message).toMatch(/لم يتم تحديد سياق المؤسسة/);
    }
  });
});

describe('prismaTenantScope — withTemplateOverrideScope', () => {
  test('adds OR [system null, own org] to empty where', () => {
    const result = withTemplateOverrideScope(7, {});
    expect(result).toEqual({
      where: { OR: [{ organization_id: null }, { organization_id: 7 }] },
    });
  });

  test('preserves existing conditions and appends OR', () => {
    const result = withTemplateOverrideScope(7, { where: { code: 'staff', isActive: true } });
    expect(result).toEqual({
      where: {
        code: 'staff',
        isActive: true,
        OR: [{ organization_id: null }, { organization_id: 7 }],
      },
    });
  });

  test('preserves existing OR conditions without clobbering them', () => {
    const result = withTemplateOverrideScope(7, {
      where: { OR: [{ code: 'admin' }, { code: 'staff' }] },
    });
    expect(result).toEqual({
      where: {
        OR: [{ code: 'admin' }, { code: 'staff' }, { organization_id: null }, { organization_id: 7 }],
      },
    });
  });

  test('throws ApiError 500 when organizationId is missing', () => {
    expect(() => withTemplateOverrideScope(undefined, {})).toThrow(ApiError);
    expect(() => withTemplateOverrideScope(null, {})).toThrow(ApiError);
  });
});

describe('prismaTenantScope — assertBelongsToTenant (re-export)', () => {
  test('returns the record when it belongs to the organization', () => {
    const record = { id: 1, organizationId: 5 };
    expect(assertBelongsToTenant(record, 5)).toBe(record);
  });

  test('throws ApiError 404 when record belongs to another organization', () => {
    const record = { id: 1, organizationId: 5 };
    expect(() => assertBelongsToTenant(record, 9)).toThrow(ApiError);
    try {
      assertBelongsToTenant(record, 9, 'custom message');
    } catch (err) {
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe('custom message');
    }
  });

  test('throws ApiError 404 when record is null', () => {
    expect(() => assertBelongsToTenant(null, 5)).toThrow(ApiError);
  });
});
