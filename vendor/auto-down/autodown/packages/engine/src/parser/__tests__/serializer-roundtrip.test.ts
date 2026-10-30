// Roundtrip acceptance for the serializer (auto/serializer.at ->
// ../serializer.ts), plan 016 Phase 3. Three layers, one describe each:
//
//   (a) parse(serialize(parse(x))) semantic equivalence — strong trees
//       compared under normalization (adjacent same-mark spans merged, attrs
//       order-insensitive); this is the strong-tree analogue of the parity
//       suite's semantic projection (the weak-tree DROPPED fields — raw/
//       center/text/diff/maybeCheckbox/startLine/endLine/attrs — never
//       existed in the strong tree).
//   (b) serialize(parse(x)) byte stability — vitest snapshots pin the exact
//       bytes for the musk fixtures; directed cases pin conventions with
//       explicit strings. Source style differences (setext, list markers,
//       blank-line counts) are allowed to normalize; IAL and ^anchors must
//       be preserved.
//   (c) BlockId roundtrip — injected ids (incl. ^anchor overrides) survive
//       serialization (emitIds on and off) without drift.
//
// Plus a describe for the extended-block placeholders (callout/details/
// wikilink/query/embed/mermaid/math) built by directed construction, since
// the scanner never produces them.
//
// Fixtures: copied from auto-musk scripts/lib-parity/fixtures/render/ (same
// origin as the vue parity fixtures).

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  Attr,
  BlockNode,
  BlockType,
  InlineSpan,
  Mark,
  Value,
  attrSet,
  block,
  leafBlock,
} from '../block-model'
import { buildIAL } from '../ial'
import { parse_blocks } from '../markdown-parser'
import { serialize } from '../serializer'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) =>
  readFileSync(join(here, 'fixtures', name), 'utf8')
const FIXTURES = [
  'edge-blocks.md',
  'empty.md',
  'plan-report.md',
  'spec-overview.md',
  'streaming-prefix.md',
]

// ---------- strong-tree normalization for layer (a) ----------

type NormSpan = [string, Mark[], [string, Value][]]

function normAttrs(attrs: Attr[]): [string, Value][] {
  return attrs
    .map((a) => [a.key, a.value] as [string, Value])
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
}

function sameSpanShape(a: NormSpan, b: NormSpan): boolean {
  return (
    JSON.stringify(a[1]) === JSON.stringify(b[1]) &&
    JSON.stringify(a[2]) === JSON.stringify(b[2])
  )
}

function normSpans(spans: InlineSpan[]): NormSpan[] {
  const out: NormSpan[] = []
  for (const s of spans) {
    const cur: NormSpan = [s.text, [...s.marks].sort(), normAttrs(s.attrs)]
    const last = out[out.length - 1]
    if (last && sameSpanShape(last, cur)) {
      last[0] += cur[0]
    } else {
      out.push(cur)
    }
  }
  return out
}

function normTree(node: BlockNode): unknown {
  return {
    id: node.id,
    kind: node.kind,
    attrs: normAttrs(node.attrs),
    inlines: normSpans(node.inlines),
    children: node.children.map(normTree),
  }
}

const round1 = (src: string) => parse_blocks(src, true)
// round2 models a save/load cycle: emitIds=true is the anchor-preserving
// path (emitIds=false is the editor working copy, which intentionally strips
// ^anchors from the text — Obsidian-compatible display hiding).
const round2 = (src: string) => parse_blocks(serialize(round1(src), true), true)

// ---------- directed cases ----------

const DIRECTED: Record<string, string> = {
  headingAtx: '## Hello **world**\n',
  headingSetext: 'Title\n=====\n',
  paragraphMarks: 'a **b** *c* ~~d~~ `e`\n',
  linkTitle: 'see [docs](https://example.com "t") now\n',
  image: '![pic](img.png "cap")\n',
  hardbreak: 'line one  \nline two\n',
  softbreak: 'soft\nbreak\n',
  thematicBreak: 'a\n\n---\n\nb\n',
  fence: '```ts\nconst x = 1\n```\n',
  fenceNoLang: '```\nplain\n```\n',
  blockquote: '> quoted\n>\n> second para\n',
  blockquoteNested: '> > inner\n',
  listUl: '- a\n- b\n',
  listNested: '- a\n  - b\n- c\n',
  listOrderedStart: '3. three\n4. four\n',
  listItemTwoParas: '- one\n\n  two\n',
  table: '| a | b |\n| --- | --- |\n| 1 | 2 |\n',
  tableAlign: '| a | b | c |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |\n',
  tableIAL: '| a | b |\n| --- | --- |\n| 1 | 2 |\n{cols:[120,"auto"], rows:[40,"auto"]}\n',
  tableIALColsOnly: '| a |\n| --- |\n| 1 |\n{cols:[200]}\n',
  anchor: 'first\n\nsecond ^my-anchor\n',
  empty: '',
}

