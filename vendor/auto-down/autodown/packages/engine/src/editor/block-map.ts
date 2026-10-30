// getBlockMap / BLOCK_ID_PREFIX (plan 018 Phase 4) — module-level parity
// with the retired Tiptap BlockId extension. The DOM-anchored instance
// version lives on AutoDownEditor's expose; these module exports keep the
// frozen import sites (EDITOR-CONTRACT.md §3) working.

export const BLOCK_ID_PREFIX = 'block-'

export interface BlockInfo {
  id: string
  index: number
  pos: number
  el: HTMLElement
  top: number
  height: number
}

/** Anchor block info from a rendered editor root element. */
export function getBlockMap(root?: HTMLElement | null): BlockInfo[] {
  const scope: ParentNode = root ?? document
  const els = Array.from(scope.querySelectorAll<HTMLElement>('[data-block-id]'))
  // plan 039 T4b: the focused leaf mounts inside its slot chrome, so the
  // slot and the semantic host carry the same id — the OUTERMOST element
  // (the slot) is the addressable/measure box (its geometry equals the
  // preview slot's: the leaf's margins collapse through identically). Keep
  // the first occurrence per id and renumber densely.
  const seen = new Set<string>()
  const out: BlockInfo[] = []
  for (const el of els) {
    const id = el.dataset.blockId ?? ''
    if (id !== '' && seen.has(id)) continue
    if (id !== '') seen.add(id)
    out.push({ id, index: out.length, pos: out.length, el, top: el.offsetTop, height: el.offsetHeight })
  }
  return out
}
