// BlockWidget family mechanism tests (plan 033 T1): registerBlockWidget
// fills all three BlockComponent slots with one widget + mode prop, panelOf
// wraps the same widget as a PanelRenderer (so the view face reaches both
// panel consumers — editor preview and static render), and
// unregister/teardown drop the kind back to the builtin pipeline.

import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BlockType,
  attrGetStr,
  blockText,
  leafBlock,
} from '../../parser/block-model'
import type { BlockEditCtx } from '../block-component'
import {
  clearBlockComponents,
  registerBlockComponent,
  resolveBlockComponent,
} from '../block-component'
import {
  panelOf,
  registerBlockWidget,
  unregisterBlockWidget,
  type BlockWidgetMode,
  type BlockWidgetProps,
} from '../block-widget'
import { blockNodeToWNode } from '../block-wnode'
import { WNode, codeNode } from '../../parser/markdown-parser'
import type { PanelRenderCtx } from '../panel-registry'
import * as renderExports from '../index'

// probe widget: renders markers of every prop the family plumbing forwards
// (mode / node identity+payload / final / ctx), so the tests below assert
// exactly what reaches the widget.
const ProbeWidget = defineComponent({
  props: {
    mode: { type: String, required: true },
    node: { type: Object, required: true },
    final: { type: Boolean, default: undefined },
    ctx: { type: Object, default: undefined },
  },
  setup(p) {
    return () =>
      h('div', { class: 'probe-widget', 'data-mode': p.mode }, [
        h('span', { class: 'probe-id' }, (p.node as any)?.id ?? ''),
        h('span', { class: 'probe-kind' }, String((p.node as any)?.kind ?? '')),
        h('span', { class: 'probe-language' }, attrGetStr((p.node as any)?.attrs, 'language', '')),
        h('span', { class: 'probe-text' }, blockText(p.node as any)),
        h('span', { class: 'probe-final' }, p.final === undefined ? 'unset' : String(p.final)),
        h('span', { class: 'probe-ctx' }, (p.ctx as any)?.blockId ?? ''),
      ])
  },
})

async function ssr(vnode: any): Promise<string> {
  const app = createSSRApp({ render: () => vnode })
  return (await renderToString(app)).replace(/<!--.*?-->/g, '')
}

function panelCtx(w: any, final?: boolean): PanelRenderCtx {
  return {
    node: w,
    final,
    budget: undefined,
    spec: { kind: 'Codeblock' } as any,
    renderEmbedded: () => h('div'),
    renderInlineChildren: () => [],
  }
}

afterEach(() => {
  clearBlockComponents()
})

