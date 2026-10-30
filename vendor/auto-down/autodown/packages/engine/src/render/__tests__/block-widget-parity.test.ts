// BlockWidget three-mode chrome parity (plan 033 T7 / D5): the pilot
// families' view / stream / edit faces mount side by side and the chrome
// layer must compute IDENTICALLY — the whole point of the family mechanism
// is that one .at widget is one chrome source, so cross-mode style drift is
// structurally impossible. This suite is the standing guard for that claim.
//
// Assertion matrix (frozen — the edit-face whitelist lives HERE):
//   equal across all three modes
//   - container box model (border width/style/radius) — math/mermaid: the
//     widget owns the container chrome in every mode (unified to the view
//     face's document-card values in T7)
//   - the shared chrome pieces' class names (.autodown-math-preview /
//     .autodown-math-error / the fence .code-block-header chain)
//   - view ≡ stream: the FULL root + body class chains (final is the only
//     difference; it is a declared prop, invisible in the DOM)
//   edit-face whitelist (allowed to differ — behavioral, not chrome)
//   - the source textarea / caret / readonly stream banner (031 idiom)
//   - the editor-stack separation chrome (preview/error border-bottom +
//     white background inside the editing stack)
//   - the FENCE container's own border/background: the view face's
//     .code-block-container is consumer-CSS territory by the retired
//     builtin's byte contract (render.test pins its class chain, the demo
//     may style it) — the widget deliberately styles no view-fence
//     container, so only the header chain + skeleton family are comparable
//   - root class NAMES per face (.autodown-math-block vs
//     .autodown-math-editor etc.): each face's root class is pinned by an
//     external contract (EDITOR-CONTRACT edit selectors / node-view view
//     selectors); parity is asserted on computed chrome, not on those names
//
// happy-dom resolves the widget SFCs' injected scoped styles, so
// getComputedStyle here reads the real single-source rules.

// @vitest-environment happy-dom

import { createApp, h } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BlockType, Value, attrSet, block, leafBlock, withChildren } from '../../parser/block-model'
import { parse_blocks } from '../../parser/markdown-parser'
import { EditorEngine } from '../../editor/engine/editor-engine'
import { clearOptionalCapabilities } from '../optional-capabilities'
import CodeBlockWidget from '../../editor/components/CodeBlockWidget.vue'
import MathBlockWidget from '../../editor/components/MathBlockWidget.vue'
import MermaidBlockWidget from '../../editor/components/MermaidBlockWidget.vue'
import CalloutBlockWidget from '../../editor/components/CalloutBlockWidget.vue'
import DetailsBlockWidget from '../../editor/components/DetailsBlockWidget.vue'
import BlockquoteBlockWidget from '../../editor/components/BlockquoteBlockWidget.vue'
import ListBlockWidget from '../../editor/components/ListBlockWidget.vue'
import TableBlockWidget from '../../editor/components/TableBlockWidget.vue'

interface Mounted {
  root: HTMLElement
  stop: () => void
}

const mounted: Mounted[] = []

/** Mount one widget face into the document; the SFC's scoped styles inject
 *  on import, happy-dom resolves them, teardown unmounts. */
function mountFace(widget: unknown, props: Record<string, unknown>): Mounted {
  vi.useFakeTimers() // the mermaid debounce never fires inside parity mounts
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp({ render: () => h(widget as any, props) })
  app.mount(host)
  const m = { root: host.firstElementChild as HTMLElement, stop: () => {
    app.unmount()
    host.remove()
  } }
  mounted.push(m)
  return m
}

afterEach(() => {
  while (mounted.length > 0) mounted.pop()!.stop()
  vi.useRealTimers()
})

beforeEach(() => {
  clearOptionalCapabilities()
})

afterEach(() => {
  clearOptionalCapabilities()
})

function fenceNode(language: string, code: string) {
  let node = leafBlock('f1', BlockType.Fence, code)
  node = { ...node, attrs: attrSet(node.attrs, 'language', Value.Str(language)) }
  return node
}

function editCtxOf(md: string) {
  const doc = parse_blocks(md, true)
  const engine = new EditorEngine(doc)
  return { engine, node: doc.children[0]!, blockId: doc.children[0]!.id }
}

/** The chrome-layer computed property set: container box model pieces that
 *  carry no CSS variables (deterministic in happy-dom). */
