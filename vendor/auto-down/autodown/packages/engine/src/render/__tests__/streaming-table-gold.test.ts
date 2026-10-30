// StreamingTable three-state DOM gold (plan 037 T1 / D2): the byte standard
// the TableBlockWidget's view/stream branches must reproduce after the
// family switch (T3/T5). The snapshots were RECORDED from the dual faces
// (StreamingTable SFC + tablePanel) at T1; the T3 assembly switch swapped
// the subjects below to the widget WITHOUT touching the snapshot bytes —
// that swap is the 渐进语义保形 acceptance (#3):
//
//   · progressive face = the widget's STREAM mode (```json {"type":"table"}
//     component segments): 空 (nullish 兜底 through the normalization) /
//     列头先行 (header-first, loading row) / 全量 final (loading row gone,
//     .final class) — including the missing-key cell fallback
//     (row[col] ?? '');
//   · terminal face = the widget's VIEW mode through the REAL pipe
//     (MarkdownRender → renderNodes → the panel custom slot), the
//     .table-node byte contract with its attribute surface (aria-busy /
//     dir / align classes / resize-handle buttons / embedded
//     markdown-renderer cells), pinned on the tri-state corpus's Table
//     fixtures (same-source with stream-tri-state.test.ts).
//
// norm() strips the SFC scoped-style data-v hashes (different file, same
// DOM — the 033 widget-test idiom) and sorts attributes (Vue emits them in
// prop-declaration order, an implementation detail).

import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import TableBlockWidget from '../../editor/components/TableBlockWidget.vue'
import MarkdownRender from '../MarkdownRender.vue'
import { TRI_STATE } from './fixtures/tri-state'

function norm(html: string): string {
  return html
    .replace(/<!--.*?-->/g, '')
    .replace(
      /<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[:\w.-]+(?:="[^"]*")?)*)\s*(\/?)>/g,
      (_m, tag: string, attrs: string, self: string) => {
        const list = attrs
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((a) => (a.includes('=') ? a : `${a}=""`))
          .filter((a) => !/^data-v-[0-9a-f]+=""/.test(a))
          .sort()
        return `<${tag}${list.length > 0 ? ' ' + list.join(' ') : ''}${self}>`
      },
    )
}

async function ssr(vnode: unknown): Promise<string> {
  const app = createSSRApp({ render: () => h({ render: () => vnode } as any) })
  return norm(await renderToString(app))
}

/** The widget's stream face with the T1-recorded props (the StreamingTable
 *  component's props 1:1 — filler props satisfy the generated required-prop
 *  checks, the 033 ctx:null idiom). */
function streamFace(columns: unknown, rows: unknown, final: boolean): unknown {
  return h(TableBlockWidget as any, {
    mode: 'stream',
    controller: null,
    blockId: '',
    readonly: true,
    final,
    header_cells: [],
    body_rows: [],
    columns,
    rows,
  })
}

describe('progressive face gold — stream mode three states (component segments)', () => {
  it('空: nullish props fall through the normalization to the empty table + loading row', async () => {
    const html = await ssr(streamFace(null, null, false))
    expect(html).toMatchSnapshot('stream-empty')
  })

  it('列头先行: header renders before any row; loading row spans the column count', async () => {
    const html = await ssr(streamFace(['名称', '数量'], [], false))
    expect(html).toMatchSnapshot('stream-header-first')
  })

  it('全量 final: rows in, loading row gone, .final on the root; missing key falls back to empty cell', async () => {
    const html = await ssr(
      streamFace(['名称', '数量'], [{ 名称: '甲', 数量: '一' }, { 名称: '乙' }], true),
    )
    expect(html).toMatchSnapshot('stream-full-final')
  })
})

describe('terminal face gold — the view mode through the real pipe (.table-node contract)', () => {
  async function pipe(content: string, final: boolean): Promise<string> {
    const app = createSSRApp({
      render: () => h(MarkdownRender as any, { content, final, batchRendering: false }),
    })
    return norm((await renderToString(app)).replace(/<!--.*?-->/g, ''))
  }

  it('open (mid-stream): header + first row already in the .table-node contract', async () => {
    const html = await pipe(TRI_STATE.Table.open!, false)
    expect(html).toContain('table-node')
    expect(html).toMatchSnapshot('terminal-open')
  })

  it('closed (final): full table with resize handles and embedded cell renderers', async () => {
    const html = await pipe(TRI_STATE.Table.closed!, true)
    expect(html).toContain('table-node__resize-handle')
    expect(html).toMatchSnapshot('terminal-closed')
  })
})