describe('roundtrip layer (a): parse(serialize(parse(x))) semantic equivalence', () => {
  for (const name of FIXTURES) {
    it(`fixture ${name}`, () => {
      const src = fixture(name)
      expect(normTree(round2(src))).toEqual(normTree(round1(src)))
    })
  }
  for (const [name, src] of Object.entries(DIRECTED)) {
    it(`directed ${name}`, () => {
      expect(normTree(round2(src))).toEqual(normTree(round1(src)))
    })
  }
  it('is also equivalent on a third round (fixpoint of the tree)', () => {
    for (const name of FIXTURES) {
      const src = fixture(name)
      const s1 = serialize(round1(src), false)
      const s2 = serialize(parse_blocks(s1, true), false)
      const s3 = serialize(parse_blocks(s2, true), false)
      expect(s3).toBe(s2)
    }
  })
})

describe('roundtrip layer (b): serialize(parse(x)) byte stability', () => {
  for (const name of FIXTURES) {
    it(`snapshot ${name}`, () => {
      const out = serialize(parse_blocks(fixture(name), true), false)
      expect(out).toMatchSnapshot(name)
      // determinism: serializing the reparsed output is byte-identical
      expect(serialize(parse_blocks(out, true), false)).toBe(out)
    })
  }

  it('normalizes setext headings to ATX', () => {
    expect(serialize(round1(DIRECTED.headingSetext), false)).toBe('# Title\n')
  })

  it('keeps list markers and ordered starts canonical', () => {
    expect(serialize(round1(DIRECTED.listOrderedStart), false)).toBe(
      '3. three\n4. four\n'
    )
    expect(serialize(round1('- a\n  - b\n- c\n'), false)).toBe('- a\n  - b\n- c\n')
  })

  it('emits table alignment markers', () => {
    expect(serialize(round1(DIRECTED.tableAlign), false)).toBe(
      '| a | b | c |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |\n'
    )
  })

  it('re-emits IAL in the exact preprocessMarkdown shape', () => {
    // note: the parser normalizes a plain `---` delimiter to align "left",
    // so the canonical delimiter bytes are `:---` (semantics unchanged)
    expect(serialize(round1(DIRECTED.tableIAL), false)).toBe(
      '| a | b |\n| :--- | :--- |\n| 1 | 2 |\n{cols:[120,"auto"], rows:[40,"auto"]}\n'
    )
    expect(serialize(round1(DIRECTED.tableIALColsOnly), false)).toBe(
      '| a |\n| :--- |\n| 1 |\n{cols:[200]}\n'
    )
  })

  it('agrees with ial.at buildIAL on the same sizing data', () => {
    // serializer emits `{` + ialText + `}`; buildIAL returns the whole line
    expect(buildIAL([120, null], [40, null])).toBe(
      '{cols:[120,"auto"], rows:[40,"auto"]}\n'
    )
  })

  it('wraps marks in a fixed order (code < strong < em < del < link)', () => {
    const doc = 'both ***marks***\n'
    expect(serialize(round1(doc), false)).toBe(doc)
  })

  it('serializes the empty tree to an empty string', () => {
    expect(serialize(round1(''), false)).toBe('')
  })
})

describe('roundtrip layer (c): BlockId roundtrip', () => {
  it('anchors are stripped from the working copy, preserved via emitIds=true', () => {
    // emitIds=false = editor working copy: the ^anchor is hidden (stripped)
    expect(serialize(round1(DIRECTED.anchor), false)).toBe('first\n\nsecond\n')
    // emitIds=true = save path: the anchor round-trips byte-identically
    expect(serialize(round1(DIRECTED.anchor), true)).toBe(DIRECTED.anchor)
    const re = parse_blocks(serialize(round1(DIRECTED.anchor), true), true)
    expect(re.children[1].id).toBe('my-anchor')
  })

  it('emitIds=true re-emits real anchors; fallback ids stay internal', () => {
    const anchored = serialize(parse_blocks('# Title ^title-1\n\nsome text\n', true), true)
    expect(anchored).toBe('# Title ^title-1\n\nsome text\n')
    // blocks without an explicit ^anchor get engine-internal ids (block-N),
    // which must NEVER leak into the serialized markdown
    const plain = serialize(parse_blocks('# Title\n\nsome text\n', true), true)
    expect(plain).toBe('# Title\n\nsome text\n')
  })

  it('does not duplicate an anchor already present in the text', () => {
    const out = serialize(parse_blocks(DIRECTED.anchor, true), true)
    expect(out).toBe('first\n\nsecond ^my-anchor\n')
  })

  it('ids do not drift through an emitIds roundtrip', () => {
    const tree = parse_blocks(fixture('plan-report.md'), true)
    const out = serialize(tree, true)
    const re = parse_blocks(out, true)
    expect(re.children.map((b) => b.id)).toEqual(tree.children.map((b) => b.id))
    // and emitting ids again is byte-identical
    expect(serialize(re, true)).toBe(out)
  })
})