const CONTAINER_PROPS = ['border-top-width', 'border-top-style', 'border-right-width', 'border-bottom-style', 'border-radius'] as const

function computedOf(el: HTMLElement | null, props: readonly string[]): string[] {
  expect(el, 'chrome element present').not.toBeNull()
  const cs = getComputedStyle(el!)
  return props.map((p) => cs.getPropertyValue(p))
}

describe('Fence family (CodeBlockWidget) — three-mode parity', () => {
  it('view ≡ stream: identical root and body class chains (final is the only difference)', () => {
    const node = fenceNode('rust', 'fn a() {}\n')
    const view = mountFace(CodeBlockWidget, { mode: 'view', node, final: true, ctx: null })
    const stream = mountFace(CodeBlockWidget, { mode: 'stream', node, final: false, ctx: null })
    expect(stream.root.className).toBe(view.root.className)
    const vPre = view.root.querySelector('pre')
    const sPre = stream.root.querySelector('pre')
    expect(sPre!.className).toBe(vPre!.className)
    expect(sPre!.getAttribute('data-language')).toBe(vPre!.getAttribute('data-language'))
  })

  it('the code-block-header chain renders with identical classes in every mode', () => {
    const node = fenceNode('rust', 'fn a() {}\n')
    const { engine, node: eNode, blockId } = editCtxOf('```rust\nfn a() {}\n```')
    const view = mountFace(CodeBlockWidget, { mode: 'view', node, final: true, ctx: null })
    const stream = mountFace(CodeBlockWidget, { mode: 'stream', node, final: false, ctx: null })
    const edit = mountFace(CodeBlockWidget, { mode: 'edit', node: eNode, ctx: { engine, blockId, readonly: false } })
    for (const m of [view, stream, edit]) {
      const header = m.root.querySelector('.code-block-header')
      expect(header, 'header chain present').not.toBeNull()
      expect(header!.className).toBe('code-block-header flex justify-between items-center')
      const title = header!.querySelector('.code-header-title')
      expect(title!.className).toBe('code-header-title')
    }
  })

  it('header typography computes identically across the three modes', () => {
    const node = fenceNode('rust', 'fn a() {}\n')
    const { engine, node: eNode, blockId } = editCtxOf('```rust\nfn a() {}\n```')
    const view = mountFace(CodeBlockWidget, { mode: 'view', node, final: true, ctx: null })
    const edit = mountFace(CodeBlockWidget, { mode: 'edit', node: eNode, ctx: { engine, blockId, readonly: false } })
    const vTitle = computedOf(view.root.querySelector('.code-header-title'), ['font-size', 'font-weight', 'line-height'])
    const eTitle = computedOf(edit.root.querySelector('.code-header-title'), ['font-size', 'font-weight', 'line-height'])
    expect(eTitle).toEqual(vTitle)
  })

  it('the 032 skeleton family keys on node attrs identically in view and stream', () => {
    let node = fenceNode('rust', 'fn a() {')
    node = { ...node, attrs: attrSet(node.attrs, 'loading', Value.Bool(true)) }
    const view = mountFace(CodeBlockWidget, { mode: 'view', node, final: true, ctx: null })
    const stream = mountFace(CodeBlockWidget, { mode: 'stream', node, final: false, ctx: null })
    expect(view.root.className).toContain('autodown-block-placeholder is-loading')
    expect(stream.root.className).toBe(view.root.className)
  })
})

