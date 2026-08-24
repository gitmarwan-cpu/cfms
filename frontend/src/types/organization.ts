import type { OrgUnit } from '../api/adminApi';

export interface OrganizationNode {
  id: number;
  name: string;
  code: string | null;
  parentId: number | null;
  isActive: boolean;
  organizationId: number;
  orgUnitTypeId: number;
  unitType: { id: number; code: string; nameAr: string; nameEn: string | null } | null;
  manager: { id: number; fullName: string; email: string } | null;
  children: OrganizationNode[];
  depth: number;
}

export function fromOrgUnitDto(dto: OrgUnit): OrganizationNode {
  return {
    id: dto.id,
    name: dto.name,
    code: dto.code,
    parentId: dto.parentId,
    isActive: dto.isActive,
    organizationId: dto.organizationId,
    orgUnitTypeId: dto.orgUnitTypeId,
    unitType: dto.unitType ?? null,
    manager: dto.manager ?? null,
    children: [],
    depth: 0,
  };
}