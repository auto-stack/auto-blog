// Inline wikilink parsing (plan 036 T4, D2): `[[title]]` and
// `[[title#block]]` lift into a model span carrying the `wikilink` attr
// (raw inner as both text and attr value — byte-lossless roundtrip); the
// `[[[` escape, unclosed/empty/pipe forms degrade to literal text (008
// dialect philosophy). The DOM label contract
// (.autodown-wikilink-label[data-wikilink-title]) renders from this span
// in render-node (T5), replacing the 020 DOM decorator.

import { describe, expect, it } from 'vitest'
import { Mark, attrGetStr, spansText } from '../block-model'
import { parse_blocks } from '../markdown-parser'
import { serialize } from '../serializer'

const spansOf = (md: string) => parse_blocks(md, true).children[0]!.inlines

function findWiki(md: string) {
  return spansOf(md).find((s) => attrGetStr(s.attrs, 'wikilink', '') !== '')
}

describe('wikilink parse → span model', () => {
  it('basic: [[首页]] becomes a wikilink span between text runs', () => {
    const spans = spansOf('正文 [[首页]] 尾')
    expect(spans).toHaveLength(3)
    const wiki = spans[1]!
    expect(attrGetStr(wiki.attrs, 'wikilink', '')).toBe('首页')
    expect(wiki.text).toBe('首页')
    expect(wiki.marks).toHaveLength(0)
    // flat text conservation: the label text is the plain text
    expect(spansText(spans)).toBe('正文 首页 尾')
  })

  it('anchor: [[页#块]] keeps the raw inner (render splits the payload)', () => {
    const wiki = findWiki('见 [[页#块]] 引用')!
    expect(wiki.text).toBe('页#块')
    expect(attrGetStr(wiki.attrs, 'wikilink', '')).toBe('页#块')
  })

  it('inside strong: the mark propagates onto the wikilink span', () => {
    const wiki = findWiki('**加 [[首页]] 粗**')!
    expect(attrGetStr(wiki.attrs, 'wikilink', '')).toBe('首页')
    expect(wiki.marks).toContain(Mark.Strong)
  })

  it('serializer emits [[inner]] symmetrically (byte-canonical)', () => {
    const src = '链接 [[首页]] 与 [[页#块]] 文档\n'
    expect(serialize(parse_blocks(src, true), true)).toBe(src)
  })
})

describe('wikilink literal degradation (008 dialect philosophy)', () => {
  it('unclosed [[.. stays literal text', () => {
    expect(findWiki('看 [[首页 无闭合')).toBeUndefined()
    expect(spansText(spansOf('看 [[首页 无闭合'))).toBe('看 [[首页 无闭合')
  })

  it('[[[ escape: the leading bracket literalizes, the rest still links', () => {
    const spans = spansOf('[[[不是]]]')
    const wiki = findWiki('[[[不是]]]')
    expect(wiki!.text).toBe('不是')
    expect(spansText(spans)).toBe('[不是]')
  })

  it('empty title and pipe forms stay literal (decorator charset)', () => {
    expect(findWiki('空 [[ ]] 标题')).toBeUndefined()
    expect(findWiki('管道 [[a|b]] 形式')).toBeUndefined()
  })

  it('degraded forms roundtrip byte-stable', () => {
    for (const src of ['看 [[首页 无闭合\n', '空 [[ ]] 标题\n', '管道 [[a|b]] 形式\n']) {
      expect(serialize(parse_blocks(src, true), true)).toBe(src)
    }
  })

  it('no wikilink inside inline code (code span consumes the brackets)', () => {
    expect(findWiki('码 `[[首页]]` 字面')).toBeUndefined()
  })
})