describe('Math family (MathBlockWidget) — three-mode parity', () => {
  const MATH_MD = '%{\ne = mc^2\n}%\n'

  function faces() {
    const node = leafBlock('m1', BlockType.MathBlock, 'e = mc^2')
    const { engine, node: eNode, blockId } = editCtxOf(MATH_MD)
    return {
      view: mountFace(MathBlockWidget, { mode: 'view', node, final: true, ctx: null }),
      stream: mountFace(MathBlockWidget, { mode: 'stream', node, final: false, ctx: null }),
      edit: mountFace(MathBlockWidget, { mode: 'edit', node: eNode, ctx: { engine, blockId, readonly: false } }),
    }
  }

  it('container box model computes identically in every mode (widget-owned chrome)', () => {
    const f = faces()
    const v = computedOf(f.view.root, CONTAINER_PROPS)
    expect(computedOf(f.stream.root, CONTAINER_PROPS)).toEqual(v)
    expect(computedOf(f.edit.root, CONTAINER_PROPS)).toEqual(v)
  })

  it('the container rule is the family canon: border resolves in every mode or in none', () => {
    // happy-dom drops declarations carrying var() (the view canon's hsl(var
    // (--border, ...)) fallback chain) — so the pin here is ALL-OR-NOTHING:
    // the same declaration either resolves in every mode or in none. A
    // per-mode fork would surface as unequal strings in the test above; the
    // 1px/solid values themselves are pinned by the .at style source (the
    // single chrome source this plan exists to create).
    const f = faces()
    const widths = [f.view.root, f.stream.root, f.edit.root].map((el) =>
      getComputedStyle(el).getPropertyValue('border-top-width'),
    )
    expect(new Set(widths).size).toBe(1)
  })

  it('the shared preview/error pieces keep one class name and one rule set (view ≡ stream)', () => {
    const f = faces()
    const vPreview = f.view.root.querySelector('.autodown-math-preview') as HTMLElement | null
    const sPreview = f.stream.root.querySelector('.autodown-math-preview') as HTMLElement | null
    expect(sPreview!.className).toBe(vPreview!.className)
    expect(computedOf(sPreview, ['padding-top', 'padding-left', 'overflow-x'])).toEqual(
      computedOf(vPreview, ['padding-top', 'padding-left', 'overflow-x']),
    )
    const ePreview = f.edit.root.querySelector('.autodown-math-preview')
    expect(ePreview!.className).toBe(vPreview!.className)
  })

  it('edit-face whitelist: textarea / caret / banner / stack separation are the only divergences', () => {
    const f = faces()
    // the editing face's behavioral pieces exist only there
    expect(f.edit.root.querySelector('.math-editor-textarea')).not.toBeNull()
    expect(f.view.root.querySelector('.math-editor-textarea')).toBeNull()
    // the stack separation chrome (border-bottom + white bg) is edit-only
    const stack = f.edit.root.querySelector('.math-editor-stack')
    expect(stack).not.toBeNull()
  })
})

describe('Mermaid family (MermaidBlockWidget) — three-mode parity', () => {
  const MERMAID_MD = '```mermaid\ngraph TD; A-->B;\n```\n'

  function faces() {
    const node = leafBlock('g1', BlockType.Mermaid, 'graph TD; A-->B;')
    const { engine, node: eNode, blockId } = editCtxOf(MERMAID_MD)
    return {
      view: mountFace(MermaidBlockWidget, { mode: 'view', node, final: true, ctx: null }),
      stream: mountFace(MermaidBlockWidget, { mode: 'stream', node, final: false, ctx: null }),
      edit: mountFace(MermaidBlockWidget, { mode: 'edit', node: eNode, ctx: { engine, blockId, readonly: false } }),
    }
  }

  it('container box model computes identically in every mode (widget-owned chrome)', () => {
    const f = faces()
    const v = computedOf(f.view.root, CONTAINER_PROPS)
    expect(computedOf(f.stream.root, CONTAINER_PROPS)).toEqual(v)
    expect(computedOf(f.edit.root, CONTAINER_PROPS)).toEqual(v)
  })

  it('view ≡ stream: identical root class and source slot chain', () => {
    const f = faces()
    expect(f.stream.root.className).toBe(f.view.root.className)
    expect(f.stream.root.querySelector('.mermaid-source')!.className).toBe(
      f.view.root.querySelector('.mermaid-source')!.className,
    )
  })

  it('edit-face whitelist: the debounce tri-state pieces are edit-only', () => {
    const f = faces()
    expect(f.edit.root.querySelector('.mermaid-editor-textarea')).not.toBeNull()
    expect(f.view.root.querySelector('.mermaid-editor-textarea')).toBeNull()
    expect(f.view.root.querySelector('.mermaid-source')).not.toBeNull()
  })
})


// -- container families (plan 035 T8) ---------------------------------------------
//
// The container widgets own no injected styles (their style blocks are
// empty — the chrome classes resolve in autodown-editor.css), so the parity
// pin is the CLASS CHAIN + structural markers: view ≡ stream root chains,
// edit shares the container chrome with only the declared whitelist
// diverging (AttrHost title/summary hosts, the live task checkbox, the
// markdown-renderer children wrapper, the stream banner).

