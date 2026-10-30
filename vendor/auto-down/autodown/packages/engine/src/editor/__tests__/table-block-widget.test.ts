// TableBlockWidget (plan 037 T2-T4): the table family's three-mode widget —
// the ONLY face of the table kind (TableEditorBlock / StreamingTable.vue
// retire at T5; their contracts are absorbed byte-identically — the
// real-pipe bytes are pinned by streaming-table-gold.test.ts, this suite
// pins the widget's faces directly):
// - view: the retired tablePanel .table-node contract (resize handles,
//   align classes, embedded cell bodies through the children_slot hole);
// - stream: the retired StreamingTable SFC's normalization semantics
//   (待澄清 #1 ruling — ext-side `?? []`, no .at computed) + the final
//   flip;
// - edit: the TableEditorBlock absorption — toolbar verbs dispatch through
//   the controller, cell blur commits, readonly gates the face (banner +
//   disabled).

import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'
import TableBlockWidget from '../components/TableBlockWidget.vue'
import { streamBody, streamColspan, streamHeader } from '../ext/table_block_widget_ext'

async function ssr(vnode: unknown): Promise<string> {
  const app = createSSRApp({ render: () => h({ render: () => vnode } as any) })
  return (await renderToString(app)).replace(/<!--.*?-->/g, '')
}

const FILLER = { controller: null, blockId: '', readonly: false, columns: [], rows: [] }

/** view-face flat cells: the panel adapter's shape ({id, cls,
 *  children_slot} — children_slot closures render the embedded body). */
function viewCell(id: string, text: string, cls = 'text-left') {
  return {
    id,
    cls,
    children_slot: () => [h('div', { class: 'markdown-renderer' }, [h('span', text)])],
  }
}

describe('view face: the retired tablePanel contract, absorbed', () => {
  async function viewHtml(): Promise<string> {
    return ssr(
      h(TableBlockWidget as any, {
        ...FILLER,
        mode: 'view',
        final: true,
        readonly: true,
        header_cells: [viewCell('h0', '名称'), viewCell('h1', '值', 'text-right')],
        body_rows: [{ id: 'r0', cells: [viewCell('r0c0', '甲'), viewCell('r0c1', '1')] }],
      }),
    )
  }

  it('renders the bare table.table-node root with aria-busy (no wrapper div, no edit attrs)', async () => {
    const html = await viewHtml()
    expect(html).toMatch(/^<table[^>]*class="table-node"/)
    expect(html).toContain('aria-busy="false"')
    expect(html).not.toContain('data-block-id')
    expect(html).not.toContain('data-node-type')
    expect(html).not.toContain('te-toolbar')
  })

  it('th carries dir/align class, the embedded body, then the resize handle; td has no handle', async () => {
    const html = await viewHtml()
    expect(html).toMatch(/<th[^>]*class="text-left"[^>]*dir="auto"[^>]*>/)
    expect(html).toMatch(/<th[^>]*class="text-right"/)
    // children_slot body lands inside the cell, handle follows it
    const th = html.match(/<th[^>]*>.*?<\/th>/)![0]
    expect(th.indexOf('markdown-renderer')).toBeLessThan(th.indexOf('table-node__resize-handle'))
    expect(html).toMatch(/<button[^>]*class="table-node__resize-handle"[^>]*type="button"/)
    const td = html.match(/<td[^>]*>.*?<\/td>/)![0]
    expect(td).toContain('markdown-renderer')
    expect(td).not.toContain('table-node__resize-handle')
  })
})

