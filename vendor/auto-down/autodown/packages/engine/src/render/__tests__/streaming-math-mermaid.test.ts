// Stream-safety tri-state fixtures (plan 031 D7 / P3): the progressive
// states of math/mermaid sources under StreamingRenderer, pinned so the
// 030 stream machinery stays dead-locked while the 031 edit faces land on
// top. The three states:
//   1. unclosed %{            -> paragraph literal (source as plain text)
//   2. open ```mermaid fence  -> code-shaped loading state, NO mermaid
//      render (the source is necessarily incomplete until the fence closes)
//   3. closed %{ }% / fence   -> MathBlock / Mermaid kind (node-view panels)
// Asserted: no crash in any state, no mermaid/svg render while open, and
// the closed states resolve the block kinds (panels registered by the
// EngineEditor assembly — imported for its module-scope registrations).

import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import StreamingRenderer from '../StreamingRenderer.vue'
import EngineEditor from '../../editor/components/EngineEditor.vue'

void EngineEditor // module-scope panel + edit-slot registrations

async function render(source: string, streaming: boolean): Promise<string> {
  const app = createSSRApp({
    render: () => h(StreamingRenderer as any, { source, streaming }),
  })
  return (await renderToString(app)).replace(/<!--.*?-->/g, '')
}

describe('math/mermaid progressive tri-state (030 stream machinery, 031 钉死)', () => {
  it('unclosed %{ degrades to a paragraph literal — no math panel, no crash', async () => {
    const html = await render('前文\n\n%{\ne = mc^2', true)
    expect(html).toContain('e = mc^2')
    expect(html).not.toContain('autodown-math-block')
    expect(html).not.toContain('katex')
  })

  it('open ```mermaid fence stays a code-shaped loading state — never renders mermaid', async () => {
    const html = await render('```mermaid\ngraph TD;\n  A --> B', true)
    // the partial source is visible as text, but no mermaid panel/svg may
    // exist while the fence is open (source incomplete)
    expect(html).toContain('graph TD;')
    expect(html).not.toContain('autodown-mermaid-block')
    expect(html).not.toContain('<svg')
  })

  it('closed %{ }% resolves the MathBlock kind (panel mounted; katex paints on mount)', async () => {
    const html = await render('%{\ne = mc^2\n}%', false)
    expect(html).toContain('autodown-math-block')
    // renderKatexPreview runs in the widget's Init (onMounted — not under
    // SSR) and the source pre is the NodeViewContent hole (empty in static
    // render — EngineEditor registers the math panel with no embedded
    // body); the panel chrome is the SSR-visible contract, the painted
    // katex html is pinned by the demo e2e (mounted browser)
    expect(html).toContain('math-block-source')
  })

  it('closed ```mermaid fence resolves the Mermaid kind (svg async, panel mounted)', async () => {
    const html = await render('```mermaid\ngraph TD; A-->B;\n```', false)
    expect(html).toContain('autodown-mermaid-block')
    // mermaid.render is async — SSR shows the panel chrome, not the svg
    expect(html).toContain('mermaid-source')
  })
})
