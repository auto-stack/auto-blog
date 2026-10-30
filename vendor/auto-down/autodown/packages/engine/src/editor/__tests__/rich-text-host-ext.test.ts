// rich_text_host_ext tests (plan 034 T4): the RichTextHost platform wiring —
// everything the retired BlockHost.vue did at the DOM boundary, now in the
// ext bridge. Four groups per the plan's test design (composition trio /
// input-rule resync / paste channels / caret math) plus the focusedRichHost
// registration+cleanup pair and the face computation absorbed from the
// retired host-face.ts (pinned here against the same value table its own
// suite froze — host-face.test.ts is deleted with the module in T5).
//
// The wiring is pinned with fake controllers (vi.fn delegation checks — the
// headless SEMANTICS behind each controller method stay pinned in
// host-controller.test.ts, untouched); the mount path pins the real
// generated RichTextHost.vue end to end (chrome contract + focus + caret +
// unmount deregistration).

// @vitest-environment happy-dom

import { createApp, h } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  collapsedSel,
  span,
} from '../../parser/block-model'
import { parse_blocks } from '../../parser/markdown-parser'
import { EditorEngine } from '../engine/editor-engine'
import { BlockHostController } from '../engine/host-controller'
import { spansToHtml } from '../engine/rich-html'
import { getFocusedRichHost } from '../engine/selection-adapter'
import RichTextHost from '../components/RichTextHost.vue'
import {
  hostTag,
  hostCls,
  hostText,
  caretOffset,
  caretOnFirstLine,
  caretOnLastLine,
  hostInput,
  hostKeydown,
  hostPaste,
  hostCompositionBegin,
  hostCompositionUpdate,
  hostCompositionCommit,
  hostFocus,
  hostBlur,
} from '../ext/rich_text_host_ext'

/* Deliberately `any`: the fake must satisfy the BlockHostController
   parameter type while keeping vi.fn() mock APIs callable; the real method
   signatures are pinned in host-controller.test.ts. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FakeController = any

function fakeController(overrides: Record<string, unknown> = {}): FakeController {
  return {
    id: 'b1',
    text: 'hello',
    inlines: [span('hello')],
    composition: { composing: false },
    onInput: vi.fn(),
    desiredCaretOffset: vi.fn(() => null),
    onEnter: vi.fn(),
    prevSiblingId: vi.fn(() => null),
    onBackspaceAtStart: vi.fn(),
    navigateUp: vi.fn(() => null),
    navigateDown: vi.fn(() => null),
    onTab: vi.fn(() => true),
    onPasteMarkdown: vi.fn(),
    onRichBlur: vi.fn(),
    compositionBegin: vi.fn(),
    compositionUpdate: vi.fn(),
    compositionCommit: vi.fn(),
    ...overrides,
  } as unknown as FakeController
}

/** A contenteditable-ish div in the live document (selection needs it). */
function hostEl(html: string): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('contenteditable', 'true')
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

/** Put the caret at a text offset inside el (Range walk over text nodes). */
function setCaret(el: HTMLElement, offset: number): void {
  const walker = document.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */)
  let remaining = offset
  let node: Node | null = walker.nextNode()
  let target: Node | null = null
  let targetOffset = 0
  while (node) {
    const len = node.textContent?.length ?? 0
    if (remaining <= len) {
      target = node
      targetOffset = remaining
      break
    }
    remaining -= len
    node = walker.nextNode()
  }
  if (!target) target = el
  const range = document.createRange()
  range.setStart(target, targetOffset)
  range.collapse(true)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

function keydownEvent(key: string, opts: KeyboardEventInit = {}, el?: HTMLElement): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts })
  if (el) {
    // target/currentTarget are only populated during real dispatch; direct
    // unit invocation carries them only if pre-set (the ext falls back
    // currentTarget ?? target — both are the host root in production).
    Object.defineProperty(e, 'target', { value: el })
  }
  return e
}

function pasteEvent(textPlain: string): ClipboardEvent {
  return {
    clipboardData: { getData: (type: string) => (type === 'text/plain' ? textPlain : '') },
    preventDefault: vi.fn(),
  } as unknown as ClipboardEvent
}

afterEach(() => {
  document.body.innerHTML = ''
})

/** happy-dom has no layout: fabricate line boxes for the navigation helpers'
 *  Range geometry. Ranges are told apart by their text content (pre = text
 *  before the caret, post = text after; the collapsed caret itself is never
 *  measured). */