describe('Callout family (CalloutBlockWidget) — three-mode parity', () => {
  function faces() {
    let node = withChildren(block('c1', BlockType.Callout), [block('c1-p', BlockType.Paragraph)])
    node.attrs = attrSet(node.attrs, 'type', Value.Str('warning'))
    node.attrs = attrSet(node.attrs, 'title', Value.Str('注意'))
    const children = () => [h('p', { key: 'k' }, '正文')]
    return {
      view: mountFace(CalloutBlockWidget, { mode: 'view', node, ctx: null, final: true, children, version: 0 }),
      stream: mountFace(CalloutBlockWidget, { mode: 'stream', node, ctx: null, final: false, children, version: 0 }),
      edit: mountFace(CalloutBlockWidget, {
        mode: 'edit', node, ctx: { engine: { doc: null }, blockId: 'c1', readonly: false },
        final: true, children, version: 1,
      }),
    }
  }

  it('view ≡ stream: identical root class chain and icon/title chrome', () => {
    const f = faces()
    expect(f.stream.root.className).toBe('callout-node autodown-callout autodown-callout-warning')
    expect(f.stream.root.className).toBe(f.view.root.className)
    expect(f.stream.root.querySelector('.autodown-callout-icon')!.className).toBe(
      f.view.root.querySelector('.autodown-callout-icon')!.className,
    )
  })

  it('edit shares the container chrome; the title host is the only divergence', () => {
    const f = faces()
    expect(f.edit.root.className).toBe(f.view.root.className)
    expect(f.edit.root.querySelector('.autodown-callout-content')!.className).toBe(
      f.view.root.querySelector('.autodown-callout-content')!.className,
    )
    // whitelist: AttrHost replaces the static title div; no banner unless streaming
    expect(f.edit.root.querySelector('.autodown-attr-host.autodown-callout-title')).not.toBeNull()
    expect(f.view.root.querySelector('.autodown-attr-host')).toBeNull()
    expect(f.edit.root.querySelector('.autodown-stream-banner')).toBeNull()
  })

  it('readonly edit (stream gate): banner mounts, chrome unchanged', () => {
    let node = withChildren(block('c1', BlockType.Callout), [])
    node.attrs = attrSet(node.attrs, 'type', Value.Str('tip'))
    const m = mountFace(CalloutBlockWidget, {
      mode: 'edit', node, ctx: { engine: { doc: null }, blockId: 'c1', readonly: true },
      final: true, children: () => [], version: 0,
    })
    expect(m.root.className).toBe('callout-node autodown-callout autodown-callout-tip')
    expect(m.root.querySelector('.autodown-stream-banner')).not.toBeNull()
  })
})

describe('Details family (DetailsBlockWidget) — three-mode parity', () => {
  function faces() {
    let node = withChildren(block('d1', BlockType.Details), [block('d1-p', BlockType.Paragraph)])
    node.attrs = attrSet(node.attrs, 'open', Value.Bool(true))
    node.attrs = attrSet(node.attrs, 'summary', Value.Str('摘要'))
    const children = () => [h('p', { key: 'k' }, '正文')]
    return {
      view: mountFace(DetailsBlockWidget, { mode: 'view', node, ctx: null, final: true, children, version: 0 }),
      stream: mountFace(DetailsBlockWidget, { mode: 'stream', node, ctx: null, final: false, children, version: 0 }),
      edit: mountFace(DetailsBlockWidget, {
        mode: 'edit', node, ctx: { engine: { doc: null }, blockId: 'd1', readonly: false },
        final: true, children, version: 1,
      }),
    }
  }

  it('view ≡ stream ≡ edit: identical root class, data-open, marker/content chrome', () => {
    const f = faces()
    for (const m of [f.view, f.stream, f.edit]) {
      expect(m.root.className).toBe('autodown-details')
      expect(m.root.getAttribute('data-open')).toBe('true')
      expect(m.root.querySelector('.autodown-details-marker')!.className).toBe('autodown-details-marker')
      expect(m.root.querySelector('.autodown-details-content')!.className).toBe('autodown-details-content')
    }
  })

  it('edit-face whitelist: the AttrHost summary is the only divergence', () => {
    const f = faces()
    expect(f.edit.root.querySelector('.autodown-attr-host.autodown-details-summary-text')).not.toBeNull()
    expect(f.view.root.querySelector('.autodown-attr-host')).toBeNull()
    expect(f.view.root.querySelector('.autodown-details-summary-text')).not.toBeNull()
  })
})

