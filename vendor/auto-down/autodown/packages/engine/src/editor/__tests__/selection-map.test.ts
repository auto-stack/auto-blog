// Selection mapping tests (plan 024 Phase 1): pure offset-walk core over a
// mini node-tree description — DOM Range ↔ (blockId, lo, hi). The real-DOM
// side is pinned by e2e (inline-marks.spec.ts), not here.

import { describe, expect, it } from 'vitest'
import {
  domRangeToBlockRange,
  offsetPoint,
  pointOffset,
  walkFromMini,
  type MiniNode,
} from '../engine/selection-map'

// p > ["ab", strong > ["cd"], a > ["ef"], "g"] — pieces "ab"|"cd"|"ef"|"g", total 7
function richHost(): ReturnType<typeof walkFromMini> {
  const mini: MiniNode = {
    children: [
      { text: 'ab' },
      { children: [{ text: 'cd' }] },
      { children: [{ text: 'ef' }] },
      { text: 'g' },
    ],
  }
  return walkFromMini(mini)
}

const leaves = (root: ReturnType<typeof walkFromMini>) => {
  const out: { raw: unknown; text: string }[] = []
  const walk = (n: typeof root): void => {
    if (n.isText) out.push({ raw: n.raw, text: n.text })
    else n.children.forEach(walk)
  }
  walk(root)
  return out
}

describe('pointOffset (DOM point → model offset)', () => {
  it('maps a text-node point by accumulated prefix', () => {
    const root = richHost()
    const [ab, cd] = leaves(root)
    expect(pointOffset(root, ab.raw, 1)).toBe(1)
    expect(pointOffset(root, cd.raw, 1)).toBe(3)
  })

  it('maps element child-index boundaries (before strong / between a / after all)', () => {
    const root = richHost()
    const [, , ef] = leaves(root)
    expect(pointOffset(root, ef.raw, 0)).toBe(4)
    // boundary before child 0 (the "ab" text) → start of first leaf
    expect(pointOffset(root, root.raw, 0)).toBe(0)
    // boundary before child 2 (the <a>) → start of "ef"
    expect(pointOffset(root, root.raw, 2)).toBe(4)
    // boundary after the last child → total length
    expect(pointOffset(root, root.raw, 4)).toBe(7)
  })

  it('resolves a boundary at the end of a nested element with only text', () => {
    const root = richHost()
    const strong = root.children[1]
    expect(pointOffset(root, strong.raw, 1)).toBe(4)
  })

  it('returns -1 for a container outside the host (跨块 null 语义的纯侧)', () => {
    const root = richHost()
    expect(pointOffset(root, { outside: true }, 0)).toBe(-1)
  })
})

describe('offsetPoint (model offset → DOM anchor)', () => {
  it('lands inside the containing leaf', () => {
    const root = richHost()
    const [, cd] = leaves(root)
    const p = offsetPoint(root, 3)
    expect(p?.raw).toBe(cd.raw)
    expect(p?.inner).toBe(1)
  })

  it('clamps to the first/last leaf at the extremes', () => {
    const root = richHost()
    const [ab, , , g] = leaves(root)
    expect(offsetPoint(root, 0)).toMatchObject({ raw: ab.raw, inner: 0 })
    expect(offsetPoint(root, 99)).toMatchObject({ raw: g.raw, inner: 1 })
  })

  it('anchors a piece boundary at the end of the earlier leaf', () => {
    const root = richHost()
    const [, cd] = leaves(root)
    expect(offsetPoint(root, 4)).toMatchObject({ raw: cd.raw, inner: 2 })
  })
})

describe('domRangeToBlockRange null semantics', () => {
  it('returns null without a window selection (headless)', () => {
    expect(domRangeToBlockRange({} as HTMLElement, 'p1')).toBeNull()
  })
})