function stubGeometry(text: string, caret: number, beforeTops: number[], afterTops: number[]): void {
  const L = (top: number) => ({ top, height: 20 })
  const beforeText = text.slice(0, caret)
  const afterText = text.slice(caret)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(Range.prototype as any).getClientRects = function (this: Range) {
    const txt = this.toString()
    if (txt === beforeText) return beforeTops.map(L) as any
    if (txt === afterText) return afterTops.map(L) as any
    return [] as any
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(Range.prototype as any).getBoundingClientRect = function () {
    return { top: 0, height: 0 }
  }
}

afterEach(() => {
  delete (Range.prototype as any).getClientRects
  delete (Range.prototype as any).getBoundingClientRect
})

// -- face computation (host-face.ts absorbed; value table frozen) -------------------

describe('hostTag / hostCls (semantic host face)', () => {
  it('Heading renders the matching h1-h6 + heading classes (level clamped 1-6)', () => {
    expect(hostTag('Heading', 1)).toBe('h1')
    expect(hostTag('Heading', 3)).toBe('h3')
    expect(hostTag('Heading', 6)).toBe('h6')
    expect(hostCls('Heading', 3)).toBe('autodown-block-host heading-node heading-3')
    expect(hostTag('Heading', 0)).toBe('h1')
    expect(hostTag('Heading', -3)).toBe('h1')
    expect(hostTag('Heading', 9)).toBe('h6')
    expect(hostTag('Heading', undefined)).toBe('h1') // missing level clamps up
  })

  it('Paragraph renders p + paragraph-node; other kinds the bare div', () => {
    expect(hostTag('Paragraph', 3)).toBe('p')
    expect(hostCls('Paragraph', 3)).toBe('autodown-block-host paragraph-node')
    expect(hostTag('ListItem')).toBe('div')
    expect(hostCls('ListItem')).toBe('autodown-block-host')
    expect(hostTag('WikilinkBlock')).toBe('div')
  })
})

// -- caret math ---------------------------------------------------------------------

describe('caret / sibling math', () => {
  it('hostText normalizes Chromium trailing U+00A0 to plain spaces', () => {
    const el = hostEl('#\u00A0')
    expect(hostText(el)).toBe('# ')
  })

  it('caretOffset counts code units across inline element children', () => {
    const el = hostEl('<strong>bold</strong> plain')
    setCaret(el, 9)
    expect(caretOffset(el)).toBe(9)
    setCaret(el, 0)
    expect(caretOffset(el)).toBe(0)
  })

  it('caretOffset is 0 without a selection', () => {
    const el = hostEl('abc')
    window.getSelection()?.removeAllRanges()
    expect(caretOffset(el)).toBe(0)
  })
})

// -- composition trio ----------------------------------------------------------------

describe('composition wiring', () => {
  it('begin passes the model baseline and the live caret offset', () => {
    const el = hostEl('hello')
    setCaret(el, 3)
    const c = fakeController()
    hostCompositionBegin(el, c)
    expect(c.compositionBegin).toHaveBeenCalledWith('hello', 3)
  })

  it('update forwards e.data with the ?? "" fallback', () => {
    const c = fakeController()
    hostCompositionUpdate({ data: '你' } as CompositionEvent, c)
    expect(c.compositionUpdate).toHaveBeenCalledWith('你')
    hostCompositionUpdate({} as CompositionEvent, c)
    expect(c.compositionUpdate).toHaveBeenLastCalledWith('')
  })

  it('commit sends the nbsp-normalized DOM text', () => {
    const el = hostEl('你好\u00A0')
    const c = fakeController()
    hostCompositionCommit(el, c)
    expect(c.compositionCommit).toHaveBeenCalledWith('你好 ')
  })
})

// -- input-rule resync ----------------------------------------------------------------

describe('hostInput (diff + input-rule resync + slash dispatch)', () => {
  it('dispatches the normalized DOM text to the controller', () => {
    const el = hostEl('hellox')
    const c = fakeController()
    hostInput(el, c)
    expect(c.onInput).toHaveBeenCalledWith('hellox')
  })

  it('resyncs the host DOM to the model when an input rule consumed the marker', () => {
    // model says the marker is gone (kind flip), DOM still shows it
    const el = hostEl('# ')
    const c = fakeController({ text: '', inlines: [span('')] })
    hostInput(el, c)
    expect(el.innerHTML).toBe(spansToHtml([span('')]))
    // caret moved to the end after the resync
    expect(caretOffset(el)).toBe(0)
  })

  it('skips the resync mid-composition (the preedit lives only in the DOM)', () => {
    const el = hostEl('# preedit')
    const before = el.innerHTML
    const c = fakeController({
      text: '',
      inlines: [span('')],
      composition: { composing: true },
    })
    hostInput(el, c)
    expect(el.innerHTML).toBe(before)
  })

  it('dispatches slash state on the document (open with query after "/")', () => {
    const el = hostEl('hello /he')
    setCaret(el, 'hello /he'.length)
    const c = fakeController({ text: 'hello /he' })
    const events: CustomEvent[] = []
    const onOpen = (ev: Event): void => {
      events.push(ev as CustomEvent)
    }
    document.addEventListener('autodown:slash-open', onOpen)
    hostInput(el, c)
    document.removeEventListener('autodown:slash-open', onOpen)
    expect(events.length).toBe(1)
    expect((events[0].detail as { query: string }).query).toBe('he')
  })

  it('dispatches slash close when the query is gone', () => {
    const el = hostEl('hello')
    setCaret(el, 5)
    const c = fakeController({ text: 'hello' })
    let closed = 0
    const onClose = (): void => {
      closed += 1
    }
    document.addEventListener('autodown:slash-close', onClose)
    hostInput(el, c)
    document.removeEventListener('autodown:slash-close', onClose)
    expect(closed).toBe(1)
  })
})

// -- key routing ----------------------------------------------------------------------

describe('hostKeydown', () => {
  it('Enter preventDefaults and splits with a fresh block id', () => {
    const el = hostEl('hello')
    setCaret(el, 3)
    const c = fakeController()
    const e = keydownEvent('Enter', {}, el)
    hostKeydown(e, c)
    expect(e.defaultPrevented).toBe(true)
    expect(c.onEnter).toHaveBeenCalledTimes(1)
    const [offset, newId] = vi.mocked(c.onEnter).mock.calls[0]
    expect(offset).toBe(3)
    expect(newId).toMatch(/^b-[a-z0-9]{4,8}$/)
  })

  it('Backspace at offset 0 merges model-side (prevented) when the op lands; degrades otherwise', () => {
    const el = hostEl('hello')
    setCaret(el, 0)
    const c = fakeController({
      prevSiblingId: vi.fn(() => 'prev-1'),
      onBackspaceAtStart: vi.fn(() => true),
    })
    const merged = keydownEvent('Backspace', {}, el)
    hostKeydown(merged, c)
    expect(merged.defaultPrevented).toBe(true)
    expect(c.onBackspaceAtStart).toHaveBeenCalledWith('prev-1')

    const degraded = keydownEvent('Backspace', {}, el)
    hostKeydown(
      degraded,
      fakeController({
        prevSiblingId: vi.fn(() => null),
        onBackspaceAtStart: vi.fn(() => false),
      })
    )
    expect(degraded.defaultPrevented).toBe(false)
  })

  it('Tab preventDefaults when the controller reports a list indent/outdent', () => {
    const el = hostEl('x')
    const c = fakeController()
    const indented = keydownEvent('Tab', {}, el)
    hostKeydown(indented, c)
    expect(indented.defaultPrevented).toBe(true)
    expect(c.onTab).toHaveBeenCalledWith(false)

    c.onTab = vi.fn(() => false)
    const passthrough = keydownEvent('Tab', { shiftKey: true }, el)
    hostKeydown(passthrough, c)
    expect(passthrough.defaultPrevented).toBe(false)
    expect(c.onTab).toHaveBeenLastCalledWith(true)
  })

  it('Ctrl+B/I/K preventDefault (native <b>/<i> overridden); keydown is a no-op mid-composition', () => {
    const el = hostEl('hello')
    const c = fakeController()
    const prompt = vi.fn(() => 'https://example.com')
    vi.stubGlobal('prompt', prompt)
    try {
      for (const k of ['b', 'i', 'k']) {
        const e = keydownEvent(k, { ctrlKey: true }, el)
        hostKeydown(e, c)
        expect(e.defaultPrevented).toBe(true)
      }
      expect(prompt).toHaveBeenCalledWith('Enter URL')
    } finally {
      vi.unstubAllGlobals()
    }
    const composing = keydownEvent('Enter', {}, el)
    const mid = fakeController({ composition: { composing: true } })
    hostKeydown(composing, mid)
    expect(composing.defaultPrevented).toBe(false)
    expect(mid.onEnter).not.toHaveBeenCalled()
  })

  // -- cross-block vertical navigation (↑/↓ at the host's first/last line) --

  it('ArrowUp at the first line crosses to the previous block (prevented)', () => {
    const el = hostEl('hello')
    setCaret(el, 0)
    stubGeometry('hello', 0, [], [100])
    const c = fakeController({ navigateUp: vi.fn(() => 'p0') })
    const e = keydownEvent('ArrowUp', {}, el)
    hostKeydown(e, c)
    expect(e.defaultPrevented).toBe(true)
    expect(c.navigateUp).toHaveBeenCalledTimes(1)
  })

  it('ArrowUp off the first line keeps the native in-block default', () => {
    const el = hostEl('hello')
    setCaret(el, 2)
    stubGeometry('hello', 2, [60, 100], [])
    const c = fakeController()
    const e = keydownEvent('ArrowUp', {}, el)
    hostKeydown(e, c)
    expect(e.defaultPrevented).toBe(false)
    expect(c.navigateUp).not.toHaveBeenCalled()
  })

  it('ArrowDown at the last line crosses and schedules the start-caret placement', () => {
    vi.useFakeTimers()
    try {
      const el = hostEl('hello')
      setCaret(el, 5)
      stubGeometry('hello', 5, [100], [])
      const c = fakeController({ navigateDown: vi.fn(() => 'p2') })
      const e = keydownEvent('ArrowDown', {}, el)
      hostKeydown(e, c)
      expect(e.defaultPrevented).toBe(true)
      expect(c.navigateDown).toHaveBeenCalledTimes(1)
      // the deferred placement query misses (no remount in jsdom) — must not throw
      vi.runAllTimers()
    } finally {
      vi.useRealTimers()
    }
  })
})

// -- vertical navigation geometry (caretOnFirstLine / caretOnLastLine) ---------------

describe('cross-block navigation geometry', () => {
  it('caretOnFirstLine: true on the first line, false when a prior line box exists', () => {
    const el = hostEl('hello world')
    setCaret(el, 3)
    stubGeometry('hello world', 3, [100], [100])
    expect(caretOnFirstLine(el)).toBe(true)
    stubGeometry('hello world', 3, [60, 100], [100])
    expect(caretOnFirstLine(el)).toBe(false)
  })

  it('caretOnLastLine: true on the last line, false when a later line box exists', () => {
    const el = hostEl('hello world')
    setCaret(el, 3)
    stubGeometry('hello world', 3, [100], [100])
    expect(caretOnLastLine(el)).toBe(true)
    stubGeometry('hello world', 3, [100], [140])
    expect(caretOnLastLine(el)).toBe(false)
  })
})

// -- paste channels --------------------------------------------------------------------

describe('hostPaste', () => {
  it('inline plain text appends through onInput (no markdown channel)', () => {
    const c = fakeController({ text: 'hello' })
    const ev = pasteEvent('world')
    hostPaste(ev, c)
    expect(ev.preventDefault).toHaveBeenCalled()
    expect(c.onInput).toHaveBeenCalledWith('helloworld')
    expect(c.onPasteMarkdown).not.toHaveBeenCalled()
  })

  it('markdown-looking single line routes to onPasteMarkdown', () => {
    const c = fakeController({ text: 'hello' })
    const ev = pasteEvent('# heading')
    hostPaste(ev, c)
    expect(c.onPasteMarkdown).toHaveBeenCalledWith('# heading')
    expect(c.onInput).not.toHaveBeenCalled()
  })

  it('multi-line text routes to onPasteMarkdown; empty clipboard is ignored', () => {
    const c = fakeController()
    hostPaste(pasteEvent('a\nb'), c)
    expect(c.onPasteMarkdown).toHaveBeenCalledWith('a\nb')
    const empty = pasteEvent('')
    hostPaste(empty, c)
    expect(empty.preventDefault).not.toHaveBeenCalled()
    expect(c.onInput).not.toHaveBeenCalled()
  })
})

// -- focus registration / blur writeback -------------------------------------------------

describe('focusedRichHost registration & blur writeback', () => {
  it('focus registers the host; blur clears it, flushes pending text, then rich-writes back', () => {
    // the liveHosts guard keys blur/focus off MOUNT liveness — use a real
    // mounted root (mountFace from the mount describe below)
    const { root, stop } = mountFace('hello', 'Paragraph', 0)
    root.innerHTML = 'hello!' // the user typed since mount
    const c = fakeController({ text: 'hello' })
    hostFocus(root, c)
    expect(getFocusedRichHost()).toBe(root)

    hostBlur(root, c)
    expect(getFocusedRichHost()).toBeNull()
    // pending plain diff flushed BEFORE the rich walk
    expect(c.onInput).toHaveBeenCalledWith('hello!')
    expect(c.onRichBlur).toHaveBeenCalledWith(root)
    const order: string[] = []
    c.onInput.mockImplementation(() => order.push('input'))
    c.onRichBlur.mockImplementation(() => order.push('rich'))
    hostBlur(root, c)
    expect(order).toEqual(['input', 'rich'])
    stop()
  })

  it('unmounted hosts never flush or write back (remount guard, plan 034 T7)', () => {
    // a bare element outside any mount is not live: focus does not
    // register, blur only clears the slot — this is what keeps a remount's
    // late blur from resurrecting stale DOM text into the restored model
    const bare = hostEl('hello!')
    const c = fakeController({ text: 'hello' })
    hostFocus(bare, c)
    expect(getFocusedRichHost()).toBeNull()
    hostBlur(bare, c)
    expect(c.onInput).not.toHaveBeenCalled()
    expect(c.onRichBlur).not.toHaveBeenCalled()
  })

  it('blur skips the flush when the text already matches the model', () => {
    const { root, stop } = mountFace('hello', 'Paragraph', 0)
    const c = fakeController({ text: 'hello' })
    hostBlur(root, c)
    expect(c.onInput).not.toHaveBeenCalled()
    expect(c.onRichBlur).toHaveBeenCalledWith(root)
    stop()
  })
})

// -- mount end-to-end (the generated RichTextHost.vue) --------------------------------------

describe('RichTextHost.vue mount (chrome + focus + caret + unmount cleanup)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders the semantic chrome exactly (Heading → h2, contract attributes)', () => {
    const { root, stop, controller } = mountFace('## **bold** plain', 'Heading', 2)
    expect(root.tagName).toBe('H2')
    expect(root.className).toBe('autodown-block-host heading-node heading-2')
    expect(root.getAttribute('contenteditable')).toBe('true')
    expect(root.getAttribute('data-block-id')).toBe(controller.id)
    expect(root.getAttribute('data-node-type')).toBe('Heading')
    expect(root.getAttribute('dir')).toBe('auto')
    expect(root.getAttribute('spellcheck')).toBe('false')
    expect(root.innerHTML).toContain('<strong>bold</strong>')
    stop()
  })

  it('Paragraph → p.paragraph-node; ListItem → bare div', () => {
    const p = mountFace('plain', 'Paragraph', 0)
    expect(p.root.tagName).toBe('P')
    expect(p.root.className).toBe('autodown-block-host paragraph-node')
    p.stop()
    const d = mountFace('- plain', 'ListItem', 0)
    expect(d.root.tagName).toBe('DIV')
    expect(d.root.className).toBe('autodown-block-host')
    d.stop()
  })

  it('mount takes DOM focus with the caret at the end (append-at-end parity)', () => {
    const { root, stop } = mountFace('some text', 'Paragraph', 0)
    expect(document.activeElement).toBe(root)
    expect(caretOffset(root)).toBe('some text'.length)
    stop()
  })

  it('unmount deregisters the focused rich host (onBeforeUnmount parity)', () => {
    const { root, stop } = mountFace('abc', 'Paragraph', 0)
    hostFocus(root, fakeController())
    expect(getFocusedRichHost()).toBe(root)
    stop()
    expect(getFocusedRichHost()).toBeNull()
  })
})

  /** Mount the generated widget over the first editable leaf of a parsed
   *  markdown source (blockKind/level are the assembler's chrome data —
   *  EngineEditor passes BlockType[node.kind] + the level attr). */
  function mountFace(
    md: string,
    blockKind: string,
    level: number
  ): { root: HTMLElement; stop: () => void; controller: BlockHostController } {
    const doc = parse_blocks(md, true)
    const top = doc.children[0]
    const leaf =
      top.children && top.children.length > 0 ? (top.children[0] as typeof top) : top
    const engine = new EditorEngine(doc, collapsedSel(leaf.id, 0))
    const controller = new BlockHostController(engine, leaf.id)
    const initialHtml = spansToHtml(controller.inlines)
    const app = createApp({
      render: () =>
        h(RichTextHost as never, {
          controller,
          blockId: controller.id,
          blockKind,
          level,
          initial_html: initialHtml,
        }),
    })
    const wrap = document.createElement('div')
    document.body.appendChild(wrap)
    app.mount(wrap)
    return { root: wrap.firstElementChild as HTMLElement, stop: () => app.unmount(), controller }
  }
