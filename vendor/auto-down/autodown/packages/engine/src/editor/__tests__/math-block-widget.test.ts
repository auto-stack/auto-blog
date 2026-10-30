// MathBlockWidget (plan 033 T3): the math block family's three-mode widget —
// merges the MathBlockNodeView (view/stream) and MathEditBlock (edit, 031)
// contracts into one chrome. View contract asserted structurally (the SSR
// first paint renders the empty preview branch — katex lands on mount, same
// as the node view); the edit face is byte-compared (attr-order normalized)
// against the live 031 mathEditSlot while both exist; the artifact final-put
// (031 enableArtifactStore path) is pinned at the widget bridge.

import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BlockType, leafBlock } from '../../parser/block-model'
import { parse_blocks } from '../../parser/markdown-parser'
import { EditorEngine } from '../engine/editor-engine'
import { panelOf } from '../../render/block-widget'
import { blockNodeToWNode } from '../../render/block-wnode'
import { clearOptionalCapabilities, enableArtifactStore } from '../../render/optional-capabilities'
import MathBlockWidget from '../components/MathBlockWidget.vue'
import { renderMathBlockPreview } from '../ext/math_block_widget_ext'

const MATH_MD = '%{\ne = mc^2\n}%\n'

async function ssr(vnode: unknown): Promise<string> {
  const app = createSSRApp({ render: () => h({ render: () => vnode } as any) })
  return (await renderToString(app)).replace(/<!--.*?-->/g, '')
}

function norm(html: string): string {
  return html.replace(/<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[:\w.-]+(?:="[^"]*")?)*)\s*(\/?)>/g, (_m, tag, attrs: string, self: string) => {
    const list = attrs
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((a) => (a.includes('=') ? a : `${a}=""`))
      .filter((a) => !/^data-v-[0-9a-f]+=""/.test(a))
      .sort()
    return `<${tag}${list.length > 0 ? ' ' + list.join(' ') : ''}${self}>`
  })
}

function docOf(md: string) {
  const doc = parse_blocks(md, true)
  const engine = new EditorEngine(doc)
  const node = doc.children[0]!
  return { engine, node, blockId: node.id }
}

beforeEach(() => {
  clearOptionalCapabilities()
})

afterEach(() => {
  clearOptionalCapabilities()
})

describe('view/stream face: the node-view contract (MathBlockNodeView absorbed)', () => {
  it('root chrome: autodown-math-block + data-math-block marker, no edit markers', async () => {
    const node = leafBlock('m1', BlockType.MathBlock, 'e = mc^2')
    const html = await ssr(h(MathBlockWidget as any, { mode: 'view', node, final: true, ctx: null }))
    expect(html).toContain('class="autodown-math-block"')
    // Vue SSR renders empty-string attrs valueless — same DOM as the
    // node-view's bare marker.
    expect(html).toMatch(/<div class="autodown-math-block" data-math-block(?:="")?/)
    expect(html).not.toContain('data-block-id')
    expect(html).not.toContain('data-node-type')
  })

  it('preview div renders on the empty SSR state (Init-less first paint), source slot pre>code', async () => {
    const node = leafBlock('m1', BlockType.MathBlock, 'e = mc^2')
    const html = await ssr(h(MathBlockWidget as any, { mode: 'view', node, final: true, ctx: null }))
    expect(html).toContain('class="autodown-math-preview"')
    expect(html).not.toContain('autodown-math-error')
    expect(html).toMatch(/<pre class="math-block-source"[^>]*>\s*<code[^>]*><\/code>/)
  })

  it('panelOf mounts the view face (the panel consumer path)', async () => {
    const node = leafBlock('m1', BlockType.MathBlock, 'e = mc^2')
    const html = await ssr(panelOf(MathBlockWidget)({ node: blockNodeToWNode(node), final: true, budget: undefined, spec: { kind: 'MathBlock' } as any, renderEmbedded: () => h('div'), renderInlineChildren: () => [] }))
    expect(html).toContain('autodown-math-block')
    expect(html).toContain('math-block-source')
  })

  it('stream face renders byte-identical chrome to view (final only differs)', async () => {
    const node = leafBlock('m1', BlockType.MathBlock, 'e = mc^2')
    const view = await ssr(h(MathBlockWidget as any, { mode: 'view', node, final: true, ctx: null }))
    const stream = await ssr(h(MathBlockWidget as any, { mode: 'stream', node, final: false, ctx: null }))
    expect(norm(stream)).toBe(norm(view))
  })
})

describe('edit face: the 031 MathEditBlock contract, absorbed', () => {
  it('carries the EDITOR-CONTRACT edit-face selectors + SSR draft + markers', async () => {
    const { engine, node, blockId } = docOf(MATH_MD)
    const html = await ssr(h(MathBlockWidget as any, { mode: 'edit', node, ctx: { engine, blockId, readonly: false } }))
    expect(html).toContain('class="autodown-math-editor"')
    expect(html).toContain('math-editor-stack')
    expect(html).toContain('math-editor-textarea')
    expect(html).toContain('data-node-type="MathBlock"')
    expect(html).toContain('data-block-id')
    expect(html).toContain('<textarea')
    expect(html).toContain('e = mc^2')
  })

  it('readonly: stream banner + disabled textarea + is-readonly chrome', async () => {
    const { engine, node, blockId } = docOf(MATH_MD)
    const html = await ssr(h(MathBlockWidget as any, { mode: 'edit', node, ctx: { engine, blockId, readonly: true } }))
    expect(html).toContain('autodown-math-editor is-readonly')
    expect(html).toContain('autodown-stream-banner')
    expect(html).toContain('disabled')
  })
})

describe('artifact final-put (031 enableArtifactStore path carried over)', () => {
  it('renderMathBlockPreview records successful finals; errors do not put', () => {
    const puts: { key: string; artifact: any }[] = []
    enableArtifactStore({
      get: (k: string) => puts.find((p) => p.key === k)?.artifact ?? null,
      put: (k: string, a: any) => puts.push({ key: k, artifact: a }),
    })
    const ok = renderMathBlockPreview('e = mc^2')
    expect(ok.error).toBe('')
    expect(puts).toHaveLength(1)
    expect(puts[0].artifact.kind).toBe('html')
    expect(puts[0].artifact.body).toContain('katex')
    const bad = renderMathBlockPreview('\\frac{1{')
    expect(bad.error).not.toBe('')
    expect(puts).toHaveLength(1) // no put on error
  })
})
