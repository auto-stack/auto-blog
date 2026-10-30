// StreamingRenderer :::details contract (follow-up to the details-as-block
// fix): the source-level `:::details` container must render as a native
// collapsible <details> element with a summary row and markdown body — not
// as escaped raw HTML text (the old markstream-vue HTML-string rewrite).

import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import StreamingRenderer from '../StreamingRenderer.vue'

async function render(source: string, streaming: boolean): Promise<string> {
  const app = createSSRApp({
    render: () => h(StreamingRenderer as any, { source, streaming }),
  })
  return renderToString(app)
}

const DOC = [
  '# 标题',
  '',
  ':::details 为什么需要流式分段？',
  '正文第一段，含 **加粗**。',
  ':::',
  '',
  '结尾段落。',
].join('\n')

describe('StreamingRenderer :::details', () => {
  it('renders a closed details block with summary and markdown body', async () => {
    const html = await render(DOC, false)
    expect(html).toContain('<details')
    expect(html).toContain('<summary')
    expect(html).toContain('为什么需要流式分段？')
    expect(html).toContain('details-content')
    expect(html).toContain('<strong')
    // the raw container syntax must not leak as text
    expect(html).not.toContain(':::details')
  })

  it('renders an unclosed details block while streaming', async () => {
    const partial = DOC.slice(0, DOC.indexOf(':::') + 30)
    const html = await render(partial, true)
    expect(html).toContain('<details')
    expect(html).toContain('<summary')
  })

  it('keeps plain markdown segments around the block', async () => {
    const html = await render(DOC, false)
    expect(html).toContain('<h1')
    expect(html).toContain('结尾段落')
  })
})
