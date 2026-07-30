'use strict';

/**
 * حقول اختيارية نصية حرة بقرار صريح: بلا جداول جديدة، بلا FK، بلا Lookup.
 *
 * - project_reference_code: اسم/مرجع مشروع حر يكتبه مقدّم الطلب أو موظف
 *   الإدارة لاحقاً. لا جدول projects بعد - عند بناء وحدة المشاريع مستقبلاً،
 *   الترحيل النظيف هو: إضافة عمود project_id (FK)، ونقل القيم عبر مطابقة
 *   نصية من هذا العمود، دون كسر أي بيانات قائمة.
 *
 * - is_related_to_staff + related_staff_name/position + staff_incident_details:
 *   مباشرة على complaints (وليس جدولاً فرعياً منفصلاً كما اقترحتُ سابقاً)
 *   بناءً على توجيه صريح لاحق بتفادي أي جدول/علاقة غير ضرورية الآن. لا
 *   FK لموظف حقيقي - نص حر فقط يكتبه مقدّم الطلب، يُربط لاحقاً يدوياً
 *   بموظف فعلي من قبل الفريق الإداري عند بناء وحدة HR.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('complaints', 'project_reference_code', {
      type: Sequelize.STRING(150),
      allowNull: true,
    });

    await queryInterface.addColumn('complaints', 'is_related_to_staff', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('complaints', 'related_staff_name', {
      type: Sequelize.STRING(150),
      allowNull: true,
    });

    await queryInterface.addColumn('complaints', 'related_staff_position', {
      type: Sequelize.STRING(150),
      allowNull: true,
    });

    await queryInterface.addColumn('complaints', 'staff_incident_details', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('complaints', 'project_reference_code');
    await queryInterface.removeColumn('complaints', 'is_related_to_staff');
    await queryInterface.removeColumn('complaints', 'related_staff_name');
    await queryInterface.removeColumn('complaints', 'related_staff_position');
    await queryInterface.removeColumn('complaints', 'staff_incident_details');
  },
};
