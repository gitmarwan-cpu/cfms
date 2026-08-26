import prisma from '../prisma/client';

export interface EffectivePermission {
  code: string;
  organizationId: number;
  orgUnitId: number | null;
}

interface AssignmentRole {
  code: string;
  permissions: Array<{ code: string }>;
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
      role_permissions: { select: { permissions: { select: { code: true } } } },
    },
  },
} as const;

const getUserRoleAssignments = async (userId: number): Promise<DirectAssignment[]> => {
  const assignments = await prisma.user_roles.findMany({
    where: { user_id: userId, roles: { is_active: true } },
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

// Retained for migration/audit inspection only. Effective authorization must not call this path.
const getUserGroupRoleAssignments = async (userId: number): Promise<DirectAssignment[]> => {
  const memberships = await prisma.user_groups.findMany({
    where: { user_id: userId, groups: { is_active: true } },
    select: {
      organization_id: true,
      groups: {
        select: {
          group_roles: {
            where: { roles: { is_active: true } },
            select: {
              roles: {
                select: {
                  code: true,
                  role_permissions: { select: { permissions: { select: { code: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });

  return memberships.flatMap((membership) =>
    membership.groups.group_roles.map(({ roles }) => ({
      organizationId: membership.organization_id,
      orgUnitId: null,
      role: {
        code: roles.code,
        permissions: roles.role_permissions.map(({ permissions }) => permissions),
      },
    }))
  );
};

export const getEffectiveRoleCodes = async (userId: number): Promise<string[]> => {
  const directAssignments = await getUserRoleAssignments(userId);
  return [...new Set(directAssignments.map(({ role }) => role.code))];
};

export const getEffectivePermissions = async (userId: number): Promise<EffectivePermission[]> => {
  const directAssignments = await getUserRoleAssignments(userId);

  return directAssignments.flatMap((assignment) =>
    assignment.role.permissions.map((permission) => ({
      code: permission.code,
      organizationId: assignment.organizationId,
      orgUnitId: assignment.orgUnitId,
    }))
  );
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

export { getUserRoleAssignments, getUserGroupRoleAssignments };
