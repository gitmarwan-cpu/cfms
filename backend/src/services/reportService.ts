import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';

export interface ComplaintReportFilters {
  from?: string;
  to?: string;
}

const parseDate = (value: string | undefined, endOfDay = false): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const toIsoDate = (value: Date | undefined): string | null => (value ? value.toISOString() : null);

export const getComplaintSummary = async (organizationId: number, filters: ComplaintReportFilters = {}) => {
  const from = parseDate(filters.from);
  const to = parseDate(filters.to, true);
  const createDate: Prisma.DateTimeFilter = {};
  if (from) createDate.gte = from;
  if (to) createDate.lte = to;

  const where: Prisma.complaintsWhereInput = {
    organization_id: organizationId,
    ...(Object.keys(createDate).length ? { create_date: createDate } : {}),
  };

  const [total, assigned, sensitive, statusGroups, categoryGroups, monthRows] = await Promise.all([
    prisma.complaints.count({ where }),
    prisma.complaints.count({
      where: {
        ...where,
        OR: [
          { assigned_to_user_id: { not: null } },
          { assigned_to_organization_id: { not: null } },
          { assigned_to_org_unit_id: { not: null } },
        ],
      },
    }),
    prisma.complaints.count({ where: { ...where, is_sensitive: true } }),
    prisma.complaints.groupBy({ by: ['status'], where, _count: { _all: true } }),
    prisma.complaints.groupBy({ by: ['category_item_id'], where, _count: { _all: true } }),
    prisma.$queryRaw<Array<{ period: Date; total: bigint }>>(Prisma.sql`
      SELECT date_trunc('month', create_date) AS period, COUNT(*)::bigint AS total
      FROM complaints
      WHERE organization_id = ${organizationId}
        ${from ? Prisma.sql`AND create_date >= ${from}` : Prisma.empty}
        ${to ? Prisma.sql`AND create_date <= ${to}` : Prisma.empty}
      GROUP BY date_trunc('month', create_date)
      ORDER BY period ASC
    `),
  ]);

  const categoryIds = categoryGroups.map((group) => group.category_item_id);
  const categories = categoryIds.length
    ? await prisma.reference_list_items.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, code: true, label_ar: true, label_en: true },
      })
    : [];
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return {
    period: { from: toIsoDate(from), to: toIsoDate(to) },
    summary: { total, assigned, unassigned: total - assigned, sensitive },
    byStatus: statusGroups.map((group) => ({ status: group.status, total: group._count._all })),
    byCategory: categoryGroups.map((group) => {
      const category = categoryById.get(group.category_item_id);
      return {
        itemId: group.category_item_id,
        code: category?.code || null,
        labelAr: category?.label_ar || null,
        labelEn: category?.label_en || null,
        total: group._count._all,
      };
    }),
    byMonth: monthRows.map((row) => ({ period: row.period, total: Number(row.total) })),
  };
};
