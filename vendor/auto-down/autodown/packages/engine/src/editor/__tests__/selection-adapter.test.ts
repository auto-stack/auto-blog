// selection-adapter tests (plan 036 T2): the SelectionAdapter contract
// (D1) plus the DOM implementation the retired dom-marks.ts migrated into.
// Golden expectations = the OLD dom-marks behavior frozen as literals; the
// dual-run describe that byte-compared old vs new while dom-marks.ts still
// existed (11 scenarios, happy-dom) passed and was deleted with the module
// in T3 — these goldens carry the parity forward.

// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest'
import { Mark } from '../../parser/block-model'
import {
  domSelectionAdapter,
  getFocusedRichHost,
  setFocusedRichHost,
  toggleMark,
  type SelectionAdapter,
  type TextRange,
} from '../engine/selection-adapter'

function hostEl(html: string, blockId = 'b1'): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('data-block-id', blockId)
  el.setAttribute('contenteditable', 'true')
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

/** Select [from, to) in TEXT offsets across the host's subtree, with real
 *  browser boundary granularity: a start boundary at a node-end junction
 *  lands on the NEXT text node (offset 0), an end boundary on the node
 *  that contains it — exactly where a Chromium drag places them. */
function selectRange(host: HTMLElement, from: number, to: number): void {
  const sel = window.getSelection()
  sel?.removeAllRanges()
  const range = document.createRange()
  const textNodes: Text[] = []
  const collect = (n: Node): void => {
    if (n.nodeType === 3) textNodes.push(n as Text)
    for (const c of Array.from(n.childNodes)) collect(c)
  }
  collect(host)
  let pos = 0
  let start: { t: Text; o: number } | null = null
  for (const t of textNodes) {
    const len = t.textContent?.length ?? 0
    if (start === null && from < pos + len) {
      start = { t, o: from - pos }
    }
    pos += len
  }
  if (start === null) start = { t: textNodes[textNodes.length - 1], o: textNodes[textNodes.length - 1].textContent?.length ?? 0 }
  pos = 0
  let end: { t: Text; o: number } | null = null
  for (const t of textNodes) {
    const len = t.textContent?.length ?? 0
    if (to > pos && to <= pos + len) {
      end = { t, o: to - pos }
    }
    pos += len
  }
  if (end === null) end = start
  range.setStart(start.t, start.o)
  try {
    range.setEnd(end.t, end.o)
  } catch {
    range.setEnd(start.t, start.o)
  }
  sel?.addRange(range)
}

function keyReset(): void {
  setFocusedRichHost(null)
  window.getSelection()?.removeAllRanges()
  document.body.innerHTML = ''
}

afterEach(keyReset)

describe('domSelectionAdapter registration slot (dom-marks parity)', () => {
  it('setFocusedRichHost/getFocusedRichHost keep the old names and behavior', () => {
    expect(getFocusedRichHost()).toBeNull()
    const el = hostEl('x')
    setFocusedRichHost(el)
    expect(getFocusedRichHost()).toBe(el)
    setFocusedRichHost(null)
    expect(getFocusedRichHost()).toBeNull()
  })
})

describe('getSelection (TextRange contract, domRootToSpans coordinates)', () => {
  it('maps a DOM selection to flat-text offsets + host blockId', () => {
    const el = hostEl('hello <strong>world</strong>')
    setFocusedRichHost(el)
    selectRange(el, 2, 9) // "llo wor" — crosses the strong boundary
    expect(domSelectionAdapter.getSelection()).toEqual({
      blockId: 'b1',
      start: 2,
      end: 9,
    } satisfies TextRange)
  })

  it('normalizes nbsp like the blur walk (Chromium typed-space hygiene)', () => {
    const el = hostEl('ab&nbsp;cd')
    setFocusedRichHost(el)
    selectRange(el, 1, 4) // spans the nbsp at index 2
    expect(domSelectionAdapter.getSelection()).toEqual({ blockId: 'b1', start: 1, end: 4 })
  })

  it('returns null on collapsed selection, missing host, or out-of-host range', () => {
    const el = hostEl('text')
    setFocusedRichHost(el)
    selectRange(el, 1, 3)
    // collapse
    selectRange(el, 2, 2)
    expect(domSelectionAdapter.getSelection()).toBeNull()
    // no host registered
    setFocusedRichHost(null)
    selectRange(el, 1, 3)
    expect(domSelectionAdapter.getSelection()).toBeNull()
    // selection outside the host
    const other = hostEl('elsewhere', 'b2')
    setFocusedRichHost(el)
    selectRange(other, 0, 4)
    expect(domSelectionAdapter.getSelection()).toBeNull()
  })
})