describe('Blockquote family (BlockquoteBlockWidget) — three-mode parity', () => {
  it('view ≡ stream ≡ edit: the thin shell is one chrome', () => {
    const node = withChildren(block('q1', BlockType.Blockquote), [block('q1-p', BlockType.Paragraph)])
    const children = () => [h('p', { key: 'k' }, '正文')]
    const view = mountFace(BlockquoteBlockWidget, { mode: 'view', node, ctx: null, final: true, children, version: 0 })
    const stream = mountFace(BlockquoteBlockWidget, { mode: 'stream', node, ctx: null, final: false, children, version: 0 })
    const edit = mountFace(BlockquoteBlockWidget, {
      mode: 'edit', node, ctx: { engine: { doc: null }, blockId: 'q1', readonly: false },
      final: true, children, version: 0,
    })
    for (const m of [view, stream, edit]) {
      expect(m.root.tagName).toBe('BLOCKQUOTE')
      expect(m.root.className).toBe('blockquote')
      expect(m.root.getAttribute('dir')).toBe('auto')
    }
  })
})

describe('List family (ListBlockWidget) — three-mode parity', () => {
  function faces() {
    let node = withChildren(block('l1', BlockType.ListBlock), [withChildren(block('l1-i1', BlockType.ListItem), [block('l1-i1-p', BlockType.Paragraph)])])
    node.attrs = attrSet(node.attrs, 'ordered', Value.Bool(false))
    const item = node.children[0]!
    item.attrs = attrSet(item.attrs, 'checked', Value.Bool(true))
    const items = [
      { id: 'l1-i1', task: true, checked: true, cls: 'list-item task-item', children_slot: () => [h('p', { key: 'k' }, '正文')] },
    ]
    return {
      view: mountFace(ListBlockWidget, { mode: 'view', node, ctx: null, final: true, items, version: 0 }),
      stream: mountFace(ListBlockWidget, { mode: 'stream', node, ctx: null, final: false, items, version: 0 }),
      edit: mountFace(ListBlockWidget, {
        mode: 'edit', node, ctx: { engine: { doc: null }, blockId: 'l1', readonly: false },
        final: true, items, version: 0,
      }),
    }
  }

  it('view ≡ stream ≡ edit: identical list/li chrome chains', () => {
    const f = faces()
    for (const m of [f.view, f.stream, f.edit]) {
      expect(m.root.tagName).toBe('UL')
      expect(m.root.className).toBe('list-node list-disc')
      const li = m.root.querySelector('li')!
      expect(li.className).toBe('list-item task-item')
      expect(li.getAttribute('dir')).toBe('auto')
      expect(m.root.querySelector('.task-checkbox')!.className).toBe('task-checkbox')
    }
  })

  it('checkbox mode split: view/stream inert (disabled), edit live', () => {
    const f = faces()
    expect((f.view.root.querySelector('.task-checkbox') as HTMLInputElement).disabled).toBe(true)
    expect((f.stream.root.querySelector('.task-checkbox') as HTMLInputElement).disabled).toBe(true)
    expect((f.edit.root.querySelector('.task-checkbox') as HTMLInputElement).disabled).toBe(false)
    expect(f.edit.root.querySelector('.task-checkbox')!.getAttribute('aria-label')).toBe('toggle task')
    expect(f.view.root.querySelector('.task-checkbox')!.getAttribute('aria-label')).toBe('task checkbox')
  })
})

// -- table family (plan 037 T6) ----------------------------------------------------
//
// The table widget's three faces absorbed TWO retired implementations whose
// byte contracts are deliberately different roots (view = tablePanel's bare
// table.table-node, stream = the StreamingTable SFC's .streaming-table
// wrapper) — the drift-proof claim here is not view ≡ stream roots but the
// SHARED chrome: one table-node inner chain across view/edit, one align/
// dir cell chrome, the stream loading family keyed on final, and the
// edit-only whitelist (toolbar / contenteditable / banner). The view
// container's own box model is consumer-CSS territory (the fence view
// precedent — the widget deliberately styles no .table-node chrome).

