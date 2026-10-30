// BlockComponent stream-slot mechanism contract (plan 032 T7 / D5) —
// complements streaming-component-slot.test.ts (023 routing tests) with the
// slot-call semantics: registration wins over the builtin streaming path for
// that kind's segments, the slot receives the render-model payload shape
// (component props with "type" stripped, or the details part itself) plus the
// final flag, final flips with the streaming flag (segment closure for
// component parts, !streaming for details parts), and clearBlockComponents()
// tears down cleanly — the details builtin resumes; the table segment has
// no builtin since plan 042 T3 (the family slot is registered, not built in).

import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { afterEach, describe, expect, it } from 'vitest'
import StreamingRenderer from '../StreamingRenderer.vue'
import { clearBlockComponents, registerBlockComponent } from '../block-component'

async function render(source: string, streaming: boolean): Promise<string> {
  const app = createSSRApp({
    render: () => h(StreamingRenderer as any, { source, streaming }),
  })
  return (await renderToString(app)).replace(/<!--.*?-->/g, '')
}

afterEach(() => {
  clearBlockComponents()
})

const TABLE_JSON = '```json\n{"type":"table","columns":["A","B"],"rows":[{"A":"1","B":"2"}]}\n```'
const TABLE_JSON_UNCLOSED = '```json\n{"type":"table","columns":["A","B"],"rows":[{"A":"1"'

describe('stream slot mechanism (plan 032 D5)', () => {
  it('component segment: the slot wins over the builtin registry and receives (props, final)', async () => {
    const seen: { node: any; final: boolean }[] = []
    registerBlockComponent('table', {
      stream: (node: any, final: boolean) => {
        seen.push({ node, final })
        return h('div', { class: 'mock-stream-slot' }, `final:${final}`)
      },
    })
    const html = await render(TABLE_JSON, true)
    // registered slot replaces the builtin StreamingTable branch entirely
    expect(html).toContain('mock-stream-slot')
    expect(html).not.toContain('streaming-table')
    // payload shape: the component segment's props — "type" stripped by the
    // segmentation (rest-destructure), columns/rows carried through
    expect(seen).toHaveLength(1)
    expect(seen[0].node.columns).toEqual(['A', 'B'])
    expect(seen[0].node.rows).toEqual([{ A: '1', B: '2' }])
    expect(seen[0].node.type).toBeUndefined()
    // closed json block while streaming -> segment final = valid && closed
    expect(seen[0].final).toBe(true)
  })

  it('component segment: final stays false while the json block is unclosed', async () => {
    const finals: boolean[] = []
    registerBlockComponent('table', {
      stream: (_node: any, final: boolean) => {
        finals.push(final)
        return h('div', { class: 'mock-stream-slot' }, 'x')
      },
    })
    await render(TABLE_JSON_UNCLOSED, true)
    expect(finals).toEqual([false])
  })

  it('details part: final follows the streaming flag (!streaming)', async () => {
    const finals: boolean[] = []
    registerBlockComponent('details', {
      stream: (node: any, final: boolean) => {
        finals.push(final)
        // details parts pass the part itself: summary/body/closed ride it
        return h('div', { class: 'mock-stream-slot' }, String(node.summary))
      },
    })
    await render(':::details 摘要\n正文\n:::', true)
    await render(':::details 摘要\n正文\n:::', false)
    expect(finals).toEqual([false, true])
  })

  it('clearBlockComponents() tears down: details builtin resumes, table has none', async () => {
    registerBlockComponent('table', {
      stream: () => h('div', { class: 'mock-stream-slot' }, 't'),
    })
    registerBlockComponent('details', {
      stream: () => h('div', { class: 'mock-stream-slot' }, 'd'),
    })
    const withSlots = await render(`${TABLE_JSON}\n\n:::details 摘要\n正文\n:::`, true)
    expect(withSlots).toContain('mock-stream-slot')

    clearBlockComponents()

    const afterTeardown = await render(`${TABLE_JSON}\n\n:::details 摘要\n正文\n:::`, true)
    expect(afterTeardown).not.toContain('mock-stream-slot')
    // plan 042 T3: the json table segment has NO builtin anymore — the
    // retired StreamingTableFace was it (the face is the family stream
    // registration, wiped here), so the segment renders nothing; the
    // native <details> element stays a builtin
    expect(afterTeardown).not.toContain('streaming-table')
    expect(afterTeardown).toContain('<details')
  })
})
