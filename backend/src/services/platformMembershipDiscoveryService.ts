import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import { assertActiveTenant } from './tenantLifecycleService';

export interface TenantMembershipListFilters {
  page?: string | number;
  limit?: string | number;
  search?: string;
}

const MEMBERSHIP_SELECT = {
  id: true,
  user_id: true,
  organization_id: true,
  is_primary: true,
  is_active: true,
  create_date: true,
  write_date: true,
  users: {
    select: {
      id: true,
      full_name: true,
      email: true,
      is_active: true,
    },
  },
} as const;

const ROLE_ASSIGNMENT_SELECT = {
  id: true,
  user_id: true,
  role_id: true,
  organization_node_id: true,
  roles: {
    select: {
      id: true,
      code: true,
      name_ar: true,
      name_en: true,
      scope: true,
      organization_id: true,
    },
  },
  organization_node: {
    select: {
      id: true,
      legal_name: true,
      short_name: true,
      code: true,
    },
  },
} as const;

const ROLE_SELECT = {
  id: true,
  code: true,
  name_ar: true,
  name_en: true,
  description: true,
  organization_id: true,
  is_system: true,
  is_active: true,
  scope: true,
} as const;

const NODE_SELECT = {
  id: true,
  legal_name: true,
  short_name: true,
  code: true,
  parent_id: true,
  root_organization_id: true,
  org_unit_type_id: true,
  is_active: true,
  org_unit_type: {
    select: {
      id: true,
      code: true,
      name_ar: true,
      name_en: true,
      hierarchy_level: true,
    },
  },
} as const;

const toPositiveInteger = (value: unknown, fallback: number): number => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parsePage = (value: unknown): number => toPositiveInteger(value, 1);

const parseLimit = (value: unknown): number => Math.min(100, toPositiveInteger(value, 20));

export const listTenantMemberships = async (
  organizationId: string | number,
  filters: TenantMembershipListFilters = {}
) => {
  const tenant = await assertActiveTenant(organizationId);
  const page = parsePage(filters.page);
  const limit = parseLimit(filters.limit);
  const search = typeof filters.search === 'string' ? filters.search.trim() : '';
  const where: Prisma.user_organizationsWhereInput = { organization_id: tenant.id };

  if (search) {
    where.users = {
      OR: [
        { full_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const [rows, total] = await Promise.all([
    prisma.user_organizations.findMany({
      where,
      select: MEMBERSHIP_SELECT,
      orderBy: [{ is_active: 'desc' }, { create_date: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user_organizations.count({ where }),
  ]);

  const userIds = rows.map((row) => row.user_id);
  const roleAssignments = userIds.length === 0
    ? []
    : await prisma.user_roles.findMany({
        where: {
          organization_id: tenant.id,
          user_id: { in: userIds },
          roles: { scope: 'tenant' },
        },
        select: ROLE_ASSIGNMENT_SELECT,
        orderBy: { id: 'asc' },
      });

  const rolesByUser = new Map<number, typeof roleAssignments>();
  for (const assignment of roleAssignments) {
    const current = rolesByUser.get(assignment.user_id) ?? [];
    current.push(assignment);
    rolesByUser.set(assignment.user_id, current);
  }

  return {
    data: rows.map((membership) => ({
      id: membership.id,
      userId: membership.user_id,
      organizationId: membership.organization_id,
      isPrimary: membership.is_primary,
      isActive: membership.is_active,
      createdAt: membership.create_date,
      updatedAt: membership.write_date,
      user: {
        id: membership.users.id,
        fullName: membership.users.full_name,
        email: membership.users.email,
        isActive: membership.users.is_active,
      },
      tenantRoles: (rolesByUser.get(membership.user_id) ?? []).map((assignment) => ({
        id: assignment.id,
        roleId: assignment.role_id,
        organizationNodeId: assignment.organization_node_id,
        role: {
          id: assignment.roles.id,
          code: assignment.roles.code,
          nameAr: assignment.roles.name_ar,
          nameEn: assignment.roles.name_en,
          scope: assignment.roles.scope,
          organizationId: assignment.roles.organization_id,
        },
        organizationNode: assignment.organization_node
          ? {
              id: assignment.organization_node.id,
              legalName: assignment.organization_node.legal_name,
              shortName: assignment.organization_node.short_name,
              code: assignment.organization_node.code,
            }
          : null,
      })),
    })),
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

export const listTenantRoles = async (organizationId: string | number) => {
  const tenant = await assertActiveTenant(organizationId);
  const roles = await prisma.roles.findMany({
    where: {
      scope: 'tenant',
      is_active: true,
      OR: [{ organization_id: null }, { organization_id: tenant.id }],
    },
    orderBy: [{ is_system: 'desc' }, { code: 'asc' }, { id: 'asc' }],
    select: ROLE_SELECT,
  });

  return roles.map((role) => ({
    id: role.id,
    code: role.code,
    nameAr: role.name_ar,
    nameEn: role.name_en,
    description: role.description,
    organizationId: role.organization_id,
    isSystem: role.is_system,
    isActive: role.is_active,
    scope: role.scope,
  }));
};

export const listTenantOrganizationNodes = async (organizationId: string | number) => {
  const tenant = await assertActiveTenant(organizationId);
  const nodes = await prisma.organizations.findMany({
    where: {
      is_active: true,
      deleted_at: null,
      OR: [{ id: tenant.id }, { root_organization_id: tenant.id }],
    },
    orderBy: [{ parent_id: 'asc' }, { id: 'asc' }],
    select: NODE_SELECT,
  });

  return nodes.map((node) => ({
    id: node.id,
    name: node.legal_name,
    shortName: node.short_name,
    code: node.code,
    parentId: node.parent_id,
    rootOrganizationId: node.root_organization_id,
    orgUnitTypeId: node.org_unit_type_id,
    isActive: node.is_active,
    unitType: node.org_unit_type
      ? {
          id: node.org_unit_type.id,
          code: node.org_unit_type.code,
          nameAr: node.org_unit_type.name_ar,
          nameEn: node.org_unit_type.name_en,
          hierarchyLevel: node.org_unit_type.hierarchy_level,
        }
      : null,
  }));
};
