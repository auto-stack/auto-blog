// CalloutBlockWidget (plan 035 T3): the callout family's three-mode widget —
// view/stream face byte-compared (attr-order normalized) against the live
// builtin renderCalloutPanel (the DOM contract the T6 panel switch must not
// drift); edit face pins the absorbed expandedElement branch — same card
// chain with the AttrHost title host, the markdown-renderer children
// wrapper, and the readonly stream banner.

import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { BlockType, Value, attrSet, block, withChildren } from '../../parser/block-model'
import { CALLOUT_TYPES } from '../../render/builtin-panels'
import type { PanelRenderCtx } from '../../render/panel-registry'

// The retired builtin renderCalloutPanel, frozen verbatim as the byte-parity
// reference (the function left builtin-panels.ts at the T6 panel switch —
// the widget owns the face, this copy keeps the contract pinned).
function builtinCalloutPanel({ node }: PanelRenderCtx) {
  const type = String(node.language ?? '')
  const title = String(node.title ?? '')
  const known = CALLOUT_TYPES.includes(type)
  return h('div', {
    class: ['callout-node', 'autodown-callout', `autodown-callout-${type}`],
    'data-callout-type': type,
  }, [
    h('div', { class: 'autodown-callout-header' }, [
      ...(known
        ? [h('span', { class: ['autodown-callout-icon', `autodown-callout-icon-${type}`], 'aria-hidden': 'true' })]
        : []),
      h('div', { class: 'autodown-callout-title', dir: 'auto' }, title.length > 0 ? title : type),
    ]),
    h('div', { class: 'autodown-callout-content' }, BODY()),
  ])
}
import { blockNodeToWNode } from '../../render/block-wnode'
import CalloutBlockWidget from '../components/CalloutBlockWidget.vue'

async function ssr(vnode: unknown): Promise<string> {
  const app = createSSRApp({ render: () => h({ render: () => vnode } as any) })
  return (await renderToString(app)).replace(/<!--.*?-->/g, '')
}

function norm(html: string): string {
  return html.replace(/<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[:\w.-]+(?:="[^"]*")?)*)\s*(\/?)>/g, (_m, tag, attrs: string, self: string) => {
    const list = attrs.trim().split(/\s+/).filter(Boolean)
      .map((a) => (a.includes('=') ? a : `${a}=""`))
      .filter((a) => !/^data-v-[0-9a-f]+=""/.test(a))
      .sort()
    return `<${tag}${list.length > 0 ? ` ${list.join(' ')}` : ''}${self}>`
  })
}

function calloutNode(type: string, title: string) {
  let node = withChildren(block('c1', BlockType.Callout), [block('c1-p', BlockType.Paragraph)])
  node.attrs = attrSet(node.attrs, 'type', Value.Str(type))
  if (title) node.attrs = attrSet(node.attrs, 'title', Value.Str(title))
  return node
}

function panelCtx(node: ReturnType<typeof calloutNode>, final: boolean, body: () => any[]): PanelRenderCtx {
  return {
    node: blockNodeToWNode(node),
    final,
    budget: undefined,
    spec: { kind: 'Callout' } as any,
    renderEmbedded: (() => body()) as any,
    renderInlineChildren: () => [],
  }
}

const BODY = () => [h('p', { key: 'p' }, '正文段落')]

describe('view/stream face: the builtin renderCalloutPanel contract, byte-for-byte', () => {
  it('known type: full card chain identical to the builtin panel', async () => {
    const node = calloutNode('warning', '注意')
    const builtin = await ssr(builtinCalloutPanel(panelCtx(node, true, BODY)))
    const widget = await ssr(h(CalloutBlockWidget as any, {
      mode: 'view', node, ctx: null, final: true, children: BODY, version: 0,
    }))
    expect(norm(widget)).toBe(norm(builtin))
    // the render.test.ts pinned shape, on the widget face directly
    expect(widget).toContain('callout-node autodown-callout autodown-callout-warning')
    expect(widget).toContain('data-callout-type="warning"')
    expect(widget).toContain('autodown-callout-icon-warning')
    expect(widget).toContain('autodown-callout-title')
    expect(widget).toContain('正文段落')
  })

  it('empty title falls back to the type label; unknown type drops the icon', async () => {
    const note = calloutNode('note', '')
    const widget = await ssr(h(CalloutBlockWidget as any, {
      mode: 'view', node: note, ctx: null, final: true, children: BODY, version: 0,
    }))
    expect(widget).toMatch(/autodown-callout-title[^>]*>note</)
    const exotic = calloutNode('custom', '异型')
    const custom = await ssr(h(CalloutBlockWidget as any, {
      mode: 'view', node: exotic, ctx: null, final: true, children: BODY, version: 0,
    }))
    expect(custom).not.toContain('autodown-callout-icon-custom')
    expect(custom).toContain('autodown-callout-custom')
  })

  it('stream face renders byte-identical chrome to view (final only differs)', async () => {
    const node = calloutNode('tip', '提示')
    const view = await ssr(h(CalloutBlockWidget as any, { mode: 'view', node, ctx: null, final: true, children: BODY, version: 0 }))
    const stream = await ssr(h(CalloutBlockWidget as any, { mode: 'stream', node, ctx: null, final: false, children: BODY, version: 0 }))
    expect(norm(stream)).toBe(norm(view))
  })
})

describe('edit face: the expandedElement Callout branch, absorbed', () => {
  it('same card chain with the AttrHost title host + markdown-renderer children wrapper', async () => {
    const engine = { doc: null } as any
    const node = calloutNode('warning', '注意')
    const html = await ssr(h(CalloutBlockWidget as any, {
      mode: 'edit', node,
      ctx: { engine, blockId: 'c1', readonly: false },
      final: true,
      children: () => [h('div', { class: 'child-slot', key: 'k' }, '子块')],
      version: 7,
    }))
    expect(html).toContain('callout-node autodown-callout autodown-callout-warning')
    expect(html).toContain('data-callout-type="warning"')
    expect(html).toContain('autodown-callout-icon-warning')
    expect(html).toContain('autodown-attr-host autodown-callout-title')
    expect(html).toContain('autodown-callout-content')
    expect(html).toContain('markdown-renderer')
    expect(html).toContain('child-slot')
    expect(html).not.toContain('autodown-stream-banner')
  })

  it('readonly (stream gate): banner + contenteditable=false title host', async () => {
    const node = calloutNode('info', '')
    const html = await ssr(h(CalloutBlockWidget as any, {
      mode: 'edit', node,
      ctx: { engine: {}, blockId: 'c1', readonly: true },
      final: true, children: () => [], version: 1,
    }))
    expect(html).toContain('autodown-stream-banner')
    expect(html).toContain('流式生成中')
    expect(html).toContain('contenteditable="false"')
  })
})
