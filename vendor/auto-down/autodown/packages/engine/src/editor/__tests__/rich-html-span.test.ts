// Inline span mount + recycle pair (plan 036 T6, D3): the edit host mounts
// wikilink/math spans as atomic contenteditable=false labels (the wikilink
// label contract byte-aligned with the retired decorator; math shows the
// source literal per D4 v1), and the blur walk (domRootToSpans) recovers
// both back into attr-carrying model spans — the full live-DOM roundtrip.

// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { Attr, InlineSpan, Mark, attrGetStr } from '../../parser/block-model'
import { domRootToSpans, spansToHtml } from '../engine/rich-html'

const wikiSpan = (inner: string, marks: Mark[] = []): InlineSpan =>
  new InlineSpan(inner, marks, [new Attr('wikilink', { _tag: 'Str', value: inner } as any)])
const mathSpan = (src: string, marks: Mark[] = []): InlineSpan =>
  new InlineSpan(src, marks, [new Attr('math_inline', { _tag: 'Str', value: src } as any)])

function roundtrip(spans: InlineSpan[]): InlineSpan[] {
  const el = document.createElement('div')
  el.innerHTML = spansToHtml(spans)
  return domRootToSpans(el)
}

describe('edit host mount (spansToHtml)', () => {
  it('wikilink mounts the label contract span (decorator parity)', () => {
    const html = spansToHtml([
      new InlineSpan('见 ', [], []),
      wikiSpan('页#块'),
      new InlineSpan(' 章', [], []),
    ])
    expect(html).toContain(
      '<span class="autodown-wikilink-label" data-wikilink-title="页" contenteditable="false">页#块</span>'
    )
  })

  it('math mounts the source literal with the data-math-src carrier', () => {
    expect(spansToHtml([mathSpan('e=mc^2')])).toBe(
      '<span class="autodown-math-inline" data-math-src="e=mc^2" contenteditable="false">e=mc^2</span>'
    )
  })

  it('marks wrap around the label (Strong over wikilink ≙ **[[x]]**)', () => {
    expect(spansToHtml([wikiSpan('页', [Mark.Strong])])).toBe(
      '<strong><span class="autodown-wikilink-label" data-wikilink-title="页" contenteditable="false">页</span></strong>'
    )
  })
})

describe('blur recycle (domRootToSpans → model spans)', () => {
  it('wikilink label recovers the attr-carrying span', () => {
    const back = roundtrip([
      new InlineSpan('见 ', [], []),
      wikiSpan('页#块'),
      new InlineSpan(' 章', [], []),
    ])
    expect(back).toHaveLength(3)
    expect(back[1]!.text).toBe('页#块')
    expect(attrGetStr(back[1]!.attrs, 'wikilink', '')).toBe('页#块')
    expect(back.map((s) => s.text).join('')).toBe('见 页#块 章')
  })

  it('math span recovers from the data-math-src carrier', () => {
    const back = roundtrip([mathSpan('e=mc^2')])
    expect(back).toHaveLength(1)
    expect(attrGetStr(back[0]!.attrs, 'math_inline', '')).toBe('e=mc^2')
    expect(back[0]!.text).toBe('e=mc^2')
  })

  it('marks survive the cycle (Strong over math)', () => {
    const back = roundtrip([mathSpan('x^2', [Mark.Strong])])
    expect(back[0]!.marks).toContain(Mark.Strong)
    expect(attrGetStr(back[0]!.attrs, 'math_inline', '')).toBe('x^2')
  })

  it('plain text and inline code still recycle unchanged (no regressions)', () => {
    const back = roundtrip([
      new InlineSpan('plain ', [], []),
      new InlineSpan('code', [Mark.Code], []),
      new InlineSpan(' tail', [], []),
    ])
    expect(back.map((s) => s.text).join('')).toBe('plain code tail')
    expect(back[1]!.marks).toContain(Mark.Code)
  })
})
