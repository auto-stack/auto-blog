// Stream tri-state audit (plan 032 P1/T1+T2): every BlockType kind ×
// {unclosed, open, closed} streamed through the REAL pipe
// (StreamingRenderer → markdown segment → MarkdownRender → parseDocument with
// the final flag) and asserted on its DOM shape. The per-kind rulings (D2
// table) live in the plan file; this file pins them same-source against the
// fixtures/tri-state.ts corpus:
//
//   A = default panel path, zero stream-slot registration (expected for all
//       kinds after the P2 table unification — Table included)
//
// T1 scope: corpus loading contract — 17 kinds present, shape well-formed,
// closed fixtures resolve their kind, streaming prefixes parse without
// throwing. T2 adds the rendered-DOM assertions per state.

import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { parseDocument } from '../markdown-parser.generated'
import MarkdownRender from '../MarkdownRender.vue'
import EngineEditor from '../../editor/components/EngineEditor.vue'
import { TRI_STATE, TRI_STATE_KINDS } from './fixtures/tri-state'

void EngineEditor // module-scope extension-panel registrations (031 precedent)

async function render(content: string, final: boolean): Promise<string> {
  const app = createSSRApp({
    render: () => h(MarkdownRender as any, { content, final, batchRendering: false }),
  })
  return (await renderToString(app)).replace(/<!--.*?-->/g, '')
}

describe('tri-state corpus loading contract (T1)', () => {
  it('covers exactly the 17 BlockType kinds', () => {
    expect(Object.keys(TRI_STATE).sort()).toEqual([...TRI_STATE_KINDS].sort())
    expect(TRI_STATE_KINDS).toHaveLength(17)
  })

  it('container members carry no fixtures; every other kind has closed + closedKind', () => {
    for (const kind of TRI_STATE_KINDS) {
      const doc = TRI_STATE[kind]
      if (doc.ridesContainer) {
        expect(doc.unclosed, kind).toBeNull()
        expect(doc.open, kind).toBeNull()
        expect(doc.closed, kind).toBeNull()
        expect(doc.closedKind, kind).toBeNull()
      } else {
        expect(typeof doc.closed, kind).toBe('string')
        expect(doc.closed!.length, kind).toBeGreaterThan(0)
        expect(doc.closedKind, kind).toBeTruthy()
      }
    }
  })

  it('closed fixtures parse to their declared kind (final=true)', () => {
    for (const kind of TRI_STATE_KINDS) {
      const doc = TRI_STATE[kind]
      if (doc.ridesContainer) continue
      const nodes = parseDocument(doc.closed!, true)
      expect(nodes.length, kind).toBeGreaterThanOrEqual(1)
      expect(nodes[0].type, kind).toBe(doc.closedKind)
    }
  })

  it('unclosed/open prefixes parse without throwing (final=false)', () => {
    for (const kind of TRI_STATE_KINDS) {
      const doc = TRI_STATE[kind]
      for (const prefix of [doc.unclosed, doc.open]) {
        if (prefix == null) continue
        expect(() => parseDocument(prefix, false), kind).not.toThrow()
      }
    }
  })
})

// ── T2: tri-state DOM audit ─────────────────────────────────────────────
//
// D2 裁定（执行期实测冻结）：全部 17 kind 裁定 A——默认面板路径（MarkdownRender
// → parseDocument(final flag) → renderNodes → panel registry），零 stream 槽
// 注册。机制根据：闭合 fence 式状态机保证源码完整后面板路径与 view 同型；
// 注册 stream 槽只在面板路径不适配渐进时才有价值（表格历史反例已由 P2 归一
// 吸收——Table 的 open/closed 断言即 render.test.ts 同一 DOM 契约，归一前后
// 必须同形）。容器成员（ListItem/TableRow/TableCell/WikilinkBlock）随容器。

interface CellExpectation {
  contains: string[]
  not: string[]
}

/** per kind × state DOM markers; unclosed/open assert the DEGRADED/loading
 *  shape (no final panel), closed asserts the panel contract. */
