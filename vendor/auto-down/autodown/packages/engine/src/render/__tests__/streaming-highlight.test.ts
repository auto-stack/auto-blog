// StreamingRenderer code-highlight regression: highlighting must live at the
// VNode level (codeblock panel, `highlight` capability) so it survives the
// streaming re-renders that wipe DOM post-process spans while their
// data-highlighted guard survives.
//
// Note: StreamingRenderer registers enableHighlight() in <script setup>, so
// the capability is on for every instance by first render; MarkdownRender
// does not self-register and is used here for the degraded path.

import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import StreamingRenderer from '../StreamingRenderer.vue'
import MarkdownRender from '../MarkdownRender.vue'
import {
  clearOptionalCapabilities,
  enableHighlight,
  isCapabilityEnabled,
} from '../optional-capabilities'
import { getHighlightImpl, setHighlightImpl } from '../highlight'
import { lowlightHighlighter } from '../highlight-lowlight'

async function renderStreaming(source: string): Promise<string> {
  const app = createSSRApp({
    render: () => h(StreamingRenderer as any, { source, streaming: false }),
  })
  return renderToString(app)
}

async function renderMarkdown(content: string): Promise<string> {
  const app = createSSRApp({
    render: () => h(MarkdownRender as any, { content, final: true, batchRendering: false }),
  })
  return renderToString(app)
}

const DOC = ['```ts', "import { x } from 'some-module'", 'const n = 42', '```'].join('\n')

describe('StreamingRenderer code highlight', () => {
  it('registers the highlight capability during component setup', async () => {
    await renderStreaming(DOC)
    expect(isCapabilityEnabled('highlight')).toBe(true)
  })

  it('emits lowlight tokens and the data-highlighted marker for known languages', async () => {
    const html = await renderStreaming(DOC)
    expect(html).toContain('data-language="ts"')
    expect(html).toContain('data-highlighted="ts"')
    expect(html).toMatch(/hljs-(keyword|string|number)/)
  })

  it('falls back to plain code for unknown languages', async () => {
    const html = await renderStreaming('```notalang\nhello\n```')
    expect(html).toContain('data-language="notalang"')
    expect(html).not.toContain('data-highlighted')
    expect(html).toContain('hello')
  })

  it('degrades to plain code when the capability is cleared (MarkdownRender)', async () => {
    clearOptionalCapabilities()
    try {
      const html = await renderMarkdown(DOC)
      expect(html).toContain('data-language="ts"')
      expect(html).not.toContain('data-highlighted')
      expect(html).not.toMatch(/hljs-/)
    } finally {
      enableHighlight()
    }
  })

  it('prefers a platform-registered impl over the lowlight default (VM bridge)', async () => {
    const calls: string[] = []
    enableHighlight((code, language) => {
      calls.push(language)
      return `<em data-vm-highlight>${language}:${code.trim()}</em>`
    })
    try {
      const html = await renderStreaming(DOC)
      expect(calls).toContain('ts')
      expect(html).toContain('data-vm-highlight')
      expect(html).not.toMatch(/hljs-/)
    } finally {
      // restore the Vue default binding
      setHighlightImpl(null)
    }
    expect(getHighlightImpl()).toBe(null)
  })

  it('falls back to the lowlight default when no impl is bound', () => {
    enableHighlight()
    expect(getHighlightImpl()).toBe(null)
    expect(lowlightHighlighter("const x = 's'", 'ts')).toMatch(/hljs-string/)
  })
})
