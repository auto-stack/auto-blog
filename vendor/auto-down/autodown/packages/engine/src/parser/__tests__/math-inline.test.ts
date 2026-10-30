// Inline math parsing (plan 036 T6, 待澄清① ruling): `$..$` with the
// siyuan-family enablement rules — non-space right of the opener, non-space
// left of the closer, no digit right after the closer, no newline inside;
// anything else stays literal (008 dialect philosophy). `\$` literalizes
// through the existing backslash-punctuation escape ($ is ASCII 36). The
// span carries the `math_inline` attr (src as both text and attr — the edit
// host shows the source literal per D4 v1); the view side renders katex
// (render-node, 031 artifact contract inline variant).

import { describe, expect, it } from 'vitest'
import { Mark, attrGetStr, spansText } from '../block-model'
import { parse_blocks } from '../markdown-parser'
import { serialize } from '../serializer'

const spansOf = (md: string) => parse_blocks(md, true).children[0]!.inlines

function findMath(md: string) {
  return spansOf(md).find((s) => attrGetStr(s.attrs, 'math_inline', '') !== '')
}

describe('math_inline parse → span model', () => {
  it('basic: $e=mc^2$ becomes a math span between text runs', () => {
    const spans = spansOf('数学 $e=mc^2$ 记号')
    expect(spans).toHaveLength(3)
    const math = spans[1]!
    expect(attrGetStr(math.attrs, 'math_inline', '')).toBe('e=mc^2')
    expect(math.text).toBe('e=mc^2')
    expect(math.marks).toHaveLength(0)
    // flat text = the source literal (D4 v1: the edit face shows the source)
    expect(spansText(spans)).toBe('数学 e=mc^2 记号')
  })

  it('inside strong: the mark propagates onto the math span', () => {
    const math = findMath('**加 $x^2$ 粗**')!
    expect(attrGetStr(math.attrs, 'math_inline', '')).toBe('x^2')
    expect(math.marks).toContain(Mark.Strong)
  })

  it('serializer emits $src$ symmetrically (byte-canonical)', () => {
    const src = '数学 $e=mc^2$ 记号\n'
    expect(serialize(parse_blocks(src, true), true)).toBe(src)
  })
})

describe('math_inline literal degradation (enablement rules)', () => {
  it.each([
    ['opener space', '$ x$'],
    ['closer space', '$x $'],
    ['both spaces', '$ x $'],
    ['digit after closer', '$100$5'],
    ['newline inside', 'a $x\ny$ b'],
    ['lone dollar', '成本 $5'],
  ])('%s stays literal', (_name, md) => {
    expect(findMath(md)).toBeUndefined()
  })

  it('degraded forms keep every character (flat-text conservation)', () => {
    expect(spansText(spansOf('$ x$'))).toBe('$ x$')
    expect(spansText(spansOf('$100$5'))).toBe('$100$5')
    expect(spansText(spansOf('成本 $5'))).toBe('成本 $5')
  })

  it('\\$ literalizes through the backslash escape', () => {
    expect(spansText(spansOf('价格 \\$5\\$'))).toBe('价格 $5$')
    expect(findMath('价格 \\$5\\$')).toBeUndefined()
  })

  it('degraded forms roundtrip byte-stable', () => {
    for (const src of ['$ x$\n', '$100$5\n', '成本 $5\n']) {
      expect(serialize(parse_blocks(src, true), true)).toBe(src)
    }
  })
})
