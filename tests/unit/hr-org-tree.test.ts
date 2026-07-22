import { describe, expect, it } from 'vitest'
import {
  buildForest,
  computeDepth,
  wouldCreateCycle,
} from '#/server/hr/org-tree'

// Pure organization-hierarchy helpers used by the HR organization service to
// keep the department / cost-center tree acyclic and correctly depth-stamped.

const nodes = [
  { id: 'a', parentId: null },
  { id: 'b', parentId: 'a' },
  { id: 'c', parentId: 'b' },
  { id: 'd', parentId: 'a' },
]

describe('wouldCreateCycle', () => {
  it('allows a null parent (top level)', () => {
    expect(wouldCreateCycle(nodes, 'b', null)).toBe(false)
  })

  it('rejects self-parenting', () => {
    expect(wouldCreateCycle(nodes, 'a', 'a')).toBe(true)
  })

  it('rejects making a node a child of its own descendant', () => {
    // a -> b -> c ; making a report to c would close a loop
    expect(wouldCreateCycle(nodes, 'a', 'c')).toBe(true)
  })

  it('allows a valid re-parent that does not close a loop', () => {
    // move c under d (sibling branch) — no cycle
    expect(wouldCreateCycle(nodes, 'c', 'd')).toBe(false)
  })
})

describe('computeDepth', () => {
  it('reports 0 for a root', () => {
    expect(computeDepth(nodes, 'a')).toBe(0)
  })

  it('counts the parent chain', () => {
    expect(computeDepth(nodes, 'c')).toBe(2)
  })

  it('returns -1 when a pre-existing cycle is present', () => {
    const cyclic = [
      { id: 'x', parentId: 'y' },
      { id: 'y', parentId: 'x' },
    ]
    expect(computeDepth(cyclic, 'x')).toBe(-1)
  })
})

describe('buildForest', () => {
  it('nests children under their parents and stamps depth', () => {
    const roots = buildForest(nodes)
    expect(roots).toHaveLength(1)
    const root = roots[0]
    expect(root.node.id).toBe('a')
    expect(root.depth).toBe(0)
    expect(root.children.map((c) => c.node.id).sort()).toEqual(['b', 'd'])

    const b = root.children.find((c) => c.node.id === 'b')
    expect(b?.depth).toBe(1)
    expect(b?.children[0]?.node.id).toBe('c')
    expect(b?.children[0]?.depth).toBe(2)
  })

  it('treats nodes with a missing parent as roots', () => {
    const orphans = [
      { id: 'p', parentId: 'gone' },
      { id: 'q', parentId: null },
    ]
    const roots = buildForest(orphans)
    expect(roots.map((r) => r.node.id).sort()).toEqual(['p', 'q'])
  })
})
