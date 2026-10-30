// Mark span tools tests (plan 024 Phase 0): resplit/merge/untoggle over
// InlineSpan[] — the pure core under the toggleMark/setLink commands.

import { describe, expect, it } from 'vitest'
import { Attr, InlineSpan, Mark, Value, attrGetStr, markedSpan, span, spansText, spanWith } from '../../parser/block-model'
import { marksAtRange, setLinkOnSpans, toggleMarkOnSpans } from '../engine/marks'

function round(spans: InlineSpan[]): string[] {
  return spans.map((s) => `${spansText([s])}|${s.marks.join(',') || '-'}|${s.attrs.map((a) => `${a.key}=${attrGetStr([a], a.key, '')}`).join(',')}`)
}

describe('toggleMarkOnSpans', () => {
  it('splits a span when the range covers it partially (跨界切分)', () => {
    const out = toggleMarkOnSpans([span('hello world')], 0, 5, Mark.Strong)
    expect(round(out)).toEqual(['hello|0|', ' world|-|'])
    expect(out[0].marks).toContain(Mark.Strong)
    expect(out[1].marks).not.toContain(Mark.Strong)
  })

  it('Underline toggles through the same resplit core (plan 028 P2T2)', () => {
    const out = toggleMarkOnSpans([span('hello world')], 0, 5, Mark.Underline)
    expect(round(out)).toEqual(['hello|6|', ' world|-|'])
    expect(out[0].marks).toContain(Mark.Underline)
  })

  it('merges adjacent spans that end up with the same marks (同 mark 合并)', () => {
    const out = toggleMarkOnSpans([span('ab'), span('cd')], 0, 4, Mark.Strong)
    expect(out).toHaveLength(1)
    expect(out[0].text).toBe('abcd')
    expect(out[0].marks).toEqual([Mark.Strong])
  })

  it('untoggles when every char in range already has the mark, splitting the tail (取消部分覆盖)', () => {
    const out = toggleMarkOnSpans([markedSpan('hello world', [Mark.Strong])], 3, 8, Mark.Strong)
    expect(round(out)).toEqual(['hel|0|', 'lo wo|-|', 'rld|0|'])
  })

  it('adds (not removes) when the range only partially has the mark (toggle 判据)', () => {
    const out = toggleMarkOnSpans([markedSpan('a', [Mark.Strong]), span('b')], 0, 2, Mark.Strong)
    expect(out).toHaveLength(1)
    expect(out[0].text).toBe('ab')
    expect(out[0].marks).toEqual([Mark.Strong])
  })

  it('keeps sibling marks when removing one (嵌套保持)', () => {
    const out = toggleMarkOnSpans([spanWith('ab', [Mark.Strong, Mark.Em], [])], 0, 2, Mark.Strong)
    expect(out).toHaveLength(1)
    expect(out[0].marks).toEqual([Mark.Em])
  })

  it('keeps attrs on the unmarked remainder of a split link span', () => {
    const linked = [spanWith('ab', [Mark.Link], [new Attr('href', Value.Str('https://x'))])]
    const out = toggleMarkOnSpans(linked, 0, 1, Mark.Strong)
    expect(out).toHaveLength(2)
    expect(out[0].text).toBe('a')
    expect(out[0].marks).toEqual(expect.arrayContaining([Mark.Strong, Mark.Link]))
    expect(attrGetStr(out[0].attrs, 'href', '')).toBe('https://x')
    expect(out[1].marks).toEqual([Mark.Link])
    expect(attrGetStr(out[1].attrs, 'href', '')).toBe('https://x')
  })

  it('is a no-op on an empty or out-of-range selection', () => {
    const spans = [span('abc')]
    expect(toggleMarkOnSpans(spans, 1, 1, Mark.Strong)).toBe(spans)
    expect(toggleMarkOnSpans(spans, 10, 12, Mark.Strong)).toBe(spans)
  })
})

describe('setLinkOnSpans', () => {
  it('wraps the range with Link + href attr', () => {
    const out = setLinkOnSpans([span('hello world')], 0, 5, 'https://example.com')
    expect(out).toHaveLength(2)
    expect(out[0].marks).toContain(Mark.Link)
    expect(attrGetStr(out[0].attrs, 'href', '')).toBe('https://example.com')
    expect(out[1].marks).not.toContain(Mark.Link)
  })

  it('replaces an existing href on re-link', () => {
    const linked = [spanWith('ab', [Mark.Link], [new Attr('href', Value.Str('https://old'))])]
    const out = setLinkOnSpans(linked, 0, 2, 'https://new')
    expect(out).toHaveLength(1)
    expect(attrGetStr(out[0].attrs, 'href', '')).toBe('https://new')
  })

  it('keeps other marks inside the linked range', () => {
    const out = setLinkOnSpans([markedSpan('ab', [Mark.Em])], 0, 2, 'https://x')
    expect(out[0].marks).toEqual(expect.arrayContaining([Mark.Em, Mark.Link]))
  })
})

describe('marksAtRange', () => {
  it('intersects marks across the covered spans', () => {
    const spans = [markedSpan('ab', [Mark.Strong, Mark.Em]), markedSpan('cd', [Mark.Strong])]
    expect(marksAtRange(spans, 0, 4)).toEqual([Mark.Strong])
    expect(marksAtRange(spans, 0, 2)).toEqual(expect.arrayContaining([Mark.Strong, Mark.Em]))
  })

  it('reads the enclosing span for a collapsed range', () => {
    const spans = [markedSpan('ab', [Mark.Em]), span('cd')]
    expect(marksAtRange(spans, 1, 1)).toEqual([Mark.Em])
    expect(marksAtRange(spans, 3, 3)).toEqual([])
  })

  it('returns [] for an empty spans list', () => {
    expect(marksAtRange([], 0, 0)).toEqual([])
  })
})
