// SelectionAdapter (plan 036 T2, D1) — the platform-neutral inline
// selection/mark verb contract, with the DOM implementation migrated
// line-for-line from the retired dom-marks.ts (plan 024 P3). The
// wrap-in-LIVE-host-DOM semantics stay (architecture ruling ②: the model
// catches up on the blur writeback; the adapter abstracts only the verb
// face — the iced rich_text VM backend implements this same interface over
// its own selection model, 034 RichTextHost platform-face caliber).
//
// Contract notes (EDITOR-CONTRACT §行内选型平台面):
// - TextRange offsets are FLAT-TEXT coordinates over the block's inline
//   content, the same coordinate system domRootToSpans walks back into
//   (nbsp normalized at the boundary).
// - Interaction strategy (window.prompt etc.) stays at the call sites —
//   the adapter only receives results (applyMark(mark, href)).

import { Mark } from '../../parser/block-model'

/** Flat-text selection inside one block (model spans coordinates). */
export interface TextRange {
  blockId: string
  start: number
  end: number
}

/** The inline selection/mark verb face (D1 frozen interface). All verbs
 *  report success — false means no usable selection (no focused host,
 *  collapsed, or outside the host), the historical dom-marks no-op. */
export interface SelectionAdapter {
  /** The live selection as model coordinates, or null. */
  getSelection(): TextRange | null
  /** True iff the whole selection sits inside one run of `mark`. */
  isActive(mark: Mark): boolean
  /** Apply `mark` to the selection (Link takes the href; an existing link
   *  re-hrefs in place). Returns false when there is no usable selection. */
  applyMark(mark: Mark, href?: string): boolean
  /** Remove `mark` from the selection (unwrap the enclosing run). */
  removeMark(mark: Mark): boolean
}

// -- focused host registration (the retired dom-marks slot, same names) --

let focusedRichHost: HTMLElement | null = null

export function setFocusedRichHost(el: HTMLElement | null): void {
  focusedRichHost = el
}

export function getFocusedRichHost(): HTMLElement | null {
  return focusedRichHost
}

const TAG_ALIASES: Record<string, string[]> = {
  strong: ['strong', 'b'],
  em: ['em', 'i'],
  del: ['del', 's'],
  u: ['u'],
  code: ['code'],
}

/** Mark → the wrap tag of the DOM implementation (Mark.Image has no wrap
 *  face — as before, no call site ever applied it). */
const MARK_TAGS: Partial<Record<Mark, string>> = {
  [Mark.Strong]: 'strong',
  [Mark.Em]: 'em',
  [Mark.Del]: 'del',
  [Mark.Underline]: 'u',
  [Mark.Code]: 'code',
}

/** Active DOM Range inside the focused host, or null (no selection /
 *  collapsed / outside the host). */
function hostRange(host: HTMLElement): Range | null {
  const sel = typeof window === 'undefined' ? null : window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  if (range.collapsed) return null
  if (!host.contains(range.startContainer) || !host.contains(range.endContainer)) return null
  return range
}

/** Nearest ancestor of `node` (up to `host`) matching one of the tags. */
function enclosingTag(host: HTMLElement, node: Node | null, tags: string[]): HTMLElement | null {
  let n: Node | null = node
  while (n && n !== host) {
    if (n.nodeType === 1) {
      const el = n as HTMLElement
      if (tags.includes(el.tagName.toLowerCase())) return el
    }
    n = n.parentNode
  }
  return null
}

/** Flat-text offset of a boundary point (the caretOffset math over the
 *  host subtree), nbsp-normalized like the blur walk's coordinates. */
function textOffset(host: HTMLElement, container: Node, offset: number): number {
  const range = document.createRange()
  range.selectNodeContents(host)
  try {
    range.setEnd(container, offset)
  } catch {
    return 0
  }
  return range.toString().replace(/\u00A0/g, ' ').length
}

/** The whole-selection-inside-one-run check — exactly domToggleMark's old
 *  unwrap condition, as a read. */
function isActiveTag(host: HTMLElement, range: Range, tags: string[]): boolean {
  const wrap = enclosingTag(host, range.startContainer, tags)
  return (
    wrap != null &&
    wrap === enclosingTag(host, range.endContainer, tags) &&
    wrap.contains(range.commonAncestorContainer)
  )
}

function unwrapEl(wrap: HTMLElement): void {
  const parent = wrap.parentNode
  if (parent) {
    while (wrap.firstChild) parent.insertBefore(wrap.firstChild, wrap)
    parent.removeChild(wrap)
    parent.normalize()
  }
}

function surroundWith(range: Range, el: HTMLElement, host: HTMLElement): void {
  try {
    range.surroundContents(el)
  } catch {
    // range crosses element boundaries: extract + wrap + reinsert
    void host
    const frag = range.extractContents()
    el.appendChild(frag)
    range.insertNode(el)
  }
}

/** The DOM implementation: the retired dom-marks.ts bodies, byte-aligned.
 *  The focused host is registered by the ext bridge on focus; everything
 *  here is e2e-pinned (headless envs no-op through the null host slot). */
