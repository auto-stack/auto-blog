// Parse-blocks cross-target parity golden generator (plan 019 Phase 1):
// runs the strong parse_blocks over a directed fixture corpus (final AND
// streaming modes), projects the block tree to stable text lines, and
// rewrites the golden consumed by the rust crate's tests/parse_parity.rs on
// every engine `pnpm test`. The rust side (packages/engine/rust/src/
// markdown_parser.rs — a2r emission of the same auto/parser/markdown_parser.at)
// asserts this file byte for byte; green on both sides = the two emissions
// parse identically. (Marks/BlockType render by name; the numeric TS enums
// reverse-map, the rust enums Debug-print the variant name.)

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
// enums come from their defining module: the `export *` re-export chain
// loses enum bindings under vitest's transform (block-parser.test.ts
// precedent).
import { BlockType, Mark } from '../block-model'
import { parse_blocks } from '../markdown-parser'

const FIXTURES: Array<[string, string]> = [
  ['heading-para', '# Hello\n\nworld **bold** and *em* text.\n'],
  ['setext', '标题 setext\n===\n\n第一段\n第二段\n'],
  ['fence-closed', '```rust\nfn main() {\n    println!("hi");\n}\n```\n'],
  ['fence-tilde-open', '~~~py\nx = 1\n'],
  ['blockquote', '> 引用一行\n> 引用二行\n\n普通段落\n'],
  ['blockquote-lazy', '> 引用\n懒惰续行\n'],
  ['ul-nested', '- 甲\n  - 甲子\n  - 甲丑\n- 乙\n'],
  ['ul-empty-item', '-\n- 有内容\n'],
  ['ol-start', '3. 第三\n4. 第四\n'],
  ['table-ial', '| a | b |\n| :-- | --: |\n| 1 | 2 |\n{cols:[120,"auto"]}\n'],
  // PLAN-056 D1: table cell escape contract - backslash-pipe is a
  // literal pipe inside the cell (no column split), double backslash a
  // literal backslash; cell text arrives unescaped. Keep in lockstep
  // with the rust FIXTURES.
  ['table-escape-pipe', '| a\\|b | c |\n| --- | --- |\n| x | y |\n'],
  ['table-escape-backslash', '| a\\\\ | b |\n| --- | --- |\n| 1 | 2 |\n'],
  ['table-escape-edges', '| \\|lead | tail\\| |\n| --- | --- |\n| 1 | 2 |\n'],
  ['table-escape-mixed', '| a\\|b | c\\\\d |\n| --- | --- |\n| e\\|f | g\\\\h |\n'],
  ['thematic', '---\n\n***\n\n尾段\n'],
  [
    'inline-zoo',
    '链接 [文本](https://example.com "标题") 图 ![alt](img.png) 删除 ~~删~~ 码 `x = y` ' +
      '硬断行  \n转义 \\*字面\\* 智能 "引号" 与 撇号 \'don\'t\' 以及中英混排 “已经弯的”。\n',
  ],
  ['anchor', '带锚点块 ^my-anchor\n'],
  // plan 030: extension block dialect fixtures ($ components / %{ }% math /
  // mermaid fence) — parse→BlockNode projections asserted cross-target.
  ['callout-closed', '$callout(type: "note", title: "提示") {\n正文段落\n}\n'],
  ['callout-unclosed', '$callout(type: "note") {\n正文\n'],
  ['details-open', '$details(summary: "更多", open: true) {\n内容\n}\n'],
  ['query-embed', '$query(TAG #project)\n\n$embed(src: "https://example.com/x")\n'],
  ['math-block', '%{\ne = mc^2\n}%\n'],
  ['mermaid-closed', '```mermaid\ngraph TD;\nA-->B;\n```\n'],
  ['mermaid-open', '```mermaid\ngraph TD;\n'],
  ['comp-nested', '$details(summary: "s") {\n$callout(type: "warn") {\n内层\n}\n外层尾段\n}\n'],
  ['task-list', '- [ ] 待办甲\n- [x] 已办乙\n- 普通丙\n'],
  // plan 036 T4: inline wikilink dialect — basic + #anchor + `[[[` escape +
  // unclosed literal degradation, one fixture both final and streaming.
  ['wikilink', '正文 [[首页]] 与 [[页#块]] 还有 [[[字面]]] 以及 [[未闭合\n'],
  // plan 036 T6: inline math dialect — valid span + opener/closer space and
  // digit-after rules degrading to literal, one fixture both modes.
  ['math-inline', '行内 $a+b=c$ 与 $ bad $ 以及 $100$5 字面\n'],
  ['streaming-heading', '## 编辑中的标题\n\n- 列表项\n- '],
  ['streaming-link', '半截链接 [文本](https://example.\n'],
  ['streaming-pretable', '| a | b |\n| --- |\n'],
  ['streaming-partial-paren', '流式前缀构造:截断的标题（\n'],
  ['empty', ''],
]

