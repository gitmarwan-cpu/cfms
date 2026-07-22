'use strict';

/**
 * يستبدل هذا الـ migration أعمدة ENUM الثابتة (gender, age_group, category, channel)
 * في جدول complaints بأعمدة FK ديناميكية تشير إلى reference_list_items،
 * بحيث تُدار هذه القوائم من لوحة الإدارة دون تعديل الكود أو قاعدة البيانات مستقبلاً.
 *
 * يحافظ على البيانات الحالية عبر خطوة Backfill تُطابق القيمة النصية القديمة
 * مع code المقابل لها في reference_list_items (المُدرجة عبر seeder البيانات المرجعية
 * الذي يجب تشغيله قبل هذا الـ migration مباشرة - راجع الترتيب الزمني للملفات).
 *
 * ملاحظة: بما أن هذا تطبيق في مرحلة تطوير مبكرة (المرحلة الأولى فقط، بدون بيانات
 * إنتاجية فعلية بعد)، تم اختيار الاستبدال المباشر بدلاً من الإبقاء على عمودين
 * متوازيين (قديم/جديد) تجنباً للدين التقني غير المبرر. إن كانت هناك بيانات إنتاجية
 * حقيقية عند التطبيق، يجب أولاً تنفيذ نسخة احتياطية كاملة لقاعدة البيانات.
 */

const COLUMN_TO_LIST_KEY = {
  gender: 'gender',
  age_group: 'age_group',
  category: 'complaint_category',
  channel: 'channel',
};

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (t) => {
      // 1) إضافة الأعمدة الجديدة (FK) مؤقتاً كحقول قابلة لأن تكون فارغة
      await queryInterface.addColumn(
        'complaints',
        'gender_item_id',
        { type: Sequelize.INTEGER, allowNull: true, references: { model: 'reference_list_items', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        { transaction: t }
      );
      await queryInterface.addColumn(
        'complaints',
        'age_group_item_id',
        { type: Sequelize.INTEGER, allowNull: true, references: { model: 'reference_list_items', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        { transaction: t }
      );
      await queryInterface.addColumn(
        'complaints',
        'category_item_id',
        { type: Sequelize.INTEGER, allowNull: true, references: { model: 'reference_list_items', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
        { transaction: t }
      );
      await queryInterface.addColumn(
        'complaints',
        'channel_item_id',
        { type: Sequelize.INTEGER, allowNull: true, references: { model: 'reference_list_items', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
        { transaction: t }
      );

      // 2) Backfill: مطابقة القيمة النصية القديمة مع code في reference_list_items
      for (const [oldColumn, listKey] of Object.entries(COLUMN_TO_LIST_KEY)) {
        await queryInterface.sequelize.query(
          `
          UPDATE complaints c
          SET ${oldColumn}_item_id = rli.id
          FROM reference_list_items rli
          INNER JOIN reference_lists rl ON rl.id = rli.reference_list_id
          WHERE rl.key = :listKey AND rli.code = c.${oldColumn}::text
          `,
          { replacements: { listKey }, transaction: t }
        );
      }

      // 3) حذف الأعمدة القديمة (ENUM) وأنواعها
      await queryInterface.removeColumn('complaints', 'gender', { transaction: t });
      await queryInterface.removeColumn('complaints', 'age_group', { transaction: t });
      await queryInterface.removeColumn('complaints', 'category', { transaction: t });
      await queryInterface.removeColumn('complaints', 'channel', { transaction: t });

      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_complaints_gender";', { transaction: t });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_complaints_age_group";', { transaction: t });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_complaints_category";', { transaction: t });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_complaints_channel";', { transaction: t });

      // 4) category_item_id و channel_item_id إلزاميان (كانا NOT NULL سابقاً)
      await queryInterface.changeColumn(
        'complaints',
        'category_item_id',
        { type: Sequelize.INTEGER, allowNull: false, references: { model: 'reference_list_items', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
        { transaction: t }
      );
      await queryInterface.changeColumn(
        'complaints',
        'channel_item_id',
        { type: Sequelize.INTEGER, allowNull: false, references: { model: 'reference_list_items', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
        { transaction: t }
      );

      await queryInterface.addIndex('complaints', ['category_item_id'], { transaction: t });
      await queryInterface.addIndex('complaints', ['channel_item_id'], { transaction: t });
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.addColumn('complaints', 'gender', { type: Sequelize.ENUM('male', 'female'), allowNull: true }, { transaction: t });
      await queryInterface.addColumn('complaints', 'age_group', { type: Sequelize.ENUM('under_18', '18_30', '31_45', '46_60', 'above_60'), allowNull: true }, { transaction: t });
      await queryInterface.addColumn(
        'complaints',
        'category',
        {
          type: Sequelize.ENUM('service_quality', 'staff_behavior', 'corruption_fraud', 'distribution_issue', 'protection_gbv', 'suggestion', 'other'),
          allowNull: true,
        },
        { transaction: t }
      );
      await queryInterface.addColumn(
        'complaints',
        'channel',
        { type: Sequelize.ENUM('in_person', 'hotline', 'suggestion_box', 'email', 'field_visit', 'website'), allowNull: true },
        { transaction: t }
      );

      for (const [oldColumn] of Object.entries(COLUMN_TO_LIST_KEY)) {
        await queryInterface.sequelize.query(
          `
          UPDATE complaints c
          SET ${oldColumn} = rli.code
          FROM reference_list_items rli
          WHERE rli.id = c.${oldColumn}_item_id
          `,
          { transaction: t }
        );
      }

      await queryInterface.removeColumn('complaints', 'gender_item_id', { transaction: t });
      await queryInterface.removeColumn('complaints', 'age_group_item_id', { transaction: t });
      await queryInterface.removeColumn('complaints', 'category_item_id', { transaction: t });
      await queryInterface.removeColumn('complaints', 'channel_item_id', { transaction: t });
    });
  },
};
