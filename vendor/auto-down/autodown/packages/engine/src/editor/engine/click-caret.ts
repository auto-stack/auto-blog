// Click-caret handoff — the view→edit focus swap must not lose WHERE the
// user pointed. Every non-focused block renders its PREVIEW face; the click
// only selects the block (block-granular, selectBlock), the edit face then
// mounts fresh and the browser cannot carry the caret across a DOM
// replacement. Without a handoff each face falls back to its mount default
// (rich text host: end of text; code textarea: end of text), so the first
// click on any unfocused block threw the caret to the block end — the
// heading/paragraph/fence family bug.
//
// The preview-side click records the pointed-at position here; the edit
// face's mount consumes it. Module scope is the channel: the two faces are
// different component trees (and the click → select → remount sequence runs
// within one task), so a store keyed by block id is the narrowest seam.
//
// Three payloads share the store because they serve the same seam:
// - point (dx/dy relative to the block's rendered element): DOM-caret faces
//   (contenteditable rich hosts, table cells) re-resolve the point against
//   their own glyphs with the caret API after mount — no text-offset math,
//   so inline math/wikilink DOM expansions cannot skew it;
// - offset (plaintext offset): the code fence's textarea face, whose caret
//   is a string index, not a DOM range;
// - cellId: the table face's cell to focus (the cell IS the caret unit).
//
// Container slots (list/blockquote/callout/details) resolve to the clicked
// CHILD leaf instead of the deep-selection first leaf — see resolveClickHit.

import { BlockType, type BlockNode } from '../../parser/block-model'
import { editSlotFor } from '../../render/block-component'
import { COMPOSITE_CONTAINER_KINDS } from './focus-path'
import { isEditableLeaf } from './host-controller'

export interface ClickCaret {
  /** block that will take focus (the consuming face's block id) */
  blockId: string
  /** capture time — stale handoffs expire (see STALE_MS) */
  at: number
  /** point payload: click position relative to the block's rendered element */
  dx?: number
  dy?: number
  /** offset payload: plaintext offset within the block's text */
  offset?: number
  /** table faces: the cell block to focus inside the mounted face */
  cellId?: string
}

/** Handoffs older than this fall back to the face's mount default — the
 *  click landed somewhere else (keyboard focus path, programmatic select). */
const STALE_MS = 1000

let pending: ClickCaret | null = null

/** Record a handoff. Always replaces the previous entry: the click that is
 *  about to remount a face is the only one that can be pending. */
export function setClickCaret(entry: ClickCaret): void {
  pending = entry
}

export function clearClickCaret(): void {
  pending = null
}

/** Consume (and clear) the pending handoff for `blockId`. Returns null when
 *  nothing matches — the caller keeps its own default. */
export function takeClickCaret(blockId: string): ClickCaret | null {
  const entry = pending
  pending = null
  if (!entry || entry.blockId !== blockId || Date.now() - entry.at > STALE_MS) return null
  return entry
}

/** Capture the pointed-at position of a slot click: the block's own rendered
 *  element is the anchor, so the point survives the face swap even when the
 *  page shifts (the focused face mounts inside the SAME slot chrome as its
 *  preview twin — plan 039 T4b — so the anchor geometry is stable). `cellId`
 *  rides the table face's handoff (the cell is its caret unit). */
export function captureClickCaret(
  ev: MouseEvent,
  blockId: string,
  anchor: Element | null,
  cellId?: string,
): void {
  pending = null
  if (ev.button !== 0 || blockId === '' || !anchor) return
  const rect = anchor.getBoundingClientRect()
  pending = { blockId, at: Date.now(), dx: ev.clientX - rect.left, dy: ev.clientY - rect.top, cellId }
}

/** The block's own rendered element inside a slot's chrome
 *  (slot > .node-content > element). */
export function slotAnchorOf(slotEl: Element | null): HTMLElement | null {
  if (!slotEl) return null
  return (slotEl.querySelector('.node-content > *') as HTMLElement | null) ?? (slotEl as HTMLElement)
}

/** Place the DOM caret at a captured point inside the freshly mounted edit
 *  face, letting the browser re-resolve the glyph from the point (the faces
 *  are layout-identical by design, so the point lands on the same glyph the
 *  user clicked). False when the point resolves outside the host — stale
 *  geometry, or a container slot whose anchor is not this face's element —
 *  and the caller falls back to its default. */
export function placeCaretAtPoint(host: HTMLElement, entry: ClickCaret): boolean {
  if (entry.dx == null || entry.dy == null) return false
  const doc = host.ownerDocument
  const cdp = (doc as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null })
    .caretRangeFromPoint
  const cpf = (doc as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }).caretPositionFromPoint
  const rect = host.getBoundingClientRect()
  const x = rect.left + entry.dx
  const y = rect.top + entry.dy
  let range: Range | null = null
  if (typeof cdp === 'function') {
    range = cdp.call(doc, x, y)
  } else if (typeof cpf === 'function') {
    const pos = cpf.call(doc, x, y)
    if (pos) {
      range = doc.createRange()
      try {
        range.setStart(pos.offsetNode, pos.offset)
        range.collapse(true)
      } catch {
        return false
      }
    }
  }
  if (!range || !host.contains(range.startContainer)) return false
  range.collapse(true)
  const sel = doc.defaultView?.getSelection() ?? null
  if (!sel) return false
  sel.removeAllRanges()
  sel.addRange(range)
  return true
}