describe('extended block placeholders (directed construction)', () => {
  const callout = new BlockNode(
    'x1',
    BlockType.Callout,
    attrSet([], 'type', Value.Str('warning')),
    [leafBlock('x1-0', BlockType.Paragraph, 'high **risk** move')],
    [],
    { start: 0, end: 0 }
  )
  const details = new BlockNode(
    'x2',
    BlockType.Details,
    attrSet([], 'summary', Value.Str('more')),
    [leafBlock('x2-0', BlockType.Paragraph, 'hidden body')],
    [],
    { start: 0, end: 0 }
  )
  const wikilink = new BlockNode(
    'x3',
    BlockType.WikilinkBlock,
    attrSet(attrSet([], 'target', Value.Str('CAP 定理')), 'anchor', Value.Str('block-3')),
    [],
    [],
    { start: 0, end: 0 }
  )
  const query = new BlockNode(
    'x4',
    BlockType.QueryBlock,
    attrSet([], 'query', Value.Str('table tasks where status = "todo"')),
    [],
    [],
    { start: 0, end: 0 }
  )
  const embed = new BlockNode(
    'x5',
    BlockType.BlockEmbed,
    attrSet([], 'src', Value.Str('../other.ad')),
    [],
    [],
    { start: 0, end: 0 }
  )
  const mermaid = leafBlock('x6', BlockType.Mermaid, 'graph TD\nA-->B')
  const math = leafBlock('x7', BlockType.MathBlock, 'E = mc^2')

  const doc = (kids: BlockNode[]) =>
    new BlockNode('doc', BlockType.Paragraph, [], kids, [], { start: 0, end: 0 })

  it('serializes each extended kind to its dialect surface form', () => {
    const out = serialize(doc([callout, details, wikilink, query, embed, mermaid, math]), false)
    expect(out).toBe(
      [
        '$callout(type: "warning") {',
        'high **risk** move',
        '}',
        '',
        '$details(summary: "more") {',
        'hidden body',
        '}',
        '',
        '[[CAP 定理#block-3]]',
        '',
        '$query(table tasks where status = "todo")',
        '',
        '$embed(src: "../other.ad")',
        '',
        '```mermaid',
        'graph TD',
        'A-->B',
        '```',
        '',
        '%{',
        'E = mc^2',
        '}%',
        '',
      ].join('\n')
    )
  })

  it('wikilink without anchor omits the # part', () => {
    const bare = new BlockNode(
      'x8',
      BlockType.WikilinkBlock,
      attrSet([], 'target', Value.Str('CAP 定理')),
      [],
      [],
      { start: 0, end: 0 }
    )
    expect(serialize(doc([bare]), false)).toBe('[[CAP 定理]]\n')
  })
})

describe('dialect roundtrip conservation table (plan 030 T5)', () => {
  const cases: Array<[string, string]> = [
    ['callout type+title', '$callout(type: "note", title: "提示") {\n正文\n}\n'],
    ['callout type only', '$callout(type: "warning") {\nrisk\n}\n'],
    ['details summary', '$details(summary: "更多") {\n内容\n}\n'],
    ['details summary+open', '$details(summary: "更多", open: true) {\n内容\n}\n'],
    ['query', '$query(TAG #x)\n'],
    ['embed', '$embed(src: "https://e.com/x")\n'],
    ['math', '%{\ne = mc^2\n}%\n'],
    ['mermaid', '```mermaid\ngraph TD;\nA-->B;\n```\n'],
    ['task list', '- [ ] a\n- [x] b\n'],
    // plan 036 T4: inline wikilink joins the dialect table (three ruling
    // groups: basic / `[[[` escape / unclosed degrades to literal) plus the
    // #anchor form the DOM contract carries.
    ['wikilink basic', '链接 [[首页]] 文档\n'],
    ['wikilink anchor', '见 [[页#块]] 引用\n'],
    ['wikilink escape', "字面 [[[不是]]]\n"],
    ['wikilink unclosed', '看 [[首页 无闭合\n'],
    // plan 036 T6: inline math joins the table (valid span + a literal
    // degradation form).
    ['math inline', '数学 $e=mc^2$ 记号\n'],
    ['math literal', '规则 $ x$ 字面\n'],
  ]

  it.each(cases)('%s: parse→serialize is byte-canonical and idempotent', (_name, src) => {
    const once = serialize(parse_blocks(src, true), true)
    expect(once).toBe(src)
    const twice = serialize(parse_blocks(once, true), true)
    expect(twice).toBe(src)
  })
})

describe('task list roundtrip (plan 030 T4)', () => {
  it('checked flags survive serialize→parse byte-stable', () => {
    const src = '- [ ] todo a\n- [x] done b\n- plain c\n'
    const md = serialize(parse_blocks(src, true), true)
    expect(md).toBe(src)
    const again = serialize(parse_blocks(md, true), true)
    expect(again).toBe(src)
  })

  it('mixed with nested content keeps the flag on the right item', () => {
    const src = '- [x] top\n  - [ ] child\n'
    const md = serialize(parse_blocks(src, true), true)
    expect(md).toBe('- [x] top\n  - [ ] child\n')
  })

  it('plain items serialize without a checkbox prefix (no regressions)', () => {
    const md = serialize(parse_blocks('- a\n- b\n', true), true)
    expect(md).toBe('- a\n- b\n')
  })
})
