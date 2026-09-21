import prisma from '../prisma/client';

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

export { getUserRoleAssignments };
