import type { OrganizationNode } from '../types/organization';

export function buildOrgTree(nodes: OrganizationNode[]): OrganizationNode[] {
  const nodeMap = new Map<number, OrganizationNode>();
  const roots: OrganizationNode[] = [];

  for (const node of nodes) {
    nodeMap.set(node.id, { ...node, children: [], depth: 0 });
  }

  for (const node of nodeMap.values()) {
    if (node.parentId !== null) {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  // Depth is computed independently of the input order by walking each
  // node's ancestry. A visited-guard keeps this terminating even if the
  // input contains a cycle (re-parenting a unit below one of its own
  // descendants is not blocked by the org-unit API).
  for (const node of nodeMap.values()) {
    let depth = 0;
    const seen = new Set<number>([node.id]);
    let cursor: OrganizationNode | undefined = node;
    while (cursor.parentId !== null && depth < nodes.length) {
      const parent = nodeMap.get(cursor.parentId);
      if (!parent || seen.has(parent.id)) break;
      seen.add(parent.id);
      depth += 1;
      cursor = parent;
    }
    node.depth = depth;
  }

  return roots;
}

export function getHierarchyPath(
  nodeId: number,
  nodes: OrganizationNode[],
): OrganizationNode[] {
  const map = new Map<number, OrganizationNode>();
  for (const node of nodes) {
    map.set(node.id, node);
  }

  const path: OrganizationNode[] = [];
  const seen = new Set<number>();
  let current = map.get(nodeId);
  while (current) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId !== null ? (map.get(current.parentId) ?? undefined) : undefined;
  }
  return path;
}