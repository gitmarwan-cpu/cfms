'use strict';

/**
 * ينقل هذا الـ migration حقول الهوية (full_name/phone/email/gender/age_group)
 * من complaints إلى complainants (سجل منفصل لكل شكوى حالياً - بلا دمج
 * تلقائي بين الشكاوى المتكررة لنفس الشخص، وهذه ميزة لاحقة وليست الآن)،
 * ويضيف:
 *  - complainant_id: NULL يعني شكوى مجهولة بالكامل بلا أي بيانات هوية.
 *  - tracking_pin_hash: PIN آمن (مُجزَّأ bcrypt، لا يُخزَّن أبداً كنص صريح)
 *    يُستخدم مع reference_code لمتابعة الشكوى دون تسجيل دخول.
 *  - created_by_user_id: NULL = شكوى قدّمها المستفيد بنفسه عبر البوابة
 *    العامة؛ قيمة = موظف نظام أدخلها نيابة عن مقدّم الشكوى (حالة حضورية/هاتفية).
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.addColumn(
        'complaints',
        'complainant_id',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'complainants', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        { transaction: t }
      );
      await queryInterface.addColumn(
        'complaints',
        'tracking_pin_hash',
        { type: Sequelize.STRING(255), allowNull: true },
        { transaction: t }
      );
      await queryInterface.addColumn(
        'complaints',
        'created_by_user_id',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        { transaction: t }
      );

      // Backfill: أي شكوى حالية تحمل بيانات هوية تُستنسخ إلى complainant جديد
      await queryInterface.sequelize.query(
        `
        INSERT INTO complainants (organization_id, full_name, phone, email, gender_item_id, age_group_item_id, created_at, updated_at)
        SELECT organization_id, full_name, phone, email, gender_item_id, age_group_item_id, created_at, updated_at
        FROM complaints
        WHERE full_name IS NOT NULL OR phone IS NOT NULL OR email IS NOT NULL;
        `,
        { transaction: t }
      );

      // ربط كل شكوى بسجل complainant المُنشأ للتو بمطابقة أفضل ما يتوفر
      // (id تسلسلي متزامن مع ترتيب الإدراج أعلاه - آمن لأن هذا backfill
      // لمرة واحدة على بيانات المرحلة الأولى المحدودة فقط).
      await queryInterface.sequelize.query(
        `
        UPDATE complaints c
        SET complainant_id = comp.id
        FROM complainants comp
        WHERE c.full_name IS NOT DISTINCT FROM comp.full_name
          AND c.phone IS NOT DISTINCT FROM comp.phone
          AND c.email IS NOT DISTINCT FROM comp.email
          AND c.organization_id = comp.organization_id
          AND c.complainant_id IS NULL
          AND (c.full_name IS NOT NULL OR c.phone IS NOT NULL OR c.email IS NOT NULL);
        `,
        { transaction: t }
      );

      await queryInterface.removeColumn('complaints', 'full_name', { transaction: t });
      await queryInterface.removeColumn('complaints', 'phone', { transaction: t });
      await queryInterface.removeColumn('complaints', 'email', { transaction: t });
      await queryInterface.removeColumn('complaints', 'gender_item_id', { transaction: t });
      await queryInterface.removeColumn('complaints', 'age_group_item_id', { transaction: t });

      await queryInterface.addIndex('complaints', ['complainant_id'], { transaction: t });
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.addColumn('complaints', 'full_name', { type: Sequelize.STRING(150), allowNull: true }, { transaction: t });
      await queryInterface.addColumn('complaints', 'phone', { type: Sequelize.STRING(30), allowNull: true }, { transaction: t });
      await queryInterface.addColumn('complaints', 'email', { type: Sequelize.STRING(150), allowNull: true }, { transaction: t });
      await queryInterface.addColumn('complaints', 'gender_item_id', { type: Sequelize.INTEGER, allowNull: true }, { transaction: t });
      await queryInterface.addColumn('complaints', 'age_group_item_id', { type: Sequelize.INTEGER, allowNull: true }, { transaction: t });

      await queryInterface.sequelize.query(
        `
        UPDATE complaints c
        SET full_name = comp.full_name, phone = comp.phone, email = comp.email,
            gender_item_id = comp.gender_item_id, age_group_item_id = comp.age_group_item_id
        FROM complainants comp
        WHERE c.complainant_id = comp.id;
        `,
        { transaction: t }
      );

      await queryInterface.removeColumn('complaints', 'complainant_id', { transaction: t });
      await queryInterface.removeColumn('complaints', 'tracking_pin_hash', { transaction: t });
      await queryInterface.removeColumn('complaints', 'created_by_user_id', { transaction: t });
    });
  },
};
