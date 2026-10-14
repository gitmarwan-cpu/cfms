import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';

type RbacClient = typeof prisma | Prisma.TransactionClient;

export interface EffectivePermission {
  code: string;
  organizationId: number;
  orgUnitId: number | null;
}

export interface EffectivePlatformPermission {
  code: string;
}

interface AssignmentRole {
  code: string;
  permissions: Array<{ code: string; module: string }>;
}

interface DirectAssignment {
  role: AssignmentRole;
  organizationId: number;
  orgUnitId: number | null;
}

const ROLE_ASSIGNMENT_SELECT = {
  organization_id: true,
  organization_node_id: true,
  roles: {
    select: {
      code: true,
      scope: true,
      role_permissions: { select: { permissions: { select: { code: true, module: true } } } },
    },
  },
} as const;

const getUserRoleAssignments = async (userId: number): Promise<DirectAssignment[]> => {
  const assignments = await prisma.user_roles.findMany({
    where: { user_id: userId, roles: { is_active: true, scope: 'tenant' } },
    select: ROLE_ASSIGNMENT_SELECT,
  });

  return assignments.map((assignment) => ({
    organizationId: assignment.organization_id,
    orgUnitId: assignment.organization_node_id,
    role: {
      code: assignment.roles.code,
      permissions: assignment.roles.role_permissions.map(({ permissions }) => permissions),
    },
  }));
};

const PLATFORM_ROLE_ASSIGNMENT_SELECT = {
  roles: {
    select: {
      code: true,
      scope: true,
      role_permissions: { select: { permissions: { select: { code: true, module: true } } } },
    },
  },
} as const;

const getUserPlatformRoleAssignments = async (userId: number) => prisma.user_platform_roles.findMany({
  where: { user_id: userId, roles: { is_active: true, scope: 'platform' } },
  select: PLATFORM_ROLE_ASSIGNMENT_SELECT,
});

export const getEffectiveRoleCodes = async (userId: number): Promise<string[]> => {
  const directAssignments = await getUserRoleAssignments(userId);
  return [...new Set(directAssignments.map(({ role }) => role.code))];
};

export const getEffectivePermissions = async (userId: number): Promise<EffectivePermission[]> => {
  const directAssignments = await getUserRoleAssignments(userId);

  return directAssignments.flatMap((assignment) =>
    assignment.role.permissions
      .filter((permission) => permission.module !== 'platform' && !permission.code.startsWith('platform.'))
      .map((permission) => ({
      code: permission.code,
      organizationId: assignment.organizationId,
      orgUnitId: assignment.orgUnitId,
      }))
  );
};

export const getEffectivePlatformRoleCodes = async (userId: number): Promise<string[]> => {
  const assignments = await getUserPlatformRoleAssignments(userId);
  return [...new Set(assignments.map(({ roles }) => roles.code))];
};

export const getEffectivePlatformPermissions = async (userId: number): Promise<EffectivePlatformPermission[]> => {
  const assignments = await getUserPlatformRoleAssignments(userId);
  return assignments.flatMap(({ roles }) => roles.role_permissions
    .filter(({ permissions }) => permissions.module === 'platform' && permissions.code.startsWith('platform.'))
    .map(({ permissions }) => ({ code: permissions.code })));
};

export const userHasPermission = async (
  userId: number,
  permissionCode: string,
  orgUnitId: number | null = null
): Promise<boolean> => {
  const permissions = await getEffectivePermissions(userId);
  return permissions.some((permission) => {
    if (permission.code !== permissionCode) return false;
    if (orgUnitId === null) return true;
    return permission.orgUnitId === null || permission.orgUnitId === orgUnitId;
  });
};

/**
 * Resolves active tenant-wide users from the same RBAC graph used by request
 * authorization. Node-scoped assignments are deliberately excluded because
 * this helper is only for tenant-level recipient policies.
 */
export const findTenantWideUsersWithPermissions = async (
  client: RbacClient,
  organizationId: number,
  permissionCodes: string[],
  matchMode: 'any' | 'all'
): Promise<number[]> => {
  const assignments = await client.user_roles.findMany({
    where: {
      organization_id: organizationId,
      organization_node_id: null,
      users: {
        is_active: true,
        user_organizations: {
          some: { organization_id: organizationId, is_active: true },
        },
      },
      roles: {
        is_active: true,
        scope: 'tenant',
        role_permissions: {
          some: {
            permissions: {
              code: { in: permissionCodes },
              module: { not: 'platform' },
            },
          },
        },
      },
    },
    select: {
      user_id: true,
      roles: {
        select: {
          role_permissions: {
            select: { permissions: { select: { code: true } } },
          },
        },
      },
    },
  });

  const permissionsByUser = new Map<number, Set<string>>();
  for (const assignment of assignments) {
    const granted = permissionsByUser.get(assignment.user_id) || new Set<string>();
    for (const entry of assignment.roles.role_permissions) granted.add(entry.permissions.code);
    permissionsByUser.set(assignment.user_id, granted);
  }

  return [...permissionsByUser.entries()]
    .filter(([, granted]) => matchMode === 'any'
      ? permissionCodes.some((code) => granted.has(code))
      : permissionCodes.every((code) => granted.has(code)))
    .map(([userId]) => userId);
};

export { getUserRoleAssignments };
