// DetailsBlockWidget (plan 035 T4): the details family's three-mode widget —
// absorbs the generated DetailsNodeView (view/stream) and EngineEditor's
// expandedElement Details branch (edit). Pins the host-protocol e2e
// assertion face at the unit level: data-open flips through ONE setBlockAttrs
// step from BOTH faces' marker (and the view summary text), the ▼/▶ marker
// state, the "Details" fallback label, and the closed content's
// display:none; the edit face swaps the summary for the AttrHost and wraps
// the children behind .markdown-renderer.

// @vitest-environment happy-dom

import { createApp, createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { BlockType, Value, attrGetBool, attrSet, block, findBlock, withChildren } from '../../parser/block-model'
import { EditorEngine } from '../engine/editor-engine'
import DetailsBlockWidget from '../components/DetailsBlockWidget.vue'

async function ssr(vnode: unknown): Promise<string> {
  const app = createSSRApp({ render: () => h({ render: () => vnode } as any) })
  return (await renderToString(app)).replace(/<!--.*?-->/g, '')
}

function detailsEngine(open: boolean, summary = 'Click to expand') {
  let node = withChildren(block('d1', BlockType.Details), [block('d1-p', BlockType.Paragraph)])
  node.attrs = attrSet(node.attrs, 'open', Value.Bool(open))
  node.attrs = attrSet(node.attrs, 'summary', Value.Str(summary))
  const root = withChildren(block('doc', BlockType.Paragraph), [node])
  return { engine: new EditorEngine(root), node }
}

function openOf(engine: EditorEngine): boolean {
  const found = findBlock(engine.doc, 'd1')
  return found ? attrGetBool(found.attrs, 'open', false) : false
}

const BODY = () => [h('p', { key: 'p' }, 'Details block')]

describe('view face: the DetailsNodeView contract, absorbed', () => {
  it('closed: data-open=false, ▶ marker, summary text, hidden content', async () => {
    const { node } = detailsEngine(false)
    const html = await ssr(h(DetailsBlockWidget as any, { mode: 'view', node, ctx: null, final: true, children: BODY, version: 0 }))
    expect(html).toContain('class="autodown-details"')
    expect(html).toContain('data-open="false"')
    expect(html).toContain('▶')
    expect(html).toContain('autodown-details-summary-text')
    expect(html).toContain('Click to expand')
    expect(html).toContain('display:none')
    expect(html).toContain('Details block')
  })

  it('open: data-open=true, ▼ marker, visible content; empty summary falls back to "Details"', async () => {
    const { node } = detailsEngine(true, '')
    const html = await ssr(h(DetailsBlockWidget as any, { mode: 'view', node, ctx: null, final: true, children: BODY, version: 0 }))
    expect(html).toContain('data-open="true"')
    expect(html).toContain('▼')
    expect(html).not.toContain('display:none')
    expect(html).toMatch(/autodown-details-summary-text[^>]*><span>Details</)
  })
})

describe('the toggle verb: marker/summary click = ONE setBlockAttrs step (both faces)', () => {
  function mountFace(engine: EditorEngine, node: unknown, mode: 'view' | 'edit', click: (root: HTMLElement) => HTMLElement) {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp({
      render: () =>
        h(DetailsBlockWidget as any, {
          mode,
          node,
          ctx: mode === 'edit' ? { engine, blockId: 'd1', readonly: false } : null,
          final: true,
          children: () => [],
          version: 1,
        }),
    })
    app.mount(host)
    return { root: host.firstElementChild as HTMLElement, target: click(host.firstElementChild as HTMLElement), stop: () => { app.unmount(); host.remove() } }
  }

  it('view marker click flips open (the panel path, engine via ctx at T6)', () => {
    const { engine, node } = detailsEngine(false)
    // simulate the T6 panelOf ctx: the host window's engine rides the ctx
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp({
      render: () => h(DetailsBlockWidget as any, {
        mode: 'view', node, ctx: { engine, blockId: 'd1', readonly: true }, final: true, children: () => [], version: 1,
      }),
    })
    app.mount(host)
    const root = host.firstElementChild as HTMLElement
    root.querySelector<HTMLElement>('.autodown-details-marker')!.click()
    expect(openOf(engine)).toBe(true)
    expect(engine.canUndo).toBe(true)
    engine.undo()
    expect(openOf(engine)).toBe(false)
    app.unmount()
    host.remove()
  })

  it('edit marker click flips open likewise', () => {
    const { engine, node } = detailsEngine(false)
    const m = mountFace(engine, node, 'edit', (root) => root.querySelector<HTMLElement>('.autodown-details-marker')!)
    m.target.click()
    expect(openOf(engine)).toBe(true)
    m.stop()
  })
})

describe('edit face: the expandedElement Details branch, absorbed', () => {
  it('AttrHost summary + markdown-renderer children wrapper', async () => {
    const { engine, node } = detailsEngine(true)
    const html = await ssr(h(DetailsBlockWidget as any, {
      mode: 'edit', node, ctx: { engine, blockId: 'd1', readonly: false }, final: true,
      children: () => [h('div', { class: 'child-slot', key: 'k' }, '子块')], version: 3,
    }))
    expect(html).toContain('autodown-attr-host autodown-details-summary-text')
    expect(html).toContain('markdown-renderer')
    expect(html).toContain('child-slot')
    expect(html).toContain('data-open="true"')
  })
})
