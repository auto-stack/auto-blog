// Tests for the strong block-tree output layer
// (auto/markdown_parser.at converter section -> ../markdown-parser.ts).
// Assertions target the typed tree shape (kinds, attrs, ids, inline marks) and
// the IAL pre-step wiring; `parseDocument` itself is covered byte-for-byte by
// the vue parity suite, so here we only assert the observable contract that
// parse_blocks relies on.

import { describe, expect, it } from 'vitest'
import {
  Attr,
  BlockType,
  Mark,
  Value,
  attrGet,
  attrGetBool,
  attrGetInt,
  attrGetStr,
  hasMark,
  spansText,
} from '../block-model'
import { parse_blocks, parseDocument } from '../markdown-parser'
import { serialize } from '../serializer'

describe('parse_blocks tree shape', () => {
  it('returns a doc root with indexed top-level ids', () => {
    const root = parse_blocks('# Title\n\nsome text\n', true)
    expect(root.id).toBe('doc')
    expect(root.kind).toBe(BlockType.Paragraph)
    expect(root.children.map((b) => b.id)).toEqual(['block-0', 'block-1'])
  })

  it('maps headings to Heading kind with a level attr', () => {
    const root = parse_blocks('## Hello **world**\n', true)
    const h = root.children[0]
    expect(h.kind).toBe(BlockType.Heading)
    expect(attrGetInt(h.attrs, 'level', 0)).toBe(2)
    expect(spansText(h.inlines)).toBe('Hello world')
    expect(hasMark(h.inlines[1].marks, Mark.Strong)).toBe(true)
  })

  it('maps fenced code to Fence with language attr and code span', () => {
    const root = parse_blocks('```ts\nconst x = 1\n```\n', true)
    const f = root.children[0]
    expect(f.kind).toBe(BlockType.Fence)
    expect(attrGetStr(f.attrs, 'language', '')).toBe('ts')
    expect(spansText(f.inlines)).toBe('const x = 1\n')
  })

  it('maps thematic breaks', () => {
    const root = parse_blocks('a\n\n---\n\nb\n', true)
    expect(root.children[1].kind).toBe(BlockType.ThematicBreak)
  })

  it('nests blockquote children with hierarchical ids', () => {
    const root = parse_blocks('> quoted\n', true)
    const q = root.children[0]
    expect(q.kind).toBe(BlockType.Blockquote)
    expect(q.children).toHaveLength(1)
    expect(q.children[0].kind).toBe(BlockType.Paragraph)
    expect(q.children[0].id).toBe('block-0-0')
    expect(spansText(q.children[0].inlines)).toBe('quoted')
  })

  it('nests list items with ordered/start attrs and hierarchical ids', () => {
    const root = parse_blocks('3. three\n4. four\n', true)
    const list = root.children[0]
    expect(list.kind).toBe(BlockType.ListBlock)
    expect(attrGetBool(list.attrs, 'ordered', false)).toBe(true)
    expect(attrGetInt(list.attrs, 'start', 0)).toBe(3)
    expect(list.children.map((b) => b.id)).toEqual(['block-0-0', 'block-0-1'])
    for (const item of list.children) {
      expect(item.kind).toBe(BlockType.ListItem)
      expect(item.children[0].kind).toBe(BlockType.Paragraph)
    }
    expect(spansText(list.children[0].children[0].inlines)).toBe('three')
  })
})

describe('parse_blocks inlines', () => {
  it('carries link href/title in span attrs, mark stays a unit enum', () => {
    const root = parse_blocks('see [docs](https://example.com "title") now\n', true)
    const p = root.children[0]
    const link = p.inlines.find((s) => hasMark(s.marks, Mark.Link))
    expect(link).toBeDefined()
    expect(link!.text).toBe('docs')
    expect(attrGetStr(link!.attrs, 'href', '')).toBe('https://example.com')
    expect(attrGetStr(link!.attrs, 'title', '')).toBe('title')
  })

  it('carries image src/alt in span attrs', () => {
    const root = parse_blocks('![pic](img.png)\n', true)
    const img = root.children[0].inlines.find((s) => hasMark(s.marks, Mark.Image))
    expect(img).toBeDefined()
    expect(attrGetStr(img!.attrs, 'src', '')).toBe('img.png')
    expect(attrGetStr(img!.attrs, 'alt', '')).toBe('pic')
  })

  it('converts hardbreaks to newline spans', () => {
    const root = parse_blocks('line one  \nline two\n', true)
    expect(spansText(root.children[0].inlines)).toBe('line one\nline two')
  })
})

