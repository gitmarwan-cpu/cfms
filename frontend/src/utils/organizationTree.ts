import type { OrganizationNode } from '../types/organization';

/**
 * Constructs a hierarchical tree of `OrganizationNode` items from a flat list of DTOs.
 * Uses `node.parentId` as the authoritative relationship.
 */
export function buildOrgTree(nodes: OrganizationNode[]): OrganizationNode[] {
  const nodeMap = new Map<number, OrganizationNode>();
  const roots: OrganizationNode[] = [];

  for (const node of nodes) {
    nodeMap.set(node.id, { ...node, children: [], depth: 0 });
  }

  for (const node of nodeMap.values()) {
    if (node.parentId !== null && node.parentId !== undefined) {
      const parent = nodeMap.get(node.parentId);
      if (parent && parent.id !== node.id) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  // Compute depth for indentation and visual hierarchy guides
  for (const node of nodeMap.values()) {
    let depth = 0;
    const seen = new Set<number>([node.id]);
    let cursor: OrganizationNode | undefined = node;
    while (cursor.parentId !== null && cursor.parentId !== undefined && depth < nodes.length) {
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

/**
 * Searches the tree by legalName, shortName, code, or unitType names.
 * Retains parent hierarchy context so matching child nodes remain in context.
 */
export function filterOrgTree(roots: OrganizationNode[], query: string): OrganizationNode[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return roots;

  const matches = (node: OrganizationNode): boolean => {
    const nameMatch = node.name.toLowerCase().includes(normalized);
    const shortMatch = node.shortName ? node.shortName.toLowerCase().includes(normalized) : false;
    const codeMatch = node.code ? node.code.toLowerCase().includes(normalized) : false;
    const typeMatchAr = node.unitType ? node.unitType.nameAr.toLowerCase().includes(normalized) : false;
    const typeMatchEn = node.unitType && node.unitType.nameEn ? node.unitType.nameEn.toLowerCase().includes(normalized) : false;
    return nameMatch || shortMatch || codeMatch || typeMatchAr || typeMatchEn;
  };

  const filterNode = (node: OrganizationNode): OrganizationNode | null => {
    const isSelfMatch = matches(node);
    const filteredChildren: OrganizationNode[] = [];

    for (const child of node.children) {
      const filteredChild = filterNode(child);
      if (filteredChild) {
        filteredChildren.push(filteredChild);
      }
    }

    if (isSelfMatch || filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren,
      };
    }

    return null;
  };

  const result: OrganizationNode[] = [];
  for (const root of roots) {
    const filtered = filterNode(root);
    if (filtered) {
      result.push(filtered);
    }
  }

  return result;
}

/**
 * Returns the ordered array of nodes from root down to the given `nodeId`.
 */
export function getHierarchyPath(
  nodeId: number,
  nodes: OrganizationNode[]
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
    current = current.parentId !== null && current.parentId !== undefined ? (map.get(current.parentId) ?? undefined) : undefined;
  }
  return path;
}