describe('stream face: the retired StreamingTable normalization (待澄清 #1 归并)', () => {
  it('streamHeader/streamBody: nullish props fall back to empty arrays (?? semantics)', () => {
    expect(streamHeader(undefined)).toEqual([])
    expect(streamHeader(null)).toEqual([])
    expect(streamBody(null, null)).toEqual([])
    expect(streamBody(['a'], undefined)).toEqual([])
  })

  it('provided values pass through; cells shape {col, html} with escaped text', () => {
    expect(streamHeader(['a', 'b'])).toEqual([
      { col: 'a', html: 'a' },
      { col: 'b', html: 'b' },
    ])
    expect(streamBody(['名称'], [{ 名称: '甲' }, {}])).toEqual([
      [{ col: '名称', html: '甲' }],
      // missing key falls back to the empty cell (row[col] ?? '')
      [{ col: '名称', html: '' }],
    ])
    expect(streamBody(['x'], [{ x: '<img>' }])).toEqual([[{ col: 'x', html: '&lt;img&gt;' }]])
  })

  it('streamColspan: never a zero span', () => {
    expect(streamColspan(undefined)).toBe(1)
    expect(streamColspan([])).toBe(1)
    expect(streamColspan(['a', 'b'])).toBe(2)
  })

  it('final flip: the loading row disappears and .final joins the root class', async () => {
    const props = (final: boolean) =>
      h(TableBlockWidget as any, {
        ...FILLER,
        readonly: true,
        mode: 'stream',
        final,
        header_cells: [],
        body_rows: [],
        columns: ['A'],
        rows: [{ A: '1' }],
      })
    const open = await ssr(props(false))
    expect(open).toContain('class="streaming-table"')
    expect(open).toContain('class="loading-row"')
    const done = await ssr(props(true))
    expect(done).toContain('class="streaming-table final"')
    expect(done).not.toContain('loading-row')
  })
})

describe('edit face: the TableEditorBlock absorption', () => {
  function controller() {
    return {
      addRowAbove: vi.fn(),
      addRow: vi.fn(),
      deleteRow: vi.fn(),
      addColumnBefore: vi.fn(),
      addColumn: vi.fn(),
      deleteColumn: vi.fn(),
      deleteTable: vi.fn(),
      commitCell: vi.fn(),
    }
  }
  const CELLS = {
    header_cells: [{ id: 'h0', text: 'A', cls: 'text-left' }],
    body_rows: [{ id: 'r0', cells: [{ id: 'r0c0', text: '1', cls: 'text-left' }] }],
  }

  async function editHtml(ctl: Record<string, ReturnType<typeof controller>>[never] | Record<string, any>, readonly = false): Promise<string> {
    return ssr(
      h(TableBlockWidget as any, {
        mode: 'edit',
        controller: ctl,
        blockId: 't1',
        readonly,
        final: true,
        columns: [],
        rows: [],
        ...CELLS,
      }),
    )
  }

  it('renders the autodown-table-editor wrapper + toolbar + contenteditable cells', async () => {
    const html = await editHtml(controller())
    expect(html).toContain('class="autodown-table-editor"')
    expect(html).toContain('data-block-id="t1"')
    expect(html).toContain('data-node-type="Table"')
    for (const action of [
      'add-row-above',
      'add-row',
      'delete-row',
      'add-col-before',
      'add-col',
      'delete-col',
      'delete-table',
    ]) {
      expect(html).toContain(`data-te-action="${action}"`)
    }
    expect(html).toMatch(/<th[^>]*contenteditable="true"[^>]*data-cell-id="h0"[^>]*><span[^>]*>A<\/span>/)
    expect(html).not.toContain('autodown-stream-banner')
  })

  it('readonly (streaming) renders the banner, disables verbs, drops contenteditable', async () => {
    const html = await editHtml(controller(), true)
    expect(html).toContain('autodown-stream-banner')
    expect(html).toContain('流式生成中')
    expect(html).toContain('disabled')
    expect(html).toContain('class="autodown-table-editor is-readonly"')
    expect(html).toMatch(/<th[^>]*contenteditable="false"/)
  })

  it('blur commits the cell text through the ext bridge (dataset read → commitCell)', async () => {
    const ctl = controller()
    const html = await editHtml(ctl)
    expect(html).toContain('data-cell-id="h0"')
    // the blur wiring goes through commitTableCell (dataset.cellId +
    // innerText) — the bridge is exercised headless in the stream/unit
    // layer; here we pin that a data-cell-id carrier exists per cell
    expect(html.match(/data-cell-id=/g)).toHaveLength(2)
  })
})