describe('parse_blocks tables + IAL', () => {
  const tableDoc = '| a | b |\n| --- | --- |\n| 1 | 2 |\n'

  it('maps header/rows/cells with header and align attrs', () => {
    const root = parse_blocks(tableDoc, true)
    const t = root.children[0]
    expect(t.kind).toBe(BlockType.Table)
    expect(t.children).toHaveLength(2)
    expect(t.children[0].kind).toBe(BlockType.TableRow)
    const headCell = t.children[0].children[0]
    expect(headCell.kind).toBe(BlockType.TableCell)
    expect(attrGetBool(headCell.attrs, 'header', false)).toBe(true)
    const bodyCell = t.children[1].children[0]
    expect(attrGetBool(bodyCell.attrs, 'header', true)).toBe(false)
    expect(spansText(bodyCell.inlines)).toBe('1')
  })

  it('attaches IAL cols/rows to the Table block as an AttrsV attr', () => {
    const root = parse_blocks(tableDoc + '{cols:[120,"auto"], rows:[40,"auto"]}\n', true)
    const t = root.children[0]
    expect(t.kind).toBe(BlockType.Table)
    const ial = attrGet(t.attrs, 'ial')
    expect(ial?._tag).toBe('AttrsV')
    if (ial?._tag !== 'AttrsV') throw new Error('unreachable')
    const cols = ial.value.find((a: Attr) => a.key === 'cols')!.value
    const rows = ial.value.find((a: Attr) => a.key === 'rows')!.value
    expect(cols._tag).toBe('ListV')
    expect(rows._tag).toBe('ListV')
    if (cols._tag !== 'ListV' || rows._tag !== 'ListV') throw new Error('unreachable')
    // int? null (the "auto" entry) maps to Value.Null
    expect(cols.value.map((v: Value) => v._tag)).toEqual(['Int', 'Null'])
    expect(rows.value.map((v: Value) => v._tag)).toEqual(['Int', 'Null'])
    if (cols.value[0]._tag === 'Int') expect(cols.value[0].value).toBe(120)
  })

  it('leaves tables without IAL untouched', () => {
    const root = parse_blocks(tableDoc, true)
    expect(attrGet(root.children[0].attrs, 'ial')).toBeNull()
  })
})

describe('parse_blocks block ids', () => {
  it('lets an explicit ^anchor override the fallback id', () => {
    const root = parse_blocks('first\n\nsecond paragraph ^my-anchor\n', true)
    expect(root.children[0].id).toBe('block-0')
    expect(root.children[1].id).toBe('my-anchor')
  })

  it('ignores anchor-like tokens that fail the charset', () => {
    const root = parse_blocks('text ^not ok\n', true)
    expect(root.children[0].id).toBe('block-0')
  })
})

describe('parseDocument legacy behavior is unchanged', () => {
  it('does not run the IAL pre-step (IAL line stays content)', () => {
    const doc = '| a |\n| --- |\n| 1 |\n{cols:[120]}\n'
    const weak = parseDocument(doc, true)
    // legacy parser sees the IAL line as a paragraph after the table
    expect(weak.map((n) => n.type)).toEqual(['table', 'paragraph'])
    const strong = parse_blocks(doc, true)
    expect(strong.children.map((b) => b.kind)).toEqual([BlockType.Table])
  })
})

