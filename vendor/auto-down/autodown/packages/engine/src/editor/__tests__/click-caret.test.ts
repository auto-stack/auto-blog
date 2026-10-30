// click-caret handoff contracts (engine/click-caret.ts): the preview-face
// click records WHERE the user pointed; the edit face's mount consumes it
// instead of falling back to its end-of-text default. The placement itself
// needs real layout + the caret API, so it is e2e-pinned (demo/e2e); these
// unit contracts pin the store semantics — match, expiry, single-slot
// replace — and the graceful fallback that keeps every non-click mount path
// on the old default.
// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest'
import { parse_blocks } from '../../parser/markdown-parser'
import {
  captureClickCaret,
  clearClickCaret,
  placeCaretAtPoint,
  resolveClickHit,
  setClickCaret,
  slotAnchorOf,
  takeClickCaret,
} from '../engine/click-caret'

function anchorAt(left: number, top: number): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () =>
    ({ left, top, right: left, bottom: top, width: 0, height: 0, x: left, y: top, toJSON: () => ({}) }) as DOMRect
  return el
}

function click(x: number, y: number, button = 0): MouseEvent {
  return new MouseEvent('click', { clientX: x, clientY: y, button })
}

/** Stub the caret API at a node/offset (happy-dom has none) — the same seam
 *  the real browser caretRangeFromPoint provides. */
function stubCaretAt(node: Node, offset = 0): void {
  ;(document as unknown as Record<string, unknown>).caretRangeFromPoint = () => {
    const r = document.createRange()
    r.setStart(node, offset)
    r.collapse(true)
    return r
  }
}

afterEach(() => clearClickCaret())

describe('captureClickCaret: the pointed-at point, relative to the block element', () => {
  it('records dx/dy against the anchor rect and hands them to the matching block', () => {
    captureClickCaret(click(130, 240), 'block-7', anchorAt(100, 200))
    const entry = takeClickCaret('block-7')
    expect(entry).not.toBeNull()
    expect(entry!.blockId).toBe('block-7')
    expect(entry!.dx).toBe(30)
    expect(entry!.dy).toBe(40)
  })

  it('ignores non-primary buttons, empty block ids and a missing anchor', () => {
    captureClickCaret(click(10, 10, 2), 'block-1', anchorAt(0, 0))
    expect(takeClickCaret('block-1')).toBeNull()
    captureClickCaret(click(10, 10), '', anchorAt(0, 0))
    expect(takeClickCaret('')).toBeNull()
    captureClickCaret(click(10, 10), 'block-1', null)
    expect(takeClickCaret('block-1')).toBeNull()
  })
})

describe('takeClickCaret: single slot, consumed once, matched by block id', () => {
  it('a non-matching consumer clears the entry (no stale second consumer)', () => {
    captureClickCaret(click(10, 10), 'block-a', anchorAt(0, 0))
    expect(takeClickCaret('block-b')).toBeNull()
    expect(takeClickCaret('block-a')).toBeNull()
  })

  it('a later capture replaces the previous entry (one click, one handoff)', () => {
    captureClickCaret(click(10, 10), 'block-a', anchorAt(0, 0))
    captureClickCaret(click(20, 20), 'block-b', anchorAt(0, 0))
    const b = takeClickCaret('block-b')
    expect(b).not.toBeNull()
    expect(b!.dx).toBe(20)
    expect(takeClickCaret('block-a')).toBeNull()
  })

  it('expires a handoff older than a second (keyboard/programmatic focus paths)', () => {
    setClickCaret({ blockId: 'block-a', at: Date.now() - 2000, dx: 1, dy: 1 })
    expect(takeClickCaret('block-a')).toBeNull()
    setClickCaret({ blockId: 'block-a', at: Date.now(), dx: 1, dy: 1 })
    expect(takeClickCaret('block-a')).not.toBeNull()
  })
})

describe('slotAnchorOf: the block element inside the slot chrome', () => {
  it('resolves slot > .node-content > element', () => {
    const slot = document.createElement('div')
    slot.innerHTML = '<div class="node-content"><h2 class="heading-node">x</h2></div>'
    expect(slotAnchorOf(slot)?.tagName).toBe('H2')
  })

  it('falls back to the slot itself when the chrome is absent', () => {
    const slot = document.createElement('div')
    expect(slotAnchorOf(slot)).toBe(slot)
    expect(slotAnchorOf(null)).toBeNull()
  })
})

