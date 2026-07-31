'use strict';

/**
 * علاقة مقدّم الطلب بالمؤسسة (مستفيد/فرد من المجتمع/زائر/موظف/مقاول/...)
 * تُخزَّن كإشارة إلى reference_list_items (قائمة 'complainant_relationship')،
 * بنفس نمط gender_item_id/age_group_item_id تماماً - وليس كـ ENUM ثابت أو
 * جدول جديد، تماشياً مع بنية reference-data القائمة فعلياً.
 *
 * على Complainant (وليس Complaint) لأنها صفة تخص هوية مقدّم الطلب نفسه،
 * لا الطلب الفردي - يتّسق هذا مع gender/age_group الموجودين مسبقاً على
 * نفس الجدول لنفس السبب.
 *
 * NULL مسموح دائماً: الطلبات المجهولة والمُقدَّمة من جهات خارجية قد لا
 * تحمل هذه المعلومة إطلاقاً.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('complainants', 'relationship_item_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('complainants', 'relationship_item_id');
  },
};