describe('$ component blocks (plan 030 T2)', () => {
  it('parses $callout with type/title attrs and paragraph children', () => {
    const root = parse_blocks('$callout(type: "note", title: "提示") {\n正文段落\n}\n', true)
    const c = root.children[0]
    expect(c.kind).toBe(BlockType.Callout)
    expect(attrGetStr(c.attrs, 'type', '')).toBe('note')
    expect(attrGetStr(c.attrs, 'title', '')).toBe('提示')
    expect(c.children).toHaveLength(1)
    expect(c.children[0].kind).toBe(BlockType.Paragraph)
    expect(spansText(c.children[0].inlines)).toBe('正文段落')
  })

  it('parses $details summary + open attrs', () => {
    const root = parse_blocks('$details(summary: "更多", open: true) {\n内容\n}\n', true)
    const d = root.children[0]
    expect(d.kind).toBe(BlockType.Details)
    expect(attrGetStr(d.attrs, 'summary', '')).toBe('更多')
    expect(attrGetBool(d.attrs, 'open', false)).toBe(true)
    expect(d.children[0].kind).toBe(BlockType.Paragraph)
    expect(spansText(d.children[0].inlines)).toBe('内容')
  })

  it('details without open attr stays closed', () => {
    const root = parse_blocks('$details(summary: "s") {\nx\n}\n', true)
    const d = root.children[0]
    expect(attrGetBool(d.attrs, 'open', false)).toBe(false)
    expect(attrGet(d.attrs, 'open')).toBeNull()
  })

  it('parses $query bare-arg leaf with query attr', () => {
    const root = parse_blocks('$query(TAG #project)\n', true)
    const q = root.children[0]
    expect(q.kind).toBe(BlockType.QueryBlock)
    expect(attrGetStr(q.attrs, 'query', '')).toBe('TAG #project')
    expect(q.children).toHaveLength(0)
  })

  it('parses $embed src leaf', () => {
    const root = parse_blocks('$embed(src: "https://example.com/x")\n', true)
    const e = root.children[0]
    expect(e.kind).toBe(BlockType.BlockEmbed)
    expect(attrGetStr(e.attrs, 'src', '')).toBe('https://example.com/x')
  })

  it('unknown $name degrades to paragraph literal', () => {
    const root = parse_blocks('$unknown(x: "y") {\nbody\n}\n', true)
    expect(root.children[0].kind).toBe(BlockType.Paragraph)
  })

  it('unclosed $callout degrades to paragraph literal (streaming safety)', () => {
    const root = parse_blocks('$callout(type: "note") {\nbody\n', false)
    expect(root.children[0].kind).toBe(BlockType.Paragraph)
    const fin = parse_blocks('$callout(type: "note") {\nbody\n', true)
    expect(fin.children[0].kind).toBe(BlockType.Paragraph)
  })

  it('a component open line breaks a preceding paragraph', () => {
    const root = parse_blocks('para text\n$callout(type: "n") {\nx\n}\n', true)
    expect(root.children.map((b) => b.kind)).toEqual([BlockType.Paragraph, BlockType.Callout])
  })

  it('nested $ containers pair their braces (inner } does not close outer)', () => {
    const md = '$details(summary: "s") {\n$callout(type: "warn") {\n内层\n}\n外层尾段\n}\n'
    const root = parse_blocks(md, true)
    const d = root.children[0]
    expect(d.kind).toBe(BlockType.Details)
    expect(d.children.map((b) => b.kind)).toEqual([BlockType.Callout, BlockType.Paragraph])
    expect(attrGetStr(d.children[0].attrs, 'type', '')).toBe('warn')
    expect(spansText(d.children[1].inlines)).toBe('外层尾段')
  })
})

