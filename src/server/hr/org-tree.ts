// Pure organization-hierarchy helpers — no Prisma, no I/O — so they can be
// exhaustively unit-tested. Used by the organization service to validate parent
// links (no cycles) and to materialize a department/cost-center tree.

export interface HierNode {
  id: string
  parentId: string | null
}

export interface TreeNode<T extends HierNode> {
  node: T
  depth: number
  children: Array<TreeNode<T>>
}

// Returns true if setting `parentId` as the parent of `nodeId` would create a
// cycle (including the self-parent case), given the current parent links.
export function wouldCreateCycle<T extends HierNode>(
  nodes: ReadonlyArray<T>,
  nodeId: string,
  parentId: string | null,
): boolean {
  if (!parentId) {
    return false
  }

  if (parentId === nodeId) {
    return true
  }

  const parentById = new Map<string, string | null>()
  for (const node of nodes) {
    parentById.set(node.id, node.parentId)
  }
  // Apply the proposed link on top of the current graph.
  parentById.set(nodeId, parentId)

  const seen = new Set<string>()
  let current: string | null = parentId

  while (current) {
    if (current === nodeId) {
      return true
    }

    if (seen.has(current)) {
      // A pre-existing cycle upstream — treat as unsafe.
      return true
    }

    seen.add(current)
    current = parentById.get(current) ?? null
  }

  return false
}

// Computes the 0-based depth of a node by walking parent links. Returns -1 if a
// cycle is detected before reaching a root.
export function computeDepth<T extends HierNode>(
  nodes: ReadonlyArray<T>,
  nodeId: string,
): number {
  const parentById = new Map<string, string | null>()
  for (const node of nodes) {
    parentById.set(node.id, node.parentId)
  }

  let depth = 0
  const seen = new Set<string>()
  let current = parentById.get(nodeId) ?? null

  while (current) {
    if (seen.has(current)) {
      return -1
    }

    seen.add(current)
    depth += 1
    current = parentById.get(current) ?? null
  }

  return depth
}

// Builds a forest (array of roots) from a flat list. Nodes whose parent is
// missing from the set are treated as roots. Stable order follows input order.
export function buildForest<T extends HierNode>(
  nodes: ReadonlyArray<T>,
): Array<TreeNode<T>> {
  const wrapperById = new Map<string, TreeNode<T>>()
  for (const node of nodes) {
    wrapperById.set(node.id, { node, depth: 0, children: [] })
  }

  const roots: Array<TreeNode<T>> = []

  for (const node of nodes) {
    const wrapper = wrapperById.get(node.id)
    if (!wrapper) {
      continue
    }

    const parentWrapper = node.parentId
      ? wrapperById.get(node.parentId)
      : undefined

    if (parentWrapper && parentWrapper !== wrapper) {
      parentWrapper.children.push(wrapper)
    } else {
      roots.push(wrapper)
    }
  }

  // Assign depths via BFS from each root.
  const assignDepth = (root: TreeNode<T>) => {
    const queue: Array<TreeNode<T>> = [root]
    root.depth = 0
    while (queue.length > 0) {
      const current = queue.shift() as TreeNode<T>
      for (const child of current.children) {
        child.depth = current.depth + 1
        queue.push(child)
      }
    }
  }

  for (const root of roots) {
    assignDepth(root)
  }

  return roots
}
