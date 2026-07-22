'use strict';

/**
 * يزرع نوعين افتراضيين قابلين للتعديل من لوحة الإدارة (وليسا ثابتين في الكود):
 * "فرع/قطاع" على المستوى الأول، و"قسم" على المستوى الثاني تحته.
 * يمكن للمؤسسة لاحقاً إضافة أنواع أخرى أو تعديل الترتيب دون أي تعديل برمجي.
 */

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();

    const [orgRows] = await queryInterface.sequelize.query(
      `SELECT id FROM organizations ORDER BY id ASC LIMIT 1`
    );
    if (!orgRows.length) return;
    const organizationId = orgRows[0].id;

    const [branchRow] = await queryInterface.sequelize.query(
      `INSERT INTO org_unit_types
        (organization_id, code, name_ar, name_en, hierarchy_level, allowed_parent_type_id, is_active, created_at, updated_at)
       VALUES (:orgId, 'branch_sector', 'فرع / قطاع', 'Branch / Sector', 1, NULL, true, :now, :now)
       RETURNING id`,
      { replacements: { orgId: organizationId, now }, type: queryInterface.sequelize.QueryTypes.INSERT }
    );
    const branchTypeId = branchRow[0].id;

    await queryInterface.sequelize.query(
      `INSERT INTO org_unit_types
        (organization_id, code, name_ar, name_en, hierarchy_level, allowed_parent_type_id, is_active, created_at, updated_at)
       VALUES (:orgId, 'department', 'قسم', 'Department', 2, :parentTypeId, true, :now, :now)`,
      { replacements: { orgId: organizationId, parentTypeId: branchTypeId, now } }
    );
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('org_unit_types', null, {});
  },
};