describe('%{ }% math block + mermaid fence (plan 030 T3)', () => {
  it('parses %{ }% to MathBlock with raw source span', () => {
    const root = parse_blocks('%{\ne = mc^2\n}%\n', true)
    const m = root.children[0]
    expect(m.kind).toBe(BlockType.MathBlock)
    expect(spansText(m.inlines)).toBe('e = mc^2')
    expect(m.inlines).toHaveLength(1)
  })

  it('math source keeps raw markup chars (no inline parsing)', () => {
    const root = parse_blocks('%{\na_1 * b_2\n}%\n', true)
    const m = root.children[0]
    expect(m.kind).toBe(BlockType.MathBlock)
    expect(m.inlines).toHaveLength(1)
    expect(spansText(m.inlines)).toBe('a_1 * b_2')
  })

  it('unclosed %{ degrades to paragraph literal (streaming safety)', () => {
    const root = parse_blocks('%{\ne = mc^2\n', false)
    expect(root.children[0].kind).toBe(BlockType.Paragraph)
    expect(spansText(root.children[0].inlines)).toContain('e = mc^2')
  })

  it('closed mermaid fence becomes Mermaid kind carrying the source', () => {
    const root = parse_blocks('```mermaid\ngraph TD;\nA-->B;\n```\n', true)
    const mm = root.children[0]
    expect(mm.kind).toBe(BlockType.Mermaid)
    expect(spansText(mm.inlines)).toBe('graph TD;\nA-->B;')
  })

  it('open mermaid fence stays a loading Fence while streaming', () => {
    const root = parse_blocks('```mermaid\ngraph TD;\n', false)
    const f = root.children[0]
    expect(f.kind).toBe(BlockType.Fence)
    expect(attrGetStr(f.attrs, 'language', '')).toBe('mermaid')
    expect(attrGetBool(f.attrs, 'loading', false)).toBe(true)
  })

  it('non-mermaid closed fences stay Fence', () => {
    const root = parse_blocks('```rust\nfn main() {}\n```\n', true)
    expect(root.children[0].kind).toBe(BlockType.Fence)
  })

  it('a %{ opener line breaks a preceding paragraph', () => {
    const root = parse_blocks('para\n%{\nx\n}%\n', true)
    expect(root.children.map((b) => b.kind)).toEqual([BlockType.Paragraph, BlockType.MathBlock])
  })
})

describe('task list items (plan 030 T4)', () => {
  it('parses - [ ] / - [x] prefixes into ListItem checked attrs', () => {
    const root = parse_blocks('- [ ] todo a\n- [x] done b\n- plain c\n', true)
    const list = root.children[0]
    expect(list.kind).toBe(BlockType.ListBlock)
    expect(list.children.map((li) => attrGet(li.attrs, 'checked')?._tag)).toEqual([
      'Bool',
      'Bool',
      undefined,
    ])
    expect(attrGetBool(list.children[0].attrs, 'checked', true)).toBe(false)
    expect(attrGetBool(list.children[1].attrs, 'checked', false)).toBe(true)
    expect(spansText(list.children[0].children[0].inlines)).toBe('todo a')
    expect(spansText(list.children[1].children[0].inlines)).toBe('done b')
    expect(spansText(list.children[2].children[0].inlines)).toBe('plain c')
  })

  it('recognizes uppercase [X] as checked', () => {
    const root = parse_blocks('- [X] big\n', true)
    expect(attrGetBool(root.children[0].children[0].attrs, 'checked', false)).toBe(true)
  })

  it('ordered lists do NOT recognize task prefixes (GFM alignment)', () => {
    const root = parse_blocks('1. [ ] nope\n', true)
    const li = root.children[0].children[0]
    expect(attrGet(li.attrs, 'checked')).toBeNull()
    expect(spansText(li.children[0].inlines)).toBe('[ ] nope')
  })
})

