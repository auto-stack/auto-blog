// StreamingRenderer ↔ BlockComponent stream-slot routing (plan 023 P2T1):
// a registered stream slot takes over its kind's streaming part. Plan 042
// T3 revision: the ```json table segment's face is now a REGISTRATION (the
// render-side tableStreamFace family slot in block-widget-panels), not a
// StreamingRenderer builtin — cleared, the segment renders nothing; the
// native <details> branch remains a true builtin.

import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { afterEach, describe, expect, it } from 'vitest'
import StreamingRenderer from '../StreamingRenderer.vue'
import { clearBlockComponents, registerBlockComponent } from '../block-component'

async function render(source: string, streaming: boolean): Promise<string> {
  const app = createSSRApp({
    render: () => h(StreamingRenderer as any, { source, streaming }),
  })
  return renderToString(app)
}

afterEach(() => {
  clearBlockComponents()
})

describe('stream slot routing', () => {
  it('a registered table stream slot replaces the builtin StreamingTable part', async () => {
    let seen: { node: any; final: boolean } | null = null
    registerBlockComponent('table', {
      stream: (node: any, final: boolean) => {
        seen = { node, final }
        return h('div', { class: 'custom-table-stream' }, `cols:${node.columns?.length}`)
      },
    })
    // component segments come from ```json fenced component blocks (the
    // streaming protocol), not markdown tables
    const src = '前文\n\n```json\n{"type":"table","columns":["A","B"],"rows":[{"A":"1","B":"2"}]}\n```\n\n后文'
    const html = await render(src, true)
    expect(html).toContain('custom-table-stream')
    expect(html).toContain('cols:2')
    expect(seen).toBeTruthy()
    expect(seen!.final).toBe(true)
  })

  it('a registered details stream slot replaces the native <details> branch', async () => {
    registerBlockComponent('details', {
      stream: (node: any) => h('div', { class: 'custom-details-stream' }, node.summary),
    })
    const html = await render(':::details 摘要\n正文\n:::', false)
    expect(html).toContain('custom-details-stream')
    expect(html).toContain('摘要')
    expect(html).not.toContain('<details')
  })

  it('markdown segments never resolve a stream slot', async () => {
    registerBlockComponent('markdown', {
      stream: () => h('div', { class: 'should-not-appear' }),
    })
    const html = await render('# 标题\n\n段落', false)
    expect(html).not.toContain('should-not-appear')
    expect(html).toContain('<h1')
  })

  it('the table path is a registration (no builtin fallback); details keeps its native builtin', async () => {
    const src = '```json\n{"type":"table","columns":["A"],"rows":[{"A":"1"}]}\n```'
    registerBlockComponent('table', {
      stream: () => h('div', { class: 'mock-stream-slot' }, 't'),
    })
    const withSlot = await render(src, true)
    expect(withSlot).toContain('mock-stream-slot')
    clearBlockComponents()
    // plan 042 T3: no builtin table path remains — the retired local
    // StreamingTableFace WAS the builtin; the face is a registration now
    // (StreamingRenderer module scope, wiped here), so a cleared registry
    // renders the segment as nothing
    const afterTeardown = await render(src, true)
    expect(afterTeardown).not.toContain('mock-stream-slot')
    expect(afterTeardown).not.toContain('streaming-table')
    // the native <details> branch remains a true builtin
    const details = await render(':::details 摘要\n正文\n:::', false)
    expect(details).toContain('<details')
  })
})
