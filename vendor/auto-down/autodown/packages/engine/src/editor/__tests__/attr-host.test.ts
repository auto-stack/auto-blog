// AttrHost (plan 035 T2): the single-line attr read/write host — the
// generated widget replacing the hand-written AttrHost.vue (plan 030 T7),
// semantics aligned line-for-line:
// - mount: the flat `value` prop (the assembler's model snapshot) injects
//   as textContent;
// - Enter/Escape: preventDefault + blur (commit) — key modifiers ride the
//   DSL (keydown.enter/.escape.prevent);
// - blur: nbsp normalizes back to a plain space, trimmed text commits via
//   setBlockAttrs as ONE undo step, unchanged text / readonly skip the
//   command entirely;
// - version: the parent repaint version re-syncs the text from the model —
//   NEVER while focused, so the user's caret is never clobbered mid-edit.

// @vitest-environment happy-dom

import { createApp, h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BlockType,
  Value,
  attrGetStr,
  attrSet,
  block,
  findBlock,
  withChildren,
} from '../../parser/block-model'
import { EditorEngine } from '../engine/editor-engine'
import { setBlockAttrs } from '../engine/commands'
import AttrHost from '../components/AttrHost.vue'

interface Mounted {
  host: HTMLElement
  el: HTMLElement
  version: { value: number }
  unmount: () => void
}

function engineWith(initialTitle: string) {
  const node = block('c1', BlockType.Callout)
  node.attrs = attrSet(node.attrs, 'title', Value.Str(initialTitle))
  const root = withChildren(block('doc', BlockType.Paragraph), [node])
  return new EditorEngine(root)
}

function attrOf(engine: EditorEngine): string {
  const found = findBlock(engine.doc, 'c1')
  return found ? attrGetStr(found.attrs, 'title', '') : ''
}

function mountHost(engine: EditorEngine, version = 1, readonly = false, value?: string): Mounted {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const ver = ref(version)
  const app = createApp({
    render: () =>
      h(AttrHost as any, {
        controller: engine,
        blockId: 'c1',
        attr_key: 'title',
        value: value ?? attrOf(engine),
        placeholder: '标题',
        host_class: 'autodown-callout-title',
        readonly,
        version: ver.value,
      }),
  })
  app.mount(host)
  return {
    host,
    el: host.firstElementChild as HTMLElement,
    version: ver,
    unmount: () => {
      app.unmount()
      host.remove()
    },
  }
}

function keydown(key: string): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
}

const mounted: Mounted[] = []
afterEach(() => {
  while (mounted.length > 0) mounted.pop()!.unmount()
})

describe('mount', () => {
  it('injects the value prop as textContent on mount (the assembler snapshot)', () => {
    const engine = engineWith('旧标题')
    const m = mountHost(engine)
    mounted.push(m)
    expect(m.el.textContent).toBe('旧标题')
    expect(m.el.className).toBe('autodown-attr-host autodown-callout-title')
    expect(m.el.getAttribute('data-placeholder')).toBe('标题')
  })

  it('readonly renders contenteditable="false"', () => {
    const engine = engineWith('')
    const m = mountHost(engine, 1, true)
    mounted.push(m)
    expect(m.el.getAttribute('contenteditable')).toBe('false')
  })
})

describe('键序: Enter/Escape = preventDefault + blur commit', () => {
  it('Enter commits the edited text and cancels the key', () => {
    const engine = engineWith('旧')
    const m = mountHost(engine)
    mounted.push(m)
    m.el.focus()
    m.el.textContent = '新标题'
    const ev = keydown('Enter')
    m.el.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(attrOf(engine)).toBe('新标题')
  })

  it('Escape commits likewise', () => {
    const engine = engineWith('旧')
    const m = mountHost(engine)
    mounted.push(m)
    m.el.focus()
    m.el.textContent = 'esc 后提交'
    m.el.dispatchEvent(keydown('Escape'))
    expect(attrOf(engine)).toBe('esc 后提交')
  })
})

describe('blur 提交: one undo step, nbsp 归一, unchanged/readonly skip', () => {
  it('blur commits the trimmed nbsp-normalized text as ONE undo step', () => {
    const engine = engineWith('')
    const m = mountHost(engine)
    mounted.push(m)
    m.el.focus()
    // Chromium renders contentediting spaces as U+00A0
    m.el.textContent = 'x\u00a0y  '
    m.el.blur()
    expect(attrOf(engine)).toBe('x y')
    expect(engine.canUndo).toBe(true)
    engine.undo()
    expect(attrOf(engine)).toBe('')
  })

  it('unchanged text skips the command (no history entry)', () => {
    const engine = engineWith('一样')
    const m = mountHost(engine)
    mounted.push(m)
    m.el.focus()
    m.el.blur()
    expect(engine.canUndo).toBe(false)
  })

  it('readonly (stream gate) skips the commit entirely', () => {
    const engine = engineWith('旧')
    const m = mountHost(engine, 1, true)
    mounted.push(m)
    m.el.textContent = '流式中的草稿'
    m.el.blur()
    expect(attrOf(engine)).toBe('旧')
    expect(engine.canUndo).toBe(false)
  })
})

describe('version 同步: model-side sync, never while focused', () => {
  it('unfocused host re-syncs from the model when the version moves', async () => {
    const engine = engineWith('a')
    const m = mountHost(engine)
    mounted.push(m)
    expect(m.el.textContent).toBe('a')
    // model changed elsewhere (undo / checkbox flip): commit + repaint
    setBlockAttrs(engine, 'c1', [{ key: 'title', value: Value.Str('b') }])
    m.version.value = 2
    await nextTick()
    expect(m.el.textContent).toBe('b')
  })

  it('focused host is never clobbered mid-edit', async () => {
    const engine = engineWith('a')
    const m = mountHost(engine)
    mounted.push(m)
    m.el.focus()
    m.el.textContent = '我的草稿'
    setBlockAttrs(engine, 'c1', [{ key: 'title', value: Value.Str('别处改的') }])
    m.version.value = 2
    await nextTick()
    expect(m.el.textContent).toBe('我的草稿')
  })
})
