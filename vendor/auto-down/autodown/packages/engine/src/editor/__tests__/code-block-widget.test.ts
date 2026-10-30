// CodeBlockWidget (plan 033 T2/T6): the fence family's three-mode widget —
// the ONLY face of the code block kind now (renderCodeblockPanel /
// CodeEditorBlock retired). The view contract below mirrors render.test's
// frozen assertions (that file stays zero-change and exercises the widget
// through the panel custom slot); this suite pins the widget directly:
// view/stream chrome, the 032 skeleton family, the CodeBlockMenu host
// contract in edit mode, and the stream≡view chrome invariant.

import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BlockType, Value, attrSet, leafBlock } from '../../parser/block-model'
import { codeNode } from '../../parser/markdown-parser'
import { parse_blocks } from '../../parser/markdown-parser'
import { EditorEngine } from '../engine/editor-engine'
import { panelOf } from '../../render/block-widget'
import { clearOptionalCapabilities } from '../../render/optional-capabilities'
import CodeBlockWidget from '../components/CodeBlockWidget.vue'

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

function ctxOf(w: unknown, final = true) {
  return {
    node: w as any,
    final,
    budget: undefined,
    spec: { kind: 'Codeblock' } as any,
    renderEmbedded: () => h('div'),
    renderInlineChildren: () => [] as any[],
  }
}

function fenceNode(language: string, code: string, loading = false) {
  let node = leafBlock('f1', BlockType.Fence, code)
  node = { ...node, attrs: attrSet(node.attrs, 'language', Value.Str(language)) }
  if (loading) node = { ...node, attrs: attrSet(node.attrs, 'loading', Value.Bool(true)) }
  return node
}

beforeEach(() => {
  clearOptionalCapabilities()
})

afterEach(() => {
  clearOptionalCapabilities()
})

describe('view face: the retired renderCodeblockPanel contract, absorbed', () => {
  it('closed fence: container chain, header, pre[data-language] > code (render.test regex shape)', async () => {
    const html = await ssr(panelOf(CodeBlockWidget)(ctxOf(codeNode('rust', 'fn a() {}\n', false))))
    expect(html).toContain('class="code-block-container rounded-lg border"')
    expect(html).toContain('class="code-block-header flex justify-between items-center"')
    expect(html).toContain('class="code-header-title"')
    expect(html).toMatch(/<pre[^>]*data-language="rust"[^>]*><code[^>]*>fn a\(\) \{\}\n<\/code>/)
    expect(html).toContain('aria-busy="false"')
  })

  it('fence without language: pre falls back to the text language class', async () => {
    const html = await ssr(panelOf(CodeBlockWidget)(ctxOf(codeNode('', 'plain\n', false))))
    expect(html).toContain('class="language-text code-pre-fallback is-wrap"')
    expect(html).toContain('aria-busy="false"')
  })

  it('empty code body renders an empty code element', async () => {
    const html = await ssr(panelOf(CodeBlockWidget)(ctxOf(codeNode('js', '', false))))
    expect(html).toMatch(/<code[^>]*><\/code>/)
  })

  it('open fence: the 032 skeleton family + aria-busy', async () => {
    const html = await ssr(panelOf(CodeBlockWidget)(ctxOf(codeNode('rust', 'fn a() {', true))))
    expect(html).toContain('class="code-block-container rounded-lg border autodown-block-placeholder is-loading"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('fn a() {')
  })
})

describe('stream face: same chrome as view (chrome 单份)', () => {
  it('mode stream renders byte-identical to mode view (final only differs)', async () => {
    const node = fenceNode('rust', 'fn a() {}\n')
    const view = await ssr(h(CodeBlockWidget as any, { mode: 'view', node, final: true, ctx: null }))
    const stream = await ssr(h(CodeBlockWidget as any, { mode: 'stream', node, final: false, ctx: null }))
    expect(norm(stream)).toBe(norm(view))
  })

  it('stream open-fence skeleton: the 032 is-loading family via node attrs', async () => {
    const node = fenceNode('rust', 'fn a() {', true)
    const stream = await ssr(h(CodeBlockWidget as any, { mode: 'stream', node, final: false, ctx: null }))
    expect(stream).toContain('autodown-block-placeholder is-loading')
    expect(stream).toContain('aria-busy="true"')
  })
})

describe('edit face: the CodeEditorBlock + badge host contract, absorbed', () => {
  function docOf(md: string) {
    const doc = parse_blocks(md, true)
    const engine = new EditorEngine(doc)
    const node = doc.children[0]!
    return { engine, node, blockId: node.id }
  }

  it('carries the CodeBlockMenu host contract: container root + in-header trigger + textarea + blur wiring', async () => {
    const { engine, node, blockId } = docOf('```rust\nfn a() {}\n```')
    const html = await ssr(h(CodeBlockWidget as any, { mode: 'edit', node, ctx: { engine, blockId, readonly: false } }))
    // plan 039 T7: the edit face merges the view container chrome with the
    // menu host anchor class — one chrome, three modes
    expect(html).toContain('class="code-block-container rounded-lg border autodown-codeblock-node"')
    expect(html).toContain('data-language="rust"')
    // the language affordance lives IN the title bar; the outside badge is
    // gone (only the header trigger carries the menu marker)
    expect(html).toContain('data-codeblock-language-badge')
    expect(html).toContain('title="切换语言"')
    expect(html).toContain('code-header-trigger')
    expect(html).toContain('code-header-caret')
    expect(html).not.toContain('autodown-codeblock-language-badge')
    expect(html).toContain('class="autodown-code-editor"')
    expect(html).toContain('data-node-type="Fence"')
    expect(html).toContain('code-editor-highlight')
    expect(html).toContain('<textarea')
    expect(html).toContain('fn a() {}')
  })

  it('readonly: stream banner + disabled textarea (031 idiom carried over)', async () => {
    const { engine, node, blockId } = docOf('```rust\nx\n```')
    const html = await ssr(h(CodeBlockWidget as any, { mode: 'edit', node, ctx: { engine, blockId, readonly: true } }))
    expect(html).toContain('autodown-stream-banner')
    expect(html).toContain('disabled')
    expect(html).toContain('is-readonly')
  })
})
