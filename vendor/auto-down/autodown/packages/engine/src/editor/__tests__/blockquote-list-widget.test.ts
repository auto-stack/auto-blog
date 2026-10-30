// BlockquoteBlockWidget / ListBlockWidget (plan 035 T5): the thin-shell
// container widgets — view faces byte-compared (attr-order normalized)
// against the live builtin renderQuotePanel / renderListPanel (the T6 panel
// switch's zero-drift contract); edit faces pin the absorbed
// expandedElement branches (markdown-renderer wrapper, the ordered start
// attr, the LIVE task checkbox verb through ONE setBlockAttrs step).

// @vitest-environment happy-dom

import { createApp, createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { BlockType, Value, attrGetBool, attrSet, block, findBlock, withChildren } from '../../parser/block-model'
// The retired builtin renderQuotePanel is still live (Quote keeps its
// builtin entry, plan 035 scope); renderListPanel left builtin-panels.ts at
// the T6 panel switch — frozen verbatim below as the byte-parity reference.
import { builtinPanelRenderers } from '../../render/builtin-panels'

function builtinListPanel({ node }: PanelRenderCtx) {
  const tag = node.ordered ? 'ol' : 'ul'
  return h(
    tag as string,
    { class: node.ordered ? 'list-node list-decimal' : 'list-node list-disc' },
    (node.items ?? []).map((item: any) =>
      h(
        'li',
        { class: 'list-item' + (item.checked != null ? ' task-item' : ''), dir: 'auto' },
        [
          ...(item.checked != null
            ? [h('input', { type: 'checkbox', class: 'task-checkbox', checked: item.checked === true, disabled: true, 'aria-label': 'task checkbox' })]
            : []),
          PARA('v')[0],
        ],
      ),
    ),
  )
}
import { blockNodeToWNode } from '../../render/block-wnode'
import type { PanelRenderCtx } from '../../render/panel-registry'
import { EditorEngine } from '../engine/editor-engine'
import BlockquoteBlockWidget from '../components/BlockquoteBlockWidget.vue'
import ListBlockWidget from '../components/ListBlockWidget.vue'

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

function panelCtx(w: unknown, kind: string, body: () => any[]): PanelRenderCtx {
  return { node: w, final: true, budget: undefined, spec: { kind } as any, renderEmbedded: (() => body()) as any, renderInlineChildren: () => [] }
}

const PARA = (key: string) => [h('p', { key }, `${key} 正文`)]

// -- blockquote -------------------------------------------------------------------

function quoteNode() {
  return withChildren(block('q1', BlockType.Blockquote), [block('q1-p', BlockType.Paragraph)])
}

describe('BlockquoteBlockWidget', () => {
  it('view face: byte-identical to the builtin renderQuotePanel (no markdown-renderer)', async () => {
    const node = quoteNode()
    const builtin = await ssr(builtinPanelRenderers.Quote!(panelCtx(blockNodeToWNode(node), 'Quote', () => PARA('b'))))
    const widget = await ssr(h(BlockquoteBlockWidget as any, {
      mode: 'view', node, ctx: null, final: true, children: () => PARA('b'), version: 0,
    }))
    expect(norm(widget)).toBe(norm(builtin))
    expect(widget).toContain('<blockquote class="blockquote" dir="auto">')
  })

  it('edit face: same blockquote with the markdown-renderer children wrapper', async () => {
    const node = quoteNode()
    const html = await ssr(h(BlockquoteBlockWidget as any, {
      mode: 'edit', node, ctx: { engine: {}, blockId: 'q1', readonly: false }, final: true,
      children: () => [h('div', { class: 'child-slot', key: 'k' }, '子块')], version: 1,
    }))
    expect(html).toContain('<blockquote class="blockquote" dir="auto">')
    expect(html).toContain('markdown-renderer')
    expect(html).toContain('child-slot')
  })
})

// -- list -------------------------------------------------------------------------

function listNode(ordered: boolean, checked: boolean | null) {
  let node = withChildren(block('l1', BlockType.ListBlock), [withChildren(block('l1-i1', BlockType.ListItem), [block('l1-i1-p', BlockType.Paragraph)])])
  node.attrs = attrSet(node.attrs, 'ordered', Value.Bool(ordered))
  if (ordered) node.attrs = attrSet(node.attrs, 'start', Value.Int(3))
  if (checked != null) {
    const item = node.children[0]!
    item.attrs = attrSet(item.attrs, 'checked', Value.Bool(checked))
  }
  return node
}

/** The T6 view adapter's item shape: {id, task, checked, cls,
 *  children_slot} off the WNode items (renderListPanel's reads). */
function viewItems(w: any): any[] {
  return (w.items ?? []).map((item: any, i: number) => ({
    id: `li-${i}`,
    task: item.checked != null,
    checked: item.checked === true,
    cls: 'list-item' + (item.checked != null ? ' task-item' : ''),
    children_slot: () => PARA('v'),
  }))
}

function listEngine(node: ReturnType<typeof listNode>) {
  const root = withChildren(block('doc', BlockType.Paragraph), [node])
  return new EditorEngine(root)
}

describe('ListBlockWidget', () => {
  it('view face (unordered + task item): byte-identical to the builtin renderListPanel — inert checkbox, no start attr', async () => {
    const node = listNode(false, true)
    const w = blockNodeToWNode(node)
    const builtin = await ssr(builtinListPanel(panelCtx(w, 'List', () => PARA('v'))))
    const widget = await ssr(h(ListBlockWidget as any, {
      mode: 'view', node, ctx: null, final: true, items: viewItems(w), version: 0,
    }))
    expect(norm(widget)).toBe(norm(builtin))
    expect(widget).toContain('<ul class="list-node list-disc"')
    expect(widget).toContain('task-item')
    expect(widget).toContain('disabled')
    expect(widget).toContain('aria-label="task checkbox"')
    expect(widget).not.toContain('start=')
  })

  it('view face ordered: ol chain, no start attr', async () => {
    const node = listNode(true, null)
    const w = blockNodeToWNode(node)
    const widget = await ssr(h(ListBlockWidget as any, { mode: 'view', node, ctx: null, final: true, items: viewItems(w), version: 0 }))
    expect(widget).toContain('<ol class="list-node list-decimal"')
    expect(widget).not.toContain('task-item')
  })

  it('edit face: LIVE checkbox (click = ONE setBlockAttrs step), start attr, markdown-renderer', async () => {
    const node = listNode(true, false)
    const engine = listEngine(node)
    const items = [{
      id: 'l1-i1', task: true, checked: false, cls: 'list-item task-item',
      children_slot: () => [h('div', { class: 'child-slot', key: 'k' }, '子块')],
    }]
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp({
      render: () => h(ListBlockWidget as any, {
        mode: 'edit', node, ctx: { engine, blockId: 'l1', readonly: false }, final: true, items, version: 1,
      }),
    })
    app.mount(host)
    const box = host.querySelector<HTMLInputElement>('.task-checkbox')!
    expect(box.getAttribute('aria-label')).toBe('toggle task')
    expect(box.disabled).toBe(false)
    expect(host.innerHTML).toContain('start="3"')
    expect(host.innerHTML).toContain('markdown-renderer')
    box.click()
    const found = findBlock(engine.doc, 'l1-i1')!
    expect(attrGetBool(found.attrs, 'checked', false)).toBe(true)
    expect(engine.canUndo).toBe(true)
    engine.undo()
    const after = findBlock(engine.doc, 'l1-i1')!
    expect(attrGetBool(after.attrs, 'checked', false)).toBe(false)
    app.unmount()
    host.remove()
  })
})