function esc(s: string): string {
  return s
    .split('\\')
    .join('\\\\')
    .split('"')
    .join('\\"')
    .split('\n')
    .join('\\n')
    .split('\r')
    .join('\\r')
}

function projValue(v: any): string {
  if (v == null) return 'Null'
  if (v._tag === 'Null') return 'Null'
  if (v._tag === 'Str') return 'Str(' + esc(v.value) + ')'
  if (v._tag === 'Int') return 'Int(' + String(v.value) + ')'
  if (v._tag === 'Bool') return 'Bool(' + String(v.value) + ')'
  if (v._tag === 'ListV') return 'List(' + v.value.map(projValue).join(',') + ')'
  if (v._tag === 'AttrsV')
    return 'Attrs(' + v.value.map((a: any) => a.key + '=' + projValue(a.value)).join(',') + ')'
  return 'Unknown'
}

function projBlock(b: any, out: string[], depth: number): void {
  const ind = '  '.repeat(depth)
  out.push(ind + 'block ' + b.id + ' ' + BlockType[b.kind])
  for (const a of b.attrs) out.push(ind + '  attr ' + a.key + ' ' + projValue(a.value))
  for (const s of b.inlines) {
    let line = ind + '  span ' + esc(s.text) + ' [' + s.marks.map((m: any) => Mark[m]).join(',') + ']'
    if (s.attrs.length > 0)
      line += ' {' + s.attrs.map((a: any) => a.key + '=' + projValue(a.value)).join(',') + '}'
    out.push(line)
  }
  for (const c of b.children) projBlock(c, out, depth + 1)
}

const goldenPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../rust/tests/golden/parse-blocks.golden.txt',
)

const header = [
  '# parse-blocks cross-target parity golden (plan 019 Phase 1).',
  '# Rewritten by engine src/parser/__tests__/rust-parse-parity-gen.test.ts on',
  '# every `pnpm test`; asserted by rust tests/parse_parity.rs. Do not edit.',
  '',
]

describe('parse-blocks TS↔Rust parity golden (对拍)', () => {
  it('rewrites the golden and keeps it sane', () => {
    const lines: string[] = []
    for (const [name, md] of FIXTURES) {
      for (const fin of [false, true]) {
        lines.push('=== ' + name + ' final=' + fin + ' ===')
        const root = parse_blocks(md, fin)
        for (const b of root.children) projBlock(b, lines, 0)
      }
    }

    // Invariants — a broken parse must never reach the golden file.
    expect(parse_blocks('# Hi\n', true).children[0].kind).toBe(BlockType.Heading)
    expect(parse_blocks('| a |\n| - |\n| 1 |\n{cols:[5]}\n', true).children[0].kind).toBe(
      BlockType.Table,
    )
    expect(lines.filter((l) => l.startsWith('=== '))).toHaveLength(FIXTURES.length * 2)

    writeFileSync(goldenPath, [...header, ...lines, ''].join('\n'))
  })
})