describe('registerBlockWidget (one widget, three slots)', () => {
  it('fills the view slot: widget mounts with mode=view over the node', async () => {
    registerBlockWidget('Fence', ProbeWidget)
    const node = leafBlock('f1', BlockType.Fence, 'const x = 1')
    const html = await ssr(resolveBlockComponent('Fence').view(node, true))
    expect(html).toContain('data-mode="view"')
    expect(html).toContain('probe-id">f1<')
    expect(html).toContain('probe-text">const x = 1<')
  })

  it('fills the stream slot: mode=stream, final forwards verbatim', async () => {
    registerBlockWidget('Fence', ProbeWidget)
    const node = leafBlock('f1', BlockType.Fence, 'x')
    const html = await ssr(resolveBlockComponent('Fence').stream!(node, false))
    expect(html).toContain('data-mode="stream"')
    expect(html).toContain('probe-final">false<')
  })

  it('fills the edit slot: mode=edit, ctx forwards verbatim', async () => {
    registerBlockWidget('Fence', ProbeWidget)
    const node = leafBlock('f1', BlockType.Fence, 'x')
    const ctx: BlockEditCtx = { engine: {} as any, blockId: 'blk-9', readonly: true }
    const html = await ssr(resolveBlockComponent('Fence').edit!(node, ctx))
    expect(html).toContain('data-mode="edit"')
    expect(html).toContain('probe-ctx">blk-9<')
  })

  it('registers under the canonical kind (math_block -> MathBlock)', () => {
    registerBlockWidget('math_block', ProbeWidget)
    const comp = resolveBlockComponent('MathBlock')
    expect(comp.view).toBeDefined()
    expect(comp.stream).toBeDefined()
    expect(comp.edit).toBeDefined()
  })

  it('a family registration owns all three slots (replaces an earlier edit slot)', async () => {
    registerBlockComponent('Fence', {
      edit: () => h('div', { class: 'kept-edit' }),
    })
    registerBlockWidget('Fence', ProbeWidget)
    const node = leafBlock('f1', BlockType.Fence, 'x')
    const html = await ssr(resolveBlockComponent('Fence').edit!(node, { engine: {} as any, blockId: 'b', readonly: false }))
    expect(html).toContain('data-mode="edit"')
    expect(html).not.toContain('kept-edit')
  })

  it('unregisterBlockWidget drops the registration: builtin view resumes, edit/stream gone', async () => {
    registerBlockWidget('Fence', ProbeWidget)
    unregisterBlockWidget('Fence')
    const comp = resolveBlockComponent('Fence')
    expect(comp.edit).toBeUndefined()
    expect(comp.stream).toBeUndefined()
    // builtin view output, not the probe
    const fence = leafBlock('f1', BlockType.Fence, 'const x = 1')
    const html = await ssr(comp.view(fence, true))
    expect(html).not.toContain('probe-widget')
    expect(html).toContain('code-block-container')
  })

  it('clearBlockComponents tears family registrations down with the rest', () => {
    registerBlockWidget('Fence', ProbeWidget)
    clearBlockComponents()
    const comp = resolveBlockComponent('Fence')
    expect(comp.edit).toBeUndefined()
    expect(comp.stream).toBeUndefined()
  })
})

describe('panelOf (the panel face of a family widget)', () => {
  it('mounts the widget in view mode over the back-linked model', async () => {
    const node = leafBlock('m1', BlockType.MathBlock, 'E=mc^2')
    const w = blockNodeToWNode(node)
    const html = await ssr(panelOf(ProbeWidget)(panelCtx(w, true)))
    expect(html).toContain('data-mode="view"')
    expect(html).toContain('probe-id">m1<')
    expect(html).toContain('probe-text">E=mc^2<')
  })

  it('forwards final: undefined defaults to true (panel segments read final-state)', async () => {
    const node = leafBlock('m1', BlockType.MathBlock, 'x')
    const w = blockNodeToWNode(node)
    const html = await ssr(panelOf(ProbeWidget)(panelCtx(w)))
    expect(html).toContain('probe-final">true<')
  })

  it('fabricates a model for parse-side WNodes (static render, no back-link)', async () => {
    const w = codeNode('js', 'const x = 1', false)
    const html = await ssr(panelOf(ProbeWidget)(panelCtx(w, true)))
    expect(html).toContain('data-mode="view"')
    expect(html).toContain('probe-kind">2<') // fabricated kind = BlockType.Fence
    expect(html).toContain('probe-language">js<')
    expect(html).toContain('probe-text">const x = 1<')
  })

  it('fabricated math model carries the WNode code as inlines source', async () => {
    const w = new WNode(
      'math_block', null, null, null, 'a^2+b^2', null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    )
    const html = await ssr(panelOf(ProbeWidget)(panelCtx(w, true)))
    expect(html).toContain('probe-kind">16<') // BlockType.MathBlock
    expect(html).toContain('probe-text">a^2+b^2<')
  })
})

describe('export surface (src/render/index.ts)', () => {
  it('exposes the family API from @autodown/engine/render', () => {
    for (const name of ['registerBlockWidget', 'unregisterBlockWidget', 'panelOf']) {
      expect(typeof (renderExports as any)[name]).toBe('function')
    }
  })
})

describe('BlockWidget types', () => {
  it('the mode union and props shape typecheck', () => {
    const mode: BlockWidgetMode = 'view'
    const props: BlockWidgetProps = { mode, node: leafBlock('x', BlockType.Fence, 'y'), final: true }
    expect(props.mode).toBe('view')
  })
})
