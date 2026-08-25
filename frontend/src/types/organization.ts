import type { OrganizationNodeDto } from '../api/adminApi';

export interface OrganizationNode extends OrganizationNodeDto {
  children: OrganizationNode[];
  depth: number;
}

export function fromOrganizationNodeDto(dto: OrganizationNodeDto): OrganizationNode {
  return {
    ...dto,
    children: [],
    depth: 0,
  };
}