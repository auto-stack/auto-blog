// Render tests for the self-hosted MarkdownRender (plan 008, Phase 3):
// DOM-structure contract (node-slot/node-content wrappers, data-node-type,
// pre[data-language], table-node, embedded markdown-renderer) that the
// downstream chrome (scroll sync, code-header injection, CSS overrides)
// depends on, plus the optional-capability degradation path (goal 3).

import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import MarkdownRender from '../MarkdownRender.vue'
import {
  clearOptionalCapabilities,
  enableKatex,
  enableHighlight,
  isCapabilityEnabled,
} from '../optional-capabilities'

async function render(content: string, final = true): Promise<string> {
  const app = createSSRApp({
    render: () => h(MarkdownRender as any, { content, final, batchRendering: false }),
  })
  return renderToString(app)
}

function clean(html: string): string {
  return html.replace(/<!--.*?-->/g, '')
}

describe('MarkdownRender DOM contract', () => {
  it('wraps top-level blocks in node-slot/node-content with data-node-type', async () => {
    const html = clean(await render('# Title\n\npara'))
    expect(html).toContain('class="node-slot"')
    expect(html).toContain('data-node-type="heading"')
    expect(html).toContain('data-node-type="paragraph"')
    expect(html).toContain('class="node-content"')
    expect(html).toContain('<h1 class="heading-node heading-1"')
    expect(html).toContain('class="paragraph-node"')
    expect(html).toContain('class="whitespace-pre-wrap break-words text-node"')
  })

  it('renders inline marks with the legacy classes', async () => {
    const html = clean(await render('a **b** *c* `d` ~~e~~ [f](https://x.com)'))
    expect(html).toContain('<strong class="strong-node"')
    expect(html).toContain('<em class="emphasis-node"')
    expect(html).toContain('<code class="inline-code"')
    expect(html).toContain('<del class="strikethrough-node"')
    expect(html).toContain('<a class="link-node"')
    expect(html).toContain('href="https://x.com"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('renders code blocks with pre[data-language] > code', async () => {
    const html = clean(await render('```rust\nfn a() {}\n```'))
    expect(html).toContain('class="code-block-container')
    expect(html).toContain('class="code-block-header')
    expect(html).toContain('data-language="rust"')
    expect(html).toMatch(/<pre[^>]*data-language="rust"[^>]*><code[^>]*>fn a\(\) \{\}\n<\/code>/)
  })

  it('renders tables with table-node and inline cell flow (musk plan 072)', async () => {
    const html = clean(
      await render('| a | b |\n| --- | --- |\n| `1` | 2 |'),
    )
    expect(html).toContain('<table class="table-node"')
    expect(html).toContain('class="table-node__resize-handle"')
    expect(html).toContain('>a<')
    // cells are parseInline output: inline vnodes flow DIRECTLY inside the
    // td — no node-slot wrappers (they stacked vertically), no unknown-node
    // degrade (it printed the bare `inline_code` type name)
    expect(html).toContain('data-node-type="table"')
    expect(html).not.toContain('data-node-type="inline_code"')
    expect(html).toContain('<code class="inline-code"><span>1</span></code>')
  })

  it('renders lists and blockquotes with embedded markdown-renderer', async () => {
    const html = clean(await render('- a\n- b\n\n> q'))
    expect(html).toContain('<ul class="list-node list-disc"')
    expect(html).toContain('class="list-item"')
    expect(html).toContain('<blockquote class="blockquote"')
    // the embedded renderer class appears for nested content (root class
    // dropped its legacy markstream-vue segment in plan 017 Phase 3)
    const matches = html.match(/"markdown-renderer"/g)
    expect(matches!.length).toBeGreaterThanOrEqual(3)
  })

  it('renders ordered lists as ol with start', async () => {
    const html = clean(await render('3. x\n4. y'))
    expect(html).toContain('<ol class="list-node list-decimal"')
  })

  it('renders images inside image-node-container', async () => {
    const html = clean(await render('![alt](u.png)'))
    expect(html).toContain('class="image-node-container"')
    expect(html).toContain('src="u.png"')
    expect(html).toContain('alt="alt"')
  })

  it('renders thematic breaks', async () => {
    const html = clean(await render('a\n\n---\n\nb'))
    expect(html).toContain('<hr class="hr-node"')
  })

  it('renders the streaming state (unclosed fence stays a code block)', async () => {
    const html = clean(await render('```rust\nfn a() {', false))
    expect(html).toContain('data-language="rust"')
    expect(html).toContain('fn a() {')
  })
})

describe('extension block panels (plan 030 T6)', () => {
  it('renders $callout as a callout card — no unknown-node degrade', async () => {
    const html = clean(await render('$callout(type: "warning", title: "注意") {\n正文段落\n}\n'))
    expect(html).toContain('callout-node')
    expect(html).toContain('autodown-callout-warning')
    expect(html).toContain('data-callout-type="warning"')
    expect(html).toContain('autodown-callout-header')
    expect(html).toContain('autodown-callout-icon-warning')
    expect(html).toContain('autodown-callout-title')
    expect(html).toContain('注意')
    expect(html).toContain('autodown-callout-content')
    expect(html).toContain('正文段落')
    expect(html).not.toContain('unknown-node')
  })

  it('callout title falls back to the type label when empty; unknown type drops the icon', async () => {
    const html = clean(await render('$callout(type: "note") {\nx\n}\n'))
    expect(html).toContain('autodown-callout-icon-note')
    expect(html).toMatch(/autodown-callout-title[^>]*>note</)
    const exotic = clean(await render('$callout(type: "custom") {\ny\n}\n'))
    expect(exotic).toContain('autodown-callout-custom')
    expect(exotic).not.toContain('autodown-callout-icon-custom')
  })

  it('task items render inert checkboxes; plain items render none', async () => {
    const html = clean(await render('- [ ] a\n- [x] b\n- c\n'))
    const boxes = html.split('<input').slice(1)
    expect(boxes).toHaveLength(2)
    const firstTag = boxes[0].slice(0, boxes[0].indexOf('>'))
    const secondTag = boxes[1].slice(0, boxes[1].indexOf('>'))
    expect(firstTag).toContain('type="checkbox"')
    expect(firstTag).toContain('disabled')
    expect(firstTag).not.toContain('checked')
    expect(secondTag).toContain('type="checkbox"')
    expect(secondTag).toContain('disabled')
    expect(secondTag).toContain('checked')
    expect(html).toContain('task-item')
    expect(html).toContain('<li class="list-item"')
    expect(html).toContain('<span>a</span>')
    expect(html).toContain('<span>c</span>')
  })
})

describe('optional capabilities (plan 008 goal 3)', () => {
  it('library works with no katex/mermaid/highlight registered (degraded path)', async () => {
    clearOptionalCapabilities()
    expect(isCapabilityEnabled('katex')).toBe(false)
    expect(isCapabilityEnabled('mermaid')).toBe(false)
    expect(isCapabilityEnabled('highlight')).toBe(false)
    // a full document still renders without any heavy capability present
    const html = clean(await render('# T\n\n```js\ncode\n```\n\n- a\n\n| h |\n| --- |\n| 1 |'))
    expect(html).toContain('data-node-type="heading"')
    expect(html).toContain('data-language="js"')
  })

  it('registration flips the capability flags', () => {
    clearOptionalCapabilities()
    enableKatex()
    expect(isCapabilityEnabled('katex')).toBe(true)
    enableHighlight(() => undefined)
    expect(isCapabilityEnabled('highlight')).toBe(true)
    clearOptionalCapabilities()
    expect(isCapabilityEnabled('katex')).toBe(false)
  })
})
