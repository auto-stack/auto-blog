// Parity test: the Auto-generated markdown parser (src/markdown-parser.generated.ts,
// source auto/markdown_parser.at) vs the real stream-markdown-parser 0.0.95
// (plan 008, Phase 2 acceptance: final-state trees + streaming-prefix trees).
//
// Comparison happens under a SEMANTIC PROJECTION: noise fields the .at subset
// is not required to replicate byte-for-byte are dropped from both sides
// (raw / center / text / diff / maybeCheckbox / startLine / endLine / attrs).
// Everything else — types, structure, content, loading flags — must be equal.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getMarkdown, parseMarkdownToStructure } from 'stream-markdown-parser'
import { parseDocument } from '../markdown-parser.generated'

const here = dirname(fileURLToPath(import.meta.url))

const md = getMarkdown('parity')

const DROPPED = new Set([
  'raw',
  'center',
  'text', // heading/link flattened text — derivable from children
  'diff',
  'maybeCheckbox',
  'startLine',
  'endLine',
  'attrs', // link attrs appear only in some nesting configurations
])

/** Semantic projection: recursively drop noise fields from both sides. */
function project(n: any): any {
  if (Array.isArray(n)) return n.map(project)
  if (!n || typeof n !== 'object') return n
  const out: Record<string, any> = {}
  for (const k of Object.keys(n)) {
    if (DROPPED.has(k)) continue
    // plan 019: unset optional WNode fields arrive as null (class instances
    // materialize every field); the reference's absent keys are undefined —
    // both mean "not set" for parity.
    if (n[k] == null) continue
    out[k] = n[k]
  }
  for (const k of ['children', 'items', 'rows', 'cells']) {
    if (Array.isArray(out[k])) out[k] = out[k].map(project)
  }
  // plan 019: WNode's table header is a 0-or-1 array (keeps the struct
  // non-recursive on the rust side); normalize to the reference's object.
  if (Array.isArray(out.header)) {
    out.header = out.header.length > 0 ? project(out.header[0]) : null
  } else if (out.header && out.header.type === 'table_row') {
    out.header = project(out.header)
  }
  // plan 019: the cell's header flag is spelled isHeader on WNode (the
  // table's row field owns the `header` name); map back for comparison.
  if (out.type === 'table_cell' && 'isHeader' in out) {
    out.header = out.isHeader
    delete out.isHeader
  }
  return out
}

function reference(input: string, final: boolean): any {
  return project(parseMarkdownToStructure(input, md, { final }))
}

function ours(input: string, final: boolean): any {
  return project(parseDocument(input, final))
}

function expectParity(input: string, note = '') {
  for (const final of [false, true]) {
    const a = ours(input, final)
    const b = reference(input, final)
    expect(a, `${note} final=${final}`).toStrictEqual(b)
  }
}

/** Feed every character prefix to both parsers in streaming mode. */
function scanPrefixes(text: string, note: string) {
  for (let end = 0; end <= text.length; end++) {
    const prefix = text.slice(0, end)
    const a = ours(prefix, false)
    const b = reference(prefix, false)
    expect(a, `${note} streaming prefix len=${end}: ${JSON.stringify(prefix.slice(-25))}`).toStrictEqual(b)
  }
}

const cases: Record<string, string> = {
  heading: '# H1\n\n## H2 ###\n\nplain',
  headingOnlyHash: '#',
  paragraph: 'one two\nthree\n\nfour',
  fenceClosed: '```rust\nfn a() {}\n```',
  fenceOpen: '```rust\nfn a() {',
  fenceTilde: '~~~js\nconst x = 1\n~~~',
  fenceNoLang: '```\nno lang\n```',
  blockquote: '> quoted line\n> second\n\nafter',
  blockquoteNested: '> > deep\n\nafter',
  ul: '- a\n- b\n\nafter',
  ulNested: '- a\n  - b\n- c',
  ol: '1. one\n2. two',
  olStart: '3. three\n4. four',
  ulLazy: '- item\ncontinuation lazy',
  hr: 'a\n\n---\n\nb',
  hrStars: '***',
  table: '| a | b |\n| --- | --- |\n| 1 | 2 |',
  tableAlign: '| a | b | c |\n| :-- | :-: | --: |\n| 1 | 2 | 3 |',
  tableStreaming: '| a | b |\n| --- | --- |\n| 1 |',
  mixed: '# T\n\ntext with **b**\n\n- l1\n- l2\n\n> q\n\n```js\ncode\n```',
  trailingDash: 'para\n\n- ',
  trailingQuote: 'para\n\n> ',
  emptyList: '- \n- b',
  setext: 'Title\n=====\n\nbody',
  indentCode: '    indented code',
  link: 'see [docs](https://x.com) here',
  linkTitle: 'see [docs](https://x.com "t") here',
  image: '![alt](https://img.png)',
  strike: 'a ~~gone~~ b',
  em: 'a *em* and _em2_ b',
  hardbreak: 'a  \nb',
  strongOpen: 'para with **unclosed bold',
  emOpen: 'para with *unclosed',
  linkOpen: 'see [unclosed](h',
  inlineCodeDouble: 'a ``x` y`` b',
  inlineInTable: '| h |\n| --- |\n| **b** |',
}

describe('markdown parser parity — directed cases', () => {
  for (const [name, input] of Object.entries(cases)) {
    it(name, () => {
      expectParity(input, name)
    })
  }
})

describe('markdown parser parity — fixtures (final + streaming)', () => {
  const fixtures = [
    'edge-blocks.md',
    'empty.md',
    'plan-report.md',
    'spec-overview.md',
    'streaming-prefix.md',
  ] as const

  for (const name of fixtures) {
    it(`final-state parity: ${name}`, () => {
      const text = readFileSync(join(here, 'fixtures', name), 'utf8')
      expectParity(text, name)
    })
  }

  it('streaming prefix scan: streaming-prefix.md', () => {
    const text = readFileSync(join(here, 'fixtures', 'streaming-prefix.md'), 'utf8')
    scanPrefixes(text, 'streaming-prefix.md')
  })

  it('streaming prefix scan: synthetic stream', () => {
    const text =
      '# 流式标题\n\n段落一，含 **加粗**、`code` 和 [链接](https://x.com)。\n\n' +
      '- 列表项 1\n- 列表项 2\n  - 嵌套项\n\n' +
      '> 引用块\n> 第二行\n\n' +
      '| a | b |\n| --- | --- |\n| 1 | 2 |\n\n' +
      '```rust\nfn main() {\n    println!("hi");\n}\n```\n'
    scanPrefixes(text, 'synthetic')
  })
})