describe('placeCaretAtPoint: browser re-resolves the point, else the caller keeps its default', () => {
  afterEach(() => {
    delete (document as unknown as Record<string, unknown>).caretRangeFromPoint
  })

  it('false without the caret API (jsdom / detached faces)', () => {
    const host = document.createElement('p')
    host.textContent = 'hello'
    document.body.appendChild(host)
    expect(placeCaretAtPoint(host, { blockId: 'b', at: Date.now(), dx: 1, dy: 1 })).toBe(false)
    host.remove()
  })

  it('false when the point resolves outside the host (stale geometry)', () => {
    const host = document.createElement('p')
    host.textContent = 'hello'
    const outside = document.createElement('p')
    outside.textContent = 'elsewhere'
    document.body.append(host, outside)
    ;(document as unknown as Record<string, unknown>).caretRangeFromPoint = () => {
      const r = document.createRange()
      r.setStart(outside.firstChild!, 0)
      r.collapse(true)
      return r
    }
    expect(placeCaretAtPoint(host, { blockId: 'b', at: Date.now(), dx: 1, dy: 1 })).toBe(false)
    host.remove()
    outside.remove()
  })

  it('true and selects the resolved range when the point lands inside the host', () => {
    const host = document.createElement('p')
    host.textContent = 'hello'
    document.body.appendChild(host)
    ;(document as unknown as Record<string, unknown>).caretRangeFromPoint = () => {
      const r = document.createRange()
      r.setStart(host.firstChild!, 3)
      r.collapse(true)
      return r
    }
    expect(placeCaretAtPoint(host, { blockId: 'b', at: Date.now(), dx: 1, dy: 1 })).toBe(true)
    const sel = window.getSelection()
    expect(sel?.rangeCount).toBe(1)
    expect(sel?.getRangeAt(0).startOffset).toBe(3)
    host.remove()
  })
})

describe('resolveClickHit: what a slot click addresses', () => {
  afterEach(() => {
    delete (document as unknown as Record<string, unknown>).caretRangeFromPoint
    document.body.innerHTML = ''
  })

  function listSlot(): HTMLElement {
    const slot = document.createElement('div')
    slot.className = 'node-slot'
    slot.innerHTML = `
      <div class="node-content">
        <div class="node-slot"><div class="node-content"><ul class="list-node">
          <li class="list-item"><div class="markdown-renderer"><div class="node-slot"><div class="node-content"><p class="paragraph-node">Bullet item one</p></div></div></div></li>
          <li class="list-item"><div class="markdown-renderer"><div class="node-slot"><div class="node-content"><p class="paragraph-node">Bullet item two</p></div></div></div></li>
        </ul></div></div>
      </div>`
    document.body.appendChild(slot)
    return slot
  }

  it('a leaf slot addresses the node itself', () => {
    const doc = parse_blocks('# Title', true)
    const heading = doc.children[0]!
    const slot = document.createElement('div')
    slot.innerHTML = '<div class="node-content"><h1 class="heading-node">Title</h1></div>'
    document.body.appendChild(slot)
    const hit = resolveClickHit(heading, slot, click(5, 5))
    expect(hit.targetId).toBe(heading.id)
    expect(hit.anchor?.textContent).toBe('Title')
  })

  it('a collapsed container addresses the clicked item, not the first leaf', () => {
    const doc = parse_blocks('- Bullet item one\n- Bullet item two', true)
    const list = doc.children[0]!
    const slot = listSlot()
    const secondParagraph = slot.querySelectorAll('p')[1]!
    stubCaretAt(secondParagraph.firstChild!, 3)
    const hit = resolveClickHit(list, slot, click(5, 5))
    expect(hit.targetId).toBe(list.children[1]!.children[0]!.id)
    expect(hit.anchor?.textContent).toBe('Bullet item two')
  })

  it('unresolvable container clicks (chrome, wrapper count drift) fall back to deep selection', () => {
    const doc = parse_blocks('- Bullet item one\n- Bullet item two', true)
    const list = doc.children[0]!
    const slot = listSlot()
    // no caret API at all (SSR/unit environments)
    expect(resolveClickHit(list, slot, click(5, 5)).targetId).toBe('')
    // caret on the container chrome: the nearest wrapper IS the container's own
    stubCaretAt(slot.querySelector('ul')!.firstChild!, 0)
    expect(resolveClickHit(list, slot, click(5, 5)).targetId).toBe('')
    // DOM leaf wrappers outnumber the model's atomic descendants
    const extra = document.createElement('div')
    extra.className = 'node-slot'
    slot.querySelector('ul')!.appendChild(extra)
    stubCaretAt(slot.querySelectorAll('p')[1]!.firstChild!, 1)
    expect(resolveClickHit(list, slot, click(5, 5)).targetId).toBe('')
  })

  it('a table slot addresses the clicked cell by row/column', () => {
    const doc = parse_blocks('| A | B |\n|---|---|\n| C | D |', true)
    const table = doc.children[0]!
    const slot = document.createElement('div')
    slot.innerHTML = `
      <div class="node-content">
        <div class="node-slot"><div class="node-content"><table class="table-node">
          <thead><tr><th class="text-left"><div class="markdown-renderer">A</div></th><th class="text-left"><div class="markdown-renderer">B</div></th></tr></thead>
          <tbody><tr><td class="text-left"><div class="markdown-renderer">C</div></td><td class="text-left"><div class="markdown-renderer">D</div></td></tr></tbody>
        </table></div></div>
      </div>`
    document.body.appendChild(slot)
    const cell = slot.querySelectorAll('td')[1]! // D = body row 1, column 1
    stubCaretAt(cell.querySelector('.markdown-renderer')!.firstChild!, 1)
    const hit = resolveClickHit(table, slot, click(5, 5))
    expect(hit.targetId).toBe(table.id)
    expect(hit.cellId).toBe(table.children[1]!.children[1]!.id)
    expect(hit.anchor).toBe(cell)
  })
})