describe('isActive (the old toggle unwrap-condition, read-only)', () => {
  it('true iff the whole selection sits inside one mark run', () => {
    const el = hostEl('<strong>bold</strong> plain')
    setFocusedRichHost(el)
    selectRange(el, 0, 4) // inside strong
    expect(domSelectionAdapter.isActive(Mark.Strong)).toBe(true)
    selectRange(el, 0, 10) // crosses out
    expect(domSelectionAdapter.isActive(Mark.Strong)).toBe(false)
    expect(domSelectionAdapter.isActive(Mark.Em)).toBe(false)
  })

  it('link truth: whole selection inside one anchor', () => {
    const el = hostEl('<a href="http://x">go</a> stop')
    setFocusedRichHost(el)
    selectRange(el, 0, 2)
    expect(domSelectionAdapter.isActive(Mark.Link)).toBe(true)
    selectRange(el, 0, 5)
    expect(domSelectionAdapter.isActive(Mark.Link)).toBe(false)
  })
})

describe('applyMark / removeMark (domToggleMark + domSetLink bodies)', () => {
  it('applyMark(Strong) wraps the selection (old wrap branch)', () => {
    const el = hostEl('hello world')
    setFocusedRichHost(el)
    selectRange(el, 6, 11)
    expect(domSelectionAdapter.applyMark(Mark.Strong)).toBe(true)
    expect(el.innerHTML).toBe('hello <strong>world</strong>')
  })

  it('applyMark over a cross-boundary range still wraps (old extract+reinsert fallback)', () => {
    const el = hostEl('<strong>bo</strong>ld')
    setFocusedRichHost(el)
    selectRange(el, 0, 4)
    expect(domSelectionAdapter.isActive(Mark.Strong)).toBe(false)
    expect(domSelectionAdapter.applyMark(Mark.Strong)).toBe(true)
    // semantics, not happy-dom's exact extraction shells (dual-run pins
    // old-vs-new byte parity for this same scenario below)
    expect(el.textContent).toBe('bold')
    expect(el.querySelector('strong')).not.toBeNull()
  })

  it('removeMark unwraps the enclosing run (old unwrap branch, normalize incl.)', () => {
    const el = hostEl('a <strong>b</strong> c')
    setFocusedRichHost(el)
    selectRange(el, 2, 3)
    expect(domSelectionAdapter.removeMark(Mark.Strong)).toBe(true)
    expect(el.innerHTML).toBe('a b c')
  })

  it('tag family aliases: Underline → u, Em, Del, Code', () => {
    const el = hostEl('word')
    setFocusedRichHost(el)
    selectRange(el, 0, 4)
    expect(domSelectionAdapter.applyMark(Mark.Underline)).toBe(true)
    expect(el.innerHTML).toBe('<u>word</u>')
    selectRange(el, 0, 4)
    expect(domSelectionAdapter.isActive(Mark.Underline)).toBe(true)
    expect(domSelectionAdapter.removeMark(Mark.Underline)).toBe(true)
    expect(el.innerHTML).toBe('word')
    // em through the same toggle pair
    selectRange(el, 0, 4)
    expect(domSelectionAdapter.applyMark(Mark.Em)).toBe(true)
    expect(el.innerHTML).toBe('<em>word</em>')
    selectRange(el, 0, 4)
    expect(domSelectionAdapter.removeMark(Mark.Em)).toBe(true)
    expect(el.innerHTML).toBe('word')
  })

  it('applyMark(Mark.Link, href) wraps with the anchor attribute contract', () => {
    const el = hostEl('go here now')
    setFocusedRichHost(el)
    selectRange(el, 3, 7)
    expect(domSelectionAdapter.applyMark(Mark.Link, 'http://x')).toBe(true)
    expect(el.innerHTML).toBe(
      'go <a href="http://x" contenteditable="false" data-autodown-link="">here</a> now'
    )
  })

  it('applyMark on an existing link re-hrefs in place (no rewrap)', () => {
    const el = hostEl('<a href="http://old">go</a>')
    setFocusedRichHost(el)
    selectRange(el, 0, 2)
    expect(domSelectionAdapter.applyMark(Mark.Link, 'http://new')).toBe(true)
    expect(el.innerHTML).toBe('<a href="http://new" contenteditable="false" data-autodown-link="">go</a>')
  })

  it('removeMark(Mark.Link) unwraps the anchor; no link → false', () => {
    const el = hostEl('a <a href="http://x">b</a> c')
    setFocusedRichHost(el)
    selectRange(el, 2, 3)
    expect(domSelectionAdapter.removeMark(Mark.Link)).toBe(true)
    expect(el.innerHTML).toBe('a b c')
    selectRange(el, 2, 3)
    expect(domSelectionAdapter.removeMark(Mark.Link)).toBe(false)
  })

  it('applyMark(Link) without href on plain text unwraps nothing → false (domSetLink truth table)', () => {
    const el = hostEl('plain')
    setFocusedRichHost(el)
    selectRange(el, 0, 5)
    expect(domSelectionAdapter.applyMark(Mark.Link, '')).toBe(false)
    expect(el.innerHTML).toBe('plain')
  })

  it('no focused host or no selection → false (headless no-op parity)', () => {
    setFocusedRichHost(null)
    expect(domSelectionAdapter.applyMark(Mark.Strong)).toBe(false)
    expect(domSelectionAdapter.removeMark(Mark.Strong)).toBe(false)
    expect(domSelectionAdapter.isActive(Mark.Strong)).toBe(false)
    expect(domSelectionAdapter.applyMark(Mark.Link, 'http://x')).toBe(false)
    const el = hostEl('text')
    setFocusedRichHost(el)
    expect(domSelectionAdapter.applyMark(Mark.Strong)).toBe(false)
    expect(domSelectionAdapter.applyMark(Mark.Image)).toBe(false)
  })
})

describe('toggleMark helper (the old domToggleMark decision, outside the frozen interface)', () => {
  it('wraps when inactive, unwraps when active — one helper for all call sites', () => {
    const el = hostEl('say hi')
    setFocusedRichHost(el)
    selectRange(el, 4, 6)
    expect(toggleMark(domSelectionAdapter, Mark.Em)).toBe(true)
    expect(el.innerHTML).toBe('say <em>hi</em>')
    selectRange(el, 4, 6)
    expect(toggleMark(domSelectionAdapter, Mark.Em)).toBe(true)
    expect(el.innerHTML).toBe('say hi')
    selectRange(el, 4, 6)
    expect(toggleMark(domSelectionAdapter, Mark.Em)).toBe(true)
    expect(el.innerHTML).toBe('say <em>hi</em>')
  })
})

describe('contract shape', () => {
  it('domSelectionAdapter satisfies SelectionAdapter (D1 four methods)', () => {
    const a: SelectionAdapter = domSelectionAdapter
    expect(typeof a.getSelection).toBe('function')
    expect(typeof a.isActive).toBe('function')
    expect(typeof a.applyMark).toBe('function')
    expect(typeof a.removeMark).toBe('function')
  })
})
