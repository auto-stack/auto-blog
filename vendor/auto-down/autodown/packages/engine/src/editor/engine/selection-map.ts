// Selection mapping (plan 024 Phase 1): DOM Range ↔ (blockId, lo, hi) for a
// single rich host. The offset walk is a pure function over a WalkNode tree
// (headless-testable via walkFromMini); the real-DOM side is a thin adapter
// and is pinned by e2e. Cross-block / cross-host selections return null —
// the documented v1 single-block limitation.

export interface WalkNode {
  readonly raw: unknown
  readonly isText: boolean
  readonly text: string
  readonly children: WalkNode[]
}

/** Minimal structural description of a rich host (test / injectable input). */
export interface MiniNode {
  text?: string
  children?: MiniNode[]
}

export function walkFromMini(m: MiniNode): WalkNode {
  if (m.text !== undefined) return { raw: m, isText: true, text: m.text, children: [] }
  return { raw: m, isText: false, text: '', children: (m.children ?? []).map(walkFromMini) }
}

function walkFromDom(n: Node): WalkNode {
  if (n.nodeType === 3) return { raw: n, isText: true, text: n.textContent ?? '', children: [] }
  return { raw: n, isText: false, text: '', children: Array.from(n.childNodes).map(walkFromDom) }
}

interface Leaf {
  node: WalkNode
  start: number
  len: number
}

function textLeaves(root: WalkNode): { leaves: Leaf[]; total: number } {
  const leaves: Leaf[] = []
  let total = 0
  const walk = (n: WalkNode): void => {
    if (n.isText) {
      leaves.push({ node: n, start: total, len: n.text.length })
      total += n.text.length
    } else {
      n.children.forEach(walk)
    }
  }
  walk(root)
  return { leaves, total }
}

function findNode(root: WalkNode, raw: unknown): WalkNode | null {
  if (root.raw === raw) return root
  for (const c of root.children) {
    const hit = findNode(c, raw)
    if (hit) return hit
  }
  return null
}

/** Model offset of a DOM point (container identity + DOM offset). Text nodes
 *  map through their accumulated prefix; element offsets resolve the child
 *  boundary to the nearest text position. -1 = not under this host / no text. */
export function pointOffset(root: WalkNode, containerRaw: unknown, domOffset: number): number {
  const container = findNode(root, containerRaw)
  if (!container) return -1
  const { leaves } = textLeaves(root)
  if (container.isText) {
    const leaf = leaves.find((l) => l.node.raw === containerRaw)
    if (!leaf) return -1
    return leaf.start + Math.max(0, Math.min(domOffset, leaf.len))
  }
  // element container: boundary before children[domOffset]
  const k = Math.max(0, domOffset)
  const after = leaves.find((l) => {
    // is l.node inside container via a child with index >= k?
    let n: WalkNode | undefined = l.node
    let last: WalkNode | undefined
    while (n && n !== container) {
      last = n
      n = parentOf(root, n)
    }
    if (!n || !last) return false
    return container.children.indexOf(last) >= k
  })
  if (after) return after.start
  // boundary sits after all of container's text
  const inside = leaves.filter((l) => containsRaw(container, l.node.raw))
  if (inside.length === 0) return -1
  const last = inside[inside.length - 1]
  return last.start + last.len
}

function parentOf(root: WalkNode, target: WalkNode): WalkNode | undefined {
  for (const c of root.children) {
    if (c === target) return root
    const hit = parentOf(c, target)
    if (hit) return hit
  }
  return undefined
}

function containsRaw(root: WalkNode, raw: unknown): boolean {
  return !!findNode(root, raw)
}

/** DOM anchor for a model offset: {raw text node, inner offset}. Boundaries
 *  anchor at the end of the earlier leaf. Null only for a textless host. */
export function offsetPoint(root: WalkNode, offset: number): { raw: unknown; inner: number } | null {
  const { leaves, total } = textLeaves(root)
  if (leaves.length === 0) return null
  const o = Math.max(0, Math.min(offset, total))
  for (const l of leaves) {
    if (o <= l.start + l.len) return { raw: l.node.raw, inner: o - l.start }
  }
  const last = leaves[leaves.length - 1]
  return { raw: last.node.raw, inner: last.len }
}

export interface BlockRange {
  blockId: string
  lo: number
  hi: number
}

/** Current window selection as a single-host block range; null when the
 *  selection is empty, outside the host, or crosses hosts (v1: single-block). */
export function domRangeToBlockRange(hostEl: HTMLElement, blockId: string): BlockRange | null {
  const sel = typeof window === 'undefined' ? null : window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  if (range.collapsed) return null
  if (!hostEl.contains(range.startContainer) || !hostEl.contains(range.endContainer)) return null
  const root = walkFromDom(hostEl)
  const lo = pointOffset(root, range.startContainer, range.startOffset)
  const hi = pointOffset(root, range.endContainer, range.endOffset)
  if (lo < 0 || hi < 0) return null
  return { blockId, lo: Math.min(lo, hi), hi: Math.max(lo, hi) }
}

/** Reverse mapping: build a DOM Range for [lo, hi) inside the host. */
export function blockRangeToDomRange(hostEl: HTMLElement, lo: number, hi: number): Range {
  const root = walkFromDom(hostEl)
  const doc = hostEl.ownerDocument
  const range = doc.createRange()
  const a = offsetPoint(root, Math.min(lo, hi))
  const b = offsetPoint(root, Math.max(lo, hi))
  if (!a || !b) {
    range.selectNodeContents(hostEl)
    return range
  }
  range.setStart(a.raw as Node, a.inner)
  range.setEnd(b.raw as Node, b.inner)
  return range
}