const EXPECT: Record<string, Partial<Record<'unclosed' | 'open' | 'closed', CellExpectation>>> = {
  Heading: {
    unclosed: { contains: ['heading-node heading-2', '流式标题正在'], not: [] },
    closed: { contains: ['heading-node heading-2', '流式标题'], not: [] },
  },
  Paragraph: {
    unclosed: { contains: ['paragraph-node', '句子尚未'], not: [] },
    closed: { contains: ['paragraph-node', '句子完整'], not: [] },
  },
  Fence: {
    // mid-opener: two backticks are a paragraph literal, no code panel yet
    unclosed: { contains: ['paragraph-node'], not: ['code-block-container', 'data-language'] },
    open: {
      contains: ['code-block-container', 'data-language="rust"', 'fn streaming_example', 'autodown-block-placeholder is-loading', 'aria-busy="true"'],
      not: [],
    },
    closed: {
      contains: ['code-block-container', 'data-language="rust"', 'x * 2'],
      not: ['is-loading', 'aria-busy="true"'],
    },
  },
  Blockquote: {
    unclosed: { contains: ['blockquote', '引用行还在流式'], not: [] },
    closed: { contains: ['blockquote', '引用第二行'], not: [] },
  },
  ListBlock: {
    unclosed: { contains: ['list-node list-disc', '列表项还在流式'], not: [] },
    closed: { contains: ['list-node list-disc', '列表项乙', '嵌套项'], not: [] },
  },
  ThematicBreak: {
    unclosed: { contains: ['paragraph-node'], not: ['hr-node'] },
    closed: { contains: ['hr-node'], not: [] },
  },
  Table: {
    // header without delimiter = paragraph literal; delimiter + rows = the
    // table panel contract (render.test.ts same-source; must hold identical
    // across the P2 unification)
    unclosed: { contains: ['paragraph-node'], not: ['table-node'] },
    open: { contains: ['table-node', 'table-node__resize-handle', '名称', '甲'], not: [] },
    closed: { contains: ['table-node', 'table-node__resize-handle', '名称', '乙'], not: [] },
  },
  Callout: {
    unclosed: { contains: ['paragraph-node', '正文还在流式'], not: ['callout-node', 'autodown-callout'] },
    closed: { contains: ['callout-node', 'autodown-callout-warning', 'data-callout-type="warning"', '卡片正文'], not: [] },
  },
  Details: {
    unclosed: { contains: ['paragraph-node', '内容还在流式'], not: ['autodown-details'] },
    closed: { contains: ['autodown-details', '点击展开', '折叠内容正文'], not: [] },
  },
  WikilinkBlock: {}, // 随容器：render 解析子集不发射 wikilink 语法
  ListItem: {}, // 随容器：ListBlock
  TableRow: {}, // 随容器：Table
  TableCell: {}, // 随容器：Table
  QueryBlock: {
    unclosed: { contains: ['paragraph-node', 'query(TAG #proj'], not: ['autodown-query-block'] },
    closed: { contains: ['autodown-query-block', 'TAG #project'], not: [] },
  },
  BlockEmbed: {
    unclosed: { contains: ['paragraph-node', 'example.com/x'], not: ['autodown-block-embed'] },
    closed: { contains: ['autodown-block-embed'], not: [] },
  },
  Mermaid: {
    // language still streaming: a generic loading code block, kind not yet
    // identifiable — never the mermaid panel (031 pinned); same skeleton
    // family as any open fence (032 P3: 同形态)
    unclosed: { contains: ['code-block-container', 'data-language="m"', 'autodown-block-placeholder is-loading'], not: ['autodown-mermaid-block', '<svg'] },
    open: { contains: ['code-block-container', 'data-language="mermaid"', 'graph TD;', 'autodown-block-placeholder is-loading', 'aria-busy="true"'], not: ['autodown-mermaid-block', '<svg'] },
    closed: { contains: ['autodown-mermaid-block', 'mermaid-source'], not: ['is-loading'] },
  },
  MathBlock: {
    // %{ without }% = paragraph literal (031 pinned)
    unclosed: { contains: ['paragraph-node', 'e = mc^2'], not: ['autodown-math-block', 'katex'] },
    closed: { contains: ['autodown-math-block', 'math-block-source'], not: [] },
  },
}

describe('tri-state DOM audit (T2) — D2 裁定冻结：17 kind 全 A（零注册）', () => {
  const FINAL_OF = { unclosed: false, open: false, closed: true } as const

  for (const kind of TRI_STATE_KINDS) {
    const doc = TRI_STATE[kind]
    if (doc.ridesContainer) continue
    const cells = EXPECT[kind]

    for (const state of ['unclosed', 'open', 'closed'] as const) {
      const source = doc[state]
      const cell = cells[state]
      if (source == null) {
        it(`${kind} ${state}: 无此态（D2 表 "—"）且无断言`, () => {
          expect(cell).toBeUndefined()
          expect(EXPECT[kind][state]).toBeUndefined()
        })
        continue
      }
      it(`${kind} ${state}: renders the ruled shape (final=${FINAL_OF[state]})`, async () => {
        expect(cell, `${kind} ${state} expectation present`).toBeDefined()
        const html = await render(source, FINAL_OF[state])
        for (const marker of cell!.contains) expect(html, `${kind} ${state}\n${html}`).toContain(marker)
        for (const marker of cell!.not) expect(html, `${kind} ${state}\n${html}`).not.toContain(marker)
      })
    }
  }

  it('closed constructs render identically mid-stream (final=false) — 闭合翻转无 DOM 跳变', async () => {
    for (const kind of TRI_STATE_KINDS) {
      const doc = TRI_STATE[kind]
      if (doc.ridesContainer) continue
      const cell = EXPECT[kind].closed!
      const html = await render(doc.closed!, false)
      for (const marker of cell.contains) expect(html, kind).toContain(marker)
      for (const marker of cell.not) expect(html, kind).not.toContain(marker)
    }
  })
})
