// MathInline view renderer (plan 036 T6): the 031 artifact contract's
// inline variant — katex at displayMode=false inside the carrier span;
// katex errors degrade to the source literal with the error as the hover
// hint (math block panel idiom).

import { describe, expect, it } from 'vitest'
import { renderNodes } from '../render-node'

function renderInline(inner: unknown): string {
  const vnode: any = renderNodes([{ type: 'paragraph', children: [inner] }], true)[0]
  return JSON.stringify(vnode)
}

describe('math_inline span renderer', () => {
  it('valid source renders the katex html inside the carrier span', () => {
    const out = renderInline({ type: 'math_inline', code: 'e=mc^2' })
    expect(out).toContain('autodown-math-inline')
    expect(out).toContain('data-math-src')
    expect(out).toContain('katex')
  })

  it('katex error degrades to the source literal with the error hint', () => {
    const out = renderInline({ type: 'math_inline', code: '\\notacommand{' })
    expect(out).toContain('autodown-math-error')
    expect(out).toContain('title')
    expect(out).toContain('\\\\notacommand{')
  })

  it('the source literal is the visible text on the error path', () => {
    const bad = '\\notacommand{'
    const vnode: any = renderNodes(
      [{ type: 'paragraph', children: [{ type: 'math_inline', code: bad }] }],
      true,
    )[0]
    const walk = (v: any): string => {
      if (typeof v === 'string') return v
      if (Array.isArray(v)) return v.map(walk).join('')
      if (Array.isArray(v?.children)) return v.children.map(walk).join('')
      if (v?.children && typeof v.children === 'object') return walk(v.children)
      return ''
    }
    expect(walk(vnode)).toContain(bad)
  })
})