describe('nested emphasis delimiters (plan 028 P2T1)', () => {
  const spansOf = (md: string) => parse_blocks(md, true).children[0].inlines

  it('***x*** parses to one span carrying BOTH Strong and Em', () => {
    const spans = spansOf('both ***marks*** now\n')
    const target = spans.find((s) => s.text === 'marks')
    expect(target).toBeDefined()
    expect(hasMark(target!.marks, Mark.Strong)).toBe(true)
    expect(hasMark(target!.marks, Mark.Em)).toBe(true)
  })

  it('**_x_** mixed-delimiter nesting parses to the same double mark', () => {
    const spans = spansOf('a **_deep_** b\n')
    const target = spans.find((s) => s.text === 'deep')
    expect(target).toBeDefined()
    expect(hasMark(target!.marks, Mark.Strong)).toBe(true)
    expect(hasMark(target!.marks, Mark.Em)).toBe(true)
  })

  it('inline code inside the nesting keeps its own span, text keeps both marks', () => {
    const spans = spansOf('***a `b` c***\n')
    expect(spans.map((s) => s.text).join('')).toBe('a b c')
    expect(spans.find((s) => hasMark(s.marks, Mark.Code))?.text).toBe('b')
    for (const s of spans.filter((s) => !hasMark(s.marks, Mark.Code))) {
      expect(hasMark(s.marks, Mark.Strong)).toBe(true)
      expect(hasMark(s.marks, Mark.Em)).toBe(true)
    }
  })

  it('serialize→parse roundtrip loses neither mark (md reload path)', () => {
    const src = 'both ***marks*** and **_deep_**\n'
    const md = serialize(parse_blocks(src, true), true)
    const spans = parse_blocks(md, true).children[0].inlines
    const marks = spans.find((s) => s.text === 'marks')?.marks ?? []
    const deep = spans.find((s) => s.text === 'deep')?.marks ?? []
    expect(hasMark(marks, Mark.Strong) && hasMark(marks, Mark.Em)).toBe(true)
    expect(hasMark(deep, Mark.Strong) && hasMark(deep, Mark.Em)).toBe(true)
  })

  it('unclosed triples stay literal (no phantom nesting)', () => {
    const spans = spansOf('a *** b\n')
    expect(spansText(spans)).toBe('a *** b')
    expect(spans.some((s) => hasMark(s.marks, Mark.Strong) || hasMark(s.marks, Mark.Em))).toBe(false)
  })
})

describe('underline delimiter (plan 028 P2T2)', () => {
  const spansOf = (md: string) => parse_blocks(md, true).children[0].inlines

  it('__x__ parses to an Underline-marked span', () => {
    const spans = spansOf('a __under__ b\n')
    const target = spans.find((s) => s.text === 'under')
    expect(target).toBeDefined()
    expect(hasMark(target!.marks, Mark.Underline)).toBe(true)
    expect(hasMark(target!.marks, Mark.Em)).toBe(false)
  })

  it('___x___ triple nests Underline(Em(...)) — triple before double', () => {
    const spans = spansOf('a ___deep___ b\n')
    const target = spans.find((s) => s.text === 'deep')
    expect(target).toBeDefined()
    expect(hasMark(target!.marks, Mark.Underline)).toBe(true)
    expect(hasMark(target!.marks, Mark.Em)).toBe(true)
  })

  it('single _ stays Em (not Underline)', () => {
    const spans = spansOf('a _em_ b\n')
    const target = spans.find((s) => s.text === 'em')
    expect(hasMark(target!.marks, Mark.Em)).toBe(true)
    expect(hasMark(target!.marks, Mark.Underline)).toBe(false)
  })

  it('__ intraword restriction keeps snake__case__word literal', () => {
    const spans = spansOf('snake__case__word\n')
    expect(spansText(spans)).toBe('snake__case__word')
    expect(spans.some((s) => hasMark(s.marks, Mark.Underline))).toBe(false)
  })

  it('serialize→parse roundtrip is mark-lossless and canonical-stable', () => {
    const src = 'plain __under__ and ___deep___\n'
    const md = serialize(parse_blocks(src, true), true)
    // `___` canonicalizes to the nested form `__*x*__` (same as `**_x_**`
    // → `***x***`); marks survive, and the canonical form is byte-stable
    expect(md).toBe('plain __under__ and __*deep*__\n')
    expect(serialize(parse_blocks(md, true), true)).toBe(md)
    const spans = parse_blocks(md, true).children[0].inlines
    expect(hasMark(spans.find((s) => s.text === 'under')!.marks, Mark.Underline)).toBe(true)
    const deep = spans.find((s) => s.text === 'deep')!.marks
    expect(hasMark(deep, Mark.Underline) && hasMark(deep, Mark.Em)).toBe(true)
  })

  it('Underline+Em nests in both directions through the mixed family', () => {
    // __ *x* __ and **_x_**-style mixes keep every mark
    const spans = spansOf('__*mix*__\n')
    const target = spans.find((s) => s.text === 'mix')
    expect(target).toBeDefined()
    expect(hasMark(target!.marks, Mark.Underline)).toBe(true)
    expect(hasMark(target!.marks, Mark.Em)).toBe(true)
  })
})