describe('Table family (TableBlockWidget) — three-mode parity', () => {
  const FILLER = { controller: null, blockId: '', columns: [], rows: [] }

  /** view cells: the panel adapter's shape ({id, cls, children_slot}). */
  const vCell = (id: string, text: string) => ({
    id,
    cls: 'text-left',
    children_slot: () => [h('div', { class: 'markdown-renderer' }, [h('span', text)])],
  })
  /** edit cells: the edit adapter's shape ({id, text, cls}). */
  const eCell = (id: string, text: string) => ({ id, text, cls: 'text-left' })

  function faces() {
    const ctl = { addRow() {}, deleteRow() {}, addColumn() {}, deleteColumn() {} }
    return {
      view: mountFace(TableBlockWidget, {
        ...FILLER, mode: 'view', final: true, readonly: true,
        header_cells: [vCell('h0', '名称'), vCell('h1', '值')],
        body_rows: [{ id: 'r0', cells: [vCell('r0c0', '甲'), vCell('r0c1', '1')] }],
      }),
      stream: mountFace(TableBlockWidget, {
        ...FILLER, mode: 'stream', final: false, readonly: true,
        header_cells: [], body_rows: [],
        columns: ['名称', '值'], rows: [{ 名称: '甲', 值: '1' }],
      }),
      edit: mountFace(TableBlockWidget, {
        ...FILLER, mode: 'edit', final: true, readonly: false,
        controller: ctl, blockId: 't1',
        header_cells: [eCell('h0', '名称'), eCell('h1', '值')],
        body_rows: [{ id: 'r0', cells: [eCell('r0c0', '甲'), eCell('r0c1', '1')] }],
      }),
    }
  }

  it('view ≡ edit inner table: ONE table-node chrome chain (class + aria-busy)', () => {
    const f = faces()
    const vTable = f.view.root as HTMLElement // the view root IS the table
    expect(vTable.tagName).toBe('TABLE')
    expect(vTable.className).toBe('table-node')
    expect(vTable.getAttribute('aria-busy')).toBe('false')
    const eTable = f.edit.root.querySelector('table')
    expect(eTable!.className).toBe('table-node')
    expect(eTable!.getAttribute('aria-busy')).toBe('false')
  })

  it('the cell chrome (dir + align class) is shared; each face adds only its whitelist pieces', () => {
    const f = faces()
    const vTh = f.view.root.querySelector('th')!
    const eTh = f.edit.root.querySelector('th')!
    for (const th of [vTh, eTh]) {
      expect(th.getAttribute('dir')).toBe('auto')
      expect(th.className).toBe('text-left')
    }
    // edit-only (behavioral): the contenteditable + cell-id carrier
    expect(eTh.getAttribute('contenteditable')).toBe('true')
    expect(eTh.getAttribute('data-cell-id')).toBe('h0')
    expect(vTh.getAttribute('contenteditable')).toBeNull()
    // view-only (render-embedded): the resize handle — absent in edit
    expect(vTh.querySelector('.table-node__resize-handle')).not.toBeNull()
    expect(eTh.querySelector('.table-node__resize-handle')).toBeNull()
  })

  it('stream face: the .streaming-table wrapper + loading row keyed on final', () => {
    const f = faces()
    expect(f.stream.root.className).toBe('streaming-table')
    expect(f.stream.root.querySelector('tr.loading-row')).not.toBeNull()
    const done = mountFace(TableBlockWidget, {
      ...FILLER, mode: 'stream', final: true, readonly: true,
      header_cells: [], body_rows: [],
      columns: ['a'], rows: [{ a: '1' }],
    })
    expect(done.root.className).toBe('streaming-table final')
    expect(done.root.querySelector('tr.loading-row')).toBeNull()
  })

  it('edit-face whitelist: toolbar + contenteditable cells are edit-only; readonly gates with the banner', () => {
    const f = faces()
    expect(f.edit.root.className).toBe('autodown-table-editor')
    expect(f.edit.root.querySelector('.te-toolbar')).not.toBeNull()
    expect(f.view.root.querySelector('.te-toolbar')).toBeNull()
    expect(f.stream.root.querySelector('.te-toolbar')).toBeNull()
    const ro = mountFace(TableBlockWidget, {
      ...FILLER, mode: 'edit', final: true, readonly: true,
      controller: { addRow() {} }, blockId: 't1',
      header_cells: [eCell('h0', '名称')], body_rows: [],
    })
    expect(ro.root.className).toBe('autodown-table-editor is-readonly')
    expect(ro.root.querySelector('.autodown-stream-banner')).not.toBeNull()
    expect(ro.root.querySelector('th')!.getAttribute('contenteditable')).toBe('false')
  })
})
