// MermaidBlockWidget (plan 033 T4): the mermaid family's three-mode widget —
// merges the MermaidNodeView (view/stream) and MermaidEditBlock (edit, 031)
// contracts into one chrome. The debounced async preview does not run under
// SSR (Init is onMounted-only), so the SSR contract pins the chrome and the
// empty-source view branch; the tri-state machine itself stays pinned by
// the demo e2e + the ext-bridge unit tests (031 口径).

import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BlockType, leafBlock } from '../../parser/block-model'
import { parse_blocks } from '../../parser/markdown-parser'
import { EditorEngine } from '../engine/editor-engine'
import { panelOf } from '../../render/block-widget'
import { blockNodeToWNode } from '../../render/block-wnode'
import { clearOptionalCapabilities, enableArtifactStore } from '../../render/optional-capabilities'
import MermaidBlockWidget from '../components/MermaidBlockWidget.vue'
import { renderMermaidPreview } from '../ext/mermaid_block_widget_ext'

const MERMAID_MD = '```mermaid\ngraph TD; A-->B;\n```\n'

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

describe('view/stream face: the node-view contract (MermaidNodeView absorbed)', () => {
  it('root chrome: autodown-mermaid-block + data-mermaid-block marker, no edit markers', async () => {
    const node = leafBlock('g1', BlockType.Mermaid, 'graph TD; A-->B;')
    const html = await ssr(h(MermaidBlockWidget as any, { mode: 'view', node, final: true, ctx: null }))
    expect(html).toContain('class="autodown-mermaid-block"')
    expect(html).toMatch(/<div class="autodown-mermaid-block" data-mermaid-block(?:="")?/)
    expect(html).not.toContain('data-block-id')
    expect(html).not.toContain('data-node-type')
  })

  it('SSR first paint: neither preview nor error (Init-less, empty svg sentinel)', async () => {
    const node = leafBlock('g1', BlockType.Mermaid, 'graph TD; A-->B;')
    const html = await ssr(h(MermaidBlockWidget as any, { mode: 'view', node, final: true, ctx: null }))
    expect(html).not.toContain('autodown-mermaid-preview')
    expect(html).not.toContain('autodown-mermaid-error')
    expect(html).toMatch(/<pre class="mermaid-source"[^>]*>\s*<code[^>]*><\/code>/)
  })

  it('panelOf mounts the view face (the panel consumer path)', async () => {
    const node = leafBlock('g1', BlockType.Mermaid, 'graph TD; A-->B;')
    const html = await ssr(panelOf(MermaidBlockWidget)({ node: blockNodeToWNode(node), final: true, budget: undefined, spec: { kind: 'Mermaid' } as any, renderEmbedded: () => h('div'), renderInlineChildren: () => [] }))
    expect(html).toContain('autodown-mermaid-block')
    expect(html).toContain('mermaid-source')
  })

  it('stream face renders byte-identical chrome to view (final only differs)', async () => {
    const node = leafBlock('g1', BlockType.Mermaid, 'graph TD; A-->B;')
    const view = await ssr(h(MermaidBlockWidget as any, { mode: 'view', node, final: true, ctx: null }))
    const stream = await ssr(h(MermaidBlockWidget as any, { mode: 'stream', node, final: false, ctx: null }))
    expect(norm(stream)).toBe(norm(view))
  })
})

describe('edit face: the 031 MermaidEditBlock contract, absorbed', () => {
  it('carries the EDITOR-CONTRACT edit-face selectors + SSR draft + markers', async () => {
    const { engine, node, blockId } = docOf(MERMAID_MD)
    const html = await ssr(h(MermaidBlockWidget as any, { mode: 'edit', node, ctx: { engine, blockId, readonly: false } }))
    expect(html).toContain('class="autodown-mermaid-editor"')
    expect(html).toContain('mermaid-editor-stack')
    expect(html).toContain('mermaid-editor-textarea')
    expect(html).toContain('data-node-type="Mermaid"')
    expect(html).toContain('<textarea')
    // SSR entity-escapes the v-model content — the browser unescapes on
    // parse (same bytes as the old face; the parity test pins it exactly)
    expect(html).toContain('graph TD; A--&gt;B;')
  })

  it('readonly: stream banner + disabled textarea + is-readonly chrome', async () => {
    const { engine, node, blockId } = docOf(MERMAID_MD)
    const html = await ssr(h(MermaidBlockWidget as any, { mode: 'edit', node, ctx: { engine, blockId, readonly: true } }))
    expect(html).toContain('autodown-mermaid-editor is-readonly')
    expect(html).toContain('autodown-stream-banner')
    expect(html).toContain('disabled')
  })
})

describe('artifact final-put (031 enableArtifactStore path carried over)', () => {
  it('renderMermaidPreview records svg finals only (env-settled under node, never both)', async () => {
    const puts: { key: string; artifact: any }[] = []
    enableArtifactStore({
      get: (k: string) => puts.find((p) => p.key === k)?.artifact ?? null,
      put: (k: string, a: any) => puts.push({ key: k, artifact: a }),
    })
    const res = await renderMermaidPreview('graph TD; A-->B;')
    if (res.error === '') {
      expect(puts).toHaveLength(1)
      expect(puts[0].artifact.kind).toBe('svg')
      expect(puts[0].artifact.body).toContain('<svg')
    } else {
      // no DOM under the node runtime — the render error is data, no put
      expect(puts).toHaveLength(0)
      expect(res.svg).toBe('')
    }
  })
})