export const domSelectionAdapter: SelectionAdapter = {
  getSelection(): TextRange | null {
    const host = focusedRichHost
    if (!host) return null
    const range = hostRange(host)
    if (!range) return null
    const blockId = host.dataset.blockId ?? ''
    return {
      blockId,
      start: textOffset(host, range.startContainer, range.startOffset),
      end: textOffset(host, range.endContainer, range.endOffset),
    }
  },

  isActive(mark: Mark): boolean {
    const host = focusedRichHost
    if (!host) return false
    const range = hostRange(host)
    if (!range) return false
    if (mark === Mark.Link) {
      const a = enclosingTag(host, range.startContainer, ['a'])
      return a != null && a === enclosingTag(host, range.endContainer, ['a'])
    }
    const tag = MARK_TAGS[mark]
    if (tag == null) return false
    return isActiveTag(host, range, TAG_ALIASES[tag])
  },

  applyMark(mark: Mark, href?: string): boolean {
    const host = focusedRichHost
    if (!host) return false
    const range = hostRange(host)
    if (!range) return false
    if (mark === Mark.Link) {
      // domSetLink truth table: falsy href on an existing link unwraps
      // (the unsetLink projection — removeMark); truthy hrefs set or wrap.
      if (href == null || href === '') return domSelectionAdapter.removeMark!(Mark.Link)
      const existing = enclosingTag(host, range.startContainer, ['a'])
      if (existing && existing === enclosingTag(host, range.endContainer, ['a'])) {
        existing.setAttribute('href', href)
        existing.setAttribute('contenteditable', 'false')
        existing.setAttribute('data-autodown-link', '')
        return true
      }
      const a = host.ownerDocument.createElement('a')
      a.setAttribute('href', href)
      a.setAttribute('contenteditable', 'false')
      a.setAttribute('data-autodown-link', '')
      surroundWith(range, a, host)
      return true
    }
    const tag = MARK_TAGS[mark]
    if (tag == null) return false
    const el = host.ownerDocument.createElement(tag)
    surroundWith(range, el, host)
    return true
  },

  removeMark(mark: Mark): boolean {
    const host = focusedRichHost
    if (!host) return false
    const range = hostRange(host)
    if (!range) return false
    if (mark === Mark.Link) {
      const existing = enclosingTag(host, range.startContainer, ['a'])
      if (existing && existing === enclosingTag(host, range.endContainer, ['a'])) {
        const parent = existing.parentNode
        if (parent) {
          while (existing.firstChild) parent.insertBefore(existing.firstChild, existing)
          parent.removeChild(existing)
        }
        return true
      }
      return false
    }
    const tag = MARK_TAGS[mark]
    if (tag == null) return false
    const tags = TAG_ALIASES[tag]
    if (!isActiveTag(host, range, tags)) return false
    unwrapEl(enclosingTag(host, range.startContainer, tags)!)
    return true
  },
}

/** PLAN-600 T-04 (plan-062): marks whose styled element encloses the
 *  COLLAPSED caret in the focused rich host — the cancel-channel source.
 *  hostRange/isActive are selection-oriented (collapsed → null), so this
 *  walks the start container directly. Empty when no focused host / plain
 *  text. */
export function activeMarksAtCaret(): Mark[] {
  const host = focusedRichHost
  const sel = typeof window === 'undefined' ? null : window.getSelection()
  if (!host || !sel || sel.rangeCount === 0) return []
  const range = sel.getRangeAt(0)
  if (!host.contains(range.startContainer)) return []
  const out: Mark[] = []
  for (const m of [Mark.Strong, Mark.Em, Mark.Underline, Mark.Del, Mark.Code]) {
    const tag = MARK_TAGS[m]
    if (tag != null && enclosingTag(host, range.startContainer, TAG_ALIASES[tag] ?? [tag])) {
      out.push(m)
    }
  }
  return out
}

/** PLAN-600/062: unwrap the styled element enclosing the COLLAPSED caret
 *  (the bubble cancel channel at a bare caret). False when the caret is
 *  not in the host or sits in plain text. */
export function removeMarkAtCaret(mark: Mark): boolean {
  const host = focusedRichHost
  const sel = typeof window === 'undefined' ? null : window.getSelection()
  if (!host || !sel || sel.rangeCount === 0) return false
  const range = sel.getRangeAt(0)
  if (!host.contains(range.startContainer)) return false
  const tag = MARK_TAGS[mark]
  if (tag == null) return false
  const wrap = enclosingTag(host, range.startContainer, TAG_ALIASES[tag] ?? [tag])
  if (!wrap) return false
  unwrapEl(wrap)
  return true
}

/** The old domToggleMark decision (isActive ? remove : apply) — a module
 *  convenience for the call sites, deliberately OUTSIDE the frozen
 *  four-method interface (D1). */
export function toggleMark(adapter: SelectionAdapter, mark: Mark): boolean {
  if (adapter === (domSelectionAdapter as SelectionAdapter)) {
    // plan-062 T-04 cancel channel: a collapsed caret has no DOM range for
    // the wrap/unwrap protocol — unwrap the enclosing styled element
    // directly (apply-at-caret is the stored-mark domain, out of scope).
    if (adapter.getSelection() == null) return removeMarkAtCaret(mark)
  }
  return adapter.isActive(mark) ? adapter.removeMark(mark) : adapter.applyMark(mark)
}