// -- container / table click resolution -------------------------------------------
//
// A collapsed container renders its children through the render pipeline, so
// the click lands on the OUTER container slot and deep selection would focus
// the container's FIRST leaf (plan 025) — the clicked item and its offset
// were both lost (list/blockquote/callout/details first click). The children
// ARE structurally addressable: every rendered block node sits in its own
// .node-slot wrapper (render-node.ts), in document order, and those wrappers
// pair 1:1 with the model's atomic descendants. So the click resolves to the
// wrapper under the point, pairs positionally, and hands off to that leaf.
// Table slots address the clicked CELL the same way (positional row/column);
// the cell is the table face's caret unit.

/** What a slot click addresses: the block whose edit face will mount (and
 *  consume the handoff), the element the point is recorded against (null =
 *  no point handoff), and the table cell to focus. */
export interface ClickHit {
  targetId: string
  anchor: HTMLElement | null
  cellId?: string
}

/** Does this block mount a RichTextHost edit face (the point consumer)?
 *  Mirror of the assembler's leaf branch. */
function mountsRichTextHost(node: BlockNode): boolean {
  return isEditableLeaf(node) && editSlotFor(BlockType[node.kind]) == null
}

/** Model blocks that render as ONE wrapper: everything except the composite
 *  containers (their children render nested — the wrapper is not a leaf) and
 *  ListItem (transparent: the item's own children carry the wrappers).
 *  Document order, mirroring the DOM leafWrappersOf walks. */
function atomicDescendantsOf(node: BlockNode, out: BlockNode[] = []): BlockNode[] {
  for (const child of node.children) {
    if (child.kind === BlockType.ListItem || COMPOSITE_CONTAINER_KINDS.has(child.kind)) {
      atomicDescendantsOf(child, out)
    } else {
      out.push(child)
    }
  }
  return out
}

/** The render pipeline's leaf wrappers under `content`, document order
 *  (.node-slot elements with no nested wrapper). */
function leafWrappersOf(content: Element): Element[] {
  return Array.from(content.querySelectorAll('.node-slot')).filter(
    (el) => el.querySelector('.node-slot') == null,
  )
}

/** The DOM caret the point resolves to, via the browser caret API — null in
 *  unit/SSR environments or when the point resolves outside `scope`. */
function caretNodeAt(scope: HTMLElement, x: number, y: number): Node | null {
  const doc = scope.ownerDocument
  const cdp = (doc as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null })
    .caretRangeFromPoint
  const cpf = (doc as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }).caretPositionFromPoint
  let node: Node | null = null
  if (typeof cdp === 'function') {
    node = cdp.call(doc, x, y)?.startContainer ?? null
  } else if (typeof cpf === 'function') {
    node = cpf.call(doc, x, y)?.offsetNode ?? null
  }
  return node && scope.contains(node) ? node : null
}

function elementOf(node: Node | null): HTMLElement | null {
  if (!node) return null
  return node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement)
}

/** Model cell id for a preview cell: positional (row, column) over the
 *  model's rows/cells — the preview table preserves document order. */
function tableCellIdOf(tableEl: Element, node: BlockNode, cell: Element): string {
  const tr = cell.parentElement
  if (!tr) return ''
  const rowIndex = Array.from(tableEl.querySelectorAll<HTMLElement>('tr')).indexOf(tr)
  const cellIndex = Array.from(tr.children).indexOf(cell)
  return node.children[rowIndex]?.children[cellIndex]?.id ?? ''
}

/** The block a click inside a slot addresses. Leaf slots keep the node
 *  itself; a table slot addresses the clicked cell; a collapsed container
 *  slot addresses the atomic descendant whose wrapper the point landed on
 *  (targetId '' = unresolved — the caller keeps deep selection). */
export function resolveClickHit(node: BlockNode, slotEl: Element | null, ev: MouseEvent): ClickHit {
  const content = slotAnchorOf(slotEl)
  if (!content) return { targetId: node.id, anchor: null }

  if (node.kind === BlockType.Table) {
    const cell = elementOf(caretNodeAt(content, ev.clientX, ev.clientY))?.closest('th,td') ?? null
    const cellId = cell ? tableCellIdOf(content, node, cell) : ''
    return cellId
      ? { targetId: node.id, anchor: cell as HTMLElement, cellId }
      : { targetId: node.id, anchor: null }
  }

  if (mountsRichTextHost(node)) return { targetId: node.id, anchor: content }

  const wrapper = elementOf(caretNodeAt(content, ev.clientX, ev.clientY))?.closest('.node-slot') ?? null
  if (!wrapper || wrapper === content) return { targetId: '', anchor: null }
  const wrappers = leafWrappersOf(content)
  const leaves = atomicDescendantsOf(node)
  if (wrappers.length !== leaves.length) return { targetId: '', anchor: null }
  const i = wrappers.indexOf(wrapper)
  if (i < 0) return { targetId: '', anchor: null }
  const target = leaves[i]!
  // widget faces (fence/math/table child) take focus but no point payload
  const anchor = mountsRichTextHost(target)
    ? ((wrapper.querySelector('.node-content > *') as HTMLElement | null) ?? (wrapper as HTMLElement))
    : null
  return { targetId: target.id, anchor }
}
