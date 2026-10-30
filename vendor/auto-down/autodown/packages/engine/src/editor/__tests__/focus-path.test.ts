// Focus-path assembly (plan 025 P1T2) — deep selection primitives + the
// recursive views assembly. Clicking into a list item / quote paragraph must
// mount a rich text host on the nested leaf while sibling subtrees keep their
// preview rendering (clickable node-slots carrying data-block-id).
//
// plan 034: the host is the generated RichTextHost; its content injects on
// MOUNT (mountHost writes $el.innerHTML), so the two tests that assert the
// focused host's TEXT render client-side (happy-dom) — SSR output still
// carries the full chrome contract, pinned by the remaining SSR tests.

// @vitest-environment happy-dom

import { createApp, createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { parse_blocks } from '../../parser/markdown-parser'
import { BlockNode, BlockType, blockText } from '../../parser/block-model'
import { focusPathOf, focusTargetOf, lastFocusTargetOf } from '../engine/focus-path'
// importing EngineEditor registers the Fence/Table edit faces (module scope)
import EngineEditor from '../components/EngineEditor.vue'

function firstLeafOf(node: BlockNode): BlockNode {
  if (node.children.length === 0) return node
  return firstLeafOf(node.children[0])
}

async function renderEditor(md: string): Promise<string> {
  const app = createSSRApp({ render: () => h(EngineEditor as any, { modelValue: md }) })
  return (await renderToString(app)).replace(/<!--.*?-->/g, '')
}

/** Client-side mount — the RichTextHost content lands via onMounted. */
async function renderEditorClient(md: string): Promise<string> {
  const wrap = document.createElement('div')
  document.body.appendChild(wrap)
  const app = createApp({ render: () => h(EngineEditor as any, { modelValue: md }) })
  app.mount(wrap)
  const html = wrap.innerHTML
  app.unmount()
  wrap.remove()
  return html.replace(/<!--.*?-->/g, '')
}

describe('focus-path primitives', () => {
  it('focusPathOf collects the ancestor chain, excluding root and the leaf', () => {
    const doc = parse_blocks('- one\n  - two\n\ntail', true)
    const list = doc.children[0]
    const item = list.children[0]
    const para = item.children[0]
    const path = focusPathOf(doc, para.id)
    expect(path.has(item.id)).toBe(true)
    expect(path.has(list.id)).toBe(true)
    expect(path.has(para.id)).toBe(false)
    expect(path.has(doc.id)).toBe(false)
    expect(path.size).toBe(2)
  })

  it('focusPathOf is empty for a top-level leaf', () => {
    const doc = parse_blocks('# T\n\nbody', true)
    expect(focusPathOf(doc, doc.children[0].id).size).toBe(0)
    expect(focusPathOf(doc, '').size).toBe(0)
  })

  it('focusTargetOf descends containers to the first editable leaf', () => {
    const doc = parse_blocks('- one\n- two', true)
    const target = focusTargetOf(doc.children[0])!
    expect(target.kind).toBe(BlockType.Paragraph)
    expect(blockText(target)).toBe('one')

    const qdoc = parse_blocks('> quoted', true)
    const qtarget = focusTargetOf(qdoc.children[0])!
    expect(qtarget.kind).toBe(BlockType.Paragraph)
    expect(blockText(qtarget)).toBe('quoted')
  })

  it('Callout/Details descend to their first leaf through the generic recursion (plan 030 T7)', () => {
    const doc = parse_blocks('$callout(type: "note") {\n卡片正文\n}\n', true)
    const callout = doc.children[0]
    const body = callout.children[0]
    expect(focusTargetOf(doc)?.id).toBe(body.id)
    expect(focusPathOf(doc, body.id).has(callout.id)).toBe(true)

    const ddoc = parse_blocks('$details(summary: "s") {\n隐藏正文\n}\n', true)
    const details = ddoc.children[0]
    expect(focusTargetOf(ddoc)?.id).toBe(details.children[0].id)
  })

  it('focusTargetOf stops at registered edit faces (table, not its cell)', () => {
    const doc = parse_blocks('| a | b |\n| --- | --- |\n| c | d |', true)
    const table = doc.children[0]
    expect(table.kind).toBe(BlockType.Table)
    const target = focusTargetOf(table)!
    expect(target.id).toBe(table.id)
  })

  it('lastFocusTargetOf lands on the last deep leaf (Ctrl+End)', () => {
    const doc = parse_blocks('- one\n  - two\n\ntail', true)
    const last = lastFocusTargetOf(doc)!
    expect(last.kind).toBe(BlockType.Paragraph)
    expect(blockText(last)).toBe('tail')

    const qdoc = parse_blocks('> q1\n>\n> q2', true)
    const qlast = lastFocusTargetOf(qdoc.children[0])!
    expect(blockText(qlast)).toBe('q2')
  })
})

describe('focus-path SSR assembly', () => {
  it('a list-first document focuses the first item paragraph in place', async () => {
    const md = '- one\n- two'
    const doc = parse_blocks(md, true)
    const list = doc.children[0]
    const p1 = firstLeafOf(list.children[0])
    const p2 = firstLeafOf(list.children[1])
    const html = await renderEditorClient(md)
    // expanded container chrome: node-slot carrying the LIST id, then ul/li
    expect(html).toContain(`data-block-id="${list.id}"`)
    expect(html).toContain('list-node list-disc')
    expect(html).toContain('list-item')
    expect(html).toContain('markdown-renderer')
    // the focused nested paragraph hosts in place (not preview)
    expect(html).toContain('autodown-block-host')
    expect(html).toContain(`data-block-id="${p1.id}"`)
    expect(html).toContain(blockText(p1))
    // the sibling item stays preview but is deeply addressable
    expect(html).toContain(`data-block-id="${p2.id}"`)
    expect(html).toContain('paragraph-node')
  })

  it('a quote-first document expands the blockquote around the host', async () => {
    const md = '> quoted line'
    const doc = parse_blocks(md, true)
    const quote = doc.children[0]
    const p1 = firstLeafOf(quote)
    const html = await renderEditorClient(md)
    expect(html).toContain(`data-block-id="${quote.id}"`)
    expect(html).toContain('blockquote')
    expect(html).toContain('autodown-block-host')
    expect(html).toContain(`data-block-id="${p1.id}"`)
    expect(html).toContain('quoted line')
  })

  it('top-level leaf documents render exactly as before (baseline)', async () => {
    const md = '# Title\n\nbody text'
    const doc = parse_blocks(md, true)
    const body = doc.children[1]
    const html = await renderEditor(md)
    expect(html).toContain('autodown-block-host')
    expect(html).toContain('data-node-type="Heading"')
    expect(html).toContain(`data-block-id="${body.id}"`)
    expect(html).toContain('paragraph-node')
    expect(html).toContain('autodown-block-boundary')
  })

  it('unfocused containers stay full preview (no host inside)', async () => {
    const md = '# Title\n\n- one\n- two'
    const html = await renderEditor(md)
    // focus is the heading; the list below renders as a plain preview subtree
    expect(html).toContain('list-node')
    expect(html).toContain('paragraph-node')
    const hostCount = html.split('autodown-block-host').length - 1
    expect(hostCount).toBe(1)
  })
})
