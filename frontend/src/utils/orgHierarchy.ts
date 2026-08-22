import type { OrgUnit } from '../api/adminApi';

export interface OrgTreeNode extends OrgUnit {
  children: OrgTreeNode[];
  depth: number;
}

/** Build a tree from a flat OrgUnit[] returned by the API. */
export function buildOrgTree(units: OrgUnit[]): OrgTreeNode[] {
  const map = new Map<number, OrgTreeNode>();
  const roots: OrgTreeNode[] = [];

  for (const u of units) {
    map.set(u.id, { ...u, children: [], depth: 0 });
  }

  for (const node of map.values()) {
    if (node.parentId !== null && map.has(node.parentId)) {
      const parent = map.get(node.parentId)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function assignDepth(nodes: OrgTreeNode[], d: number): void {
    for (const n of nodes) {
      n.depth = d;
      assignDepth(n.children, d + 1);
    }
  }
  assignDepth(roots, 0);

  return roots;
}

/** Build a parent-name chain for a unit, e.g. "الإدارة > قسم المتابعة". */
export function getHierarchyPath(unitId: number, units: OrgUnit[]): string {
  const map = new Map<number, OrgUnit>();
  for (const u of units) map.set(u.id, u);

  const parts: string[] = [];
  let current: OrgUnit | undefined = map.get(unitId);
  while (current) {
    parts.push(current.name);
    current = current.parentId !== null ? map.get(current.parentId) : undefined;
  }
  return parts.reverse().join(' > ');
}