// Inline input rules (plan-062 T-02): pure matcher matrix + engine-level
// transform contracts. The matcher is pure text — every guard branch is
// covered without a host; the transform tests drive a real EditorEngine the
// same way the host wiring does (typed text in, fire, assert spans/caret/
// undo).
// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import {
  BlockPos,
  InsertTextOp,
  Mark,
  Op,
  blockText,
} from '../../parser/block-model'
import { parse_blocks } from '../../parser/markdown-parser'
import { EditorEngine } from '../engine/editor-engine'
import { INLINE_INPUT_RULES, fireInlineRuleOn, matchInlineRule } from '../engine/inline-input-rules'

function engineWith(): { engine: EditorEngine; blockId: string } {
  // parse_blocks('') yields a childless root — seed one block, then clear its
  // text so every transform test starts from a truly empty leaf.
  const engine = new EditorEngine(parse_blocks('seed', true))
  const blockId = engine.doc.children[0].id
  engine.applyTree((t) => ({
    ...t,
    children: t.children.map((b) => (b.id === blockId ? { ...b, inlines: [] } : b)),
  }))
  return { engine, blockId }
}

/** Simulate flow typing: append chars/chunks at the tail (the coalescing
 *  apply path the host's onInput performs per input event). */
function type(engine: EditorEngine, blockId: string, text: string): void {
  const at = blockText(engine.doc.children[0]).length
  engine.apply(Op.InsertText(new InsertTextOp(new BlockPos(blockId, at), text)))
}
function typeChunks(engine: EditorEngine, blockId: string, chunks: string[]): void {
  for (const c of chunks) type(engine, blockId, c)
}
function tail(engine: EditorEngine): string {
  return blockText(engine.doc.children[0])
}

describe('matchInlineRule matrix', () => {
  it('longest-first ordering in the data table', () => {
    const markers = INLINE_INPUT_RULES.map((r) => r.marker)
    const sorted = [...markers].sort((a, b) => b.length - a.length)
    expect(markers).toEqual(sorted)
  })

  it('fires strong / em / del / code at the closing marker', () => {
    expect(matchInlineRule('x **agc**', 9)).toMatchObject({ start: 2, end: 9, innerStart: 4, innerLen: 3, mark: Mark.Strong })
    expect(matchInlineRule('x *agc*', 7)).toMatchObject({ start: 2, end: 7, innerStart: 3, innerLen: 3, mark: Mark.Em })
    expect(matchInlineRule('~~agc~~', 7)).toMatchObject({ start: 0, end: 7, innerStart: 2, innerLen: 3, mark: Mark.Del })
    expect(matchInlineRule('`agc`', 5)).toMatchObject({ start: 0, end: 5, innerStart: 1, innerLen: 3, mark: Mark.Code })
  })

  it('unclosed / no opener / empty inner → null', () => {
    expect(matchInlineRule('x **agc', 7)).toBeNull()
    expect(matchInlineRule('agc**', 5)).toBeNull()
    expect(matchInlineRule('**', 2)).toBeNull()
    expect(matchInlineRule('****', 4)).toBeNull()
  })

  it('AC-04: **a* does not let the * rule poach the ** opener tail', () => {
    expect(matchInlineRule('**a*', 4)).toBeNull()
  })

  it('AC-04: escaped marker never opens or closes', () => {
    expect(matchInlineRule('a \\*b*', 5)).toBeNull()
    expect(matchInlineRule('a\\*b\\*', 5)).toBeNull()
  })

  it('crossline regions never fire', () => {
    expect(matchInlineRule('**a\nb**', 7)).toBeNull()
  })

  it('nested: inner em inside strong text fires em on the inner close', () => {
    expect(matchInlineRule('**a *b*', 7)).toMatchObject({ start: 4, end: 7, innerStart: 5, innerLen: 1, mark: Mark.Em })
  })

  it('caret bounds: caret 0 / beyond end → null', () => {
    expect(matchInlineRule('**a**', 0)).toBeNull()
    expect(matchInlineRule('**a**', 99)).toBeNull()
  })
})

describe('fireInlineRuleOn transform', () => {
  it('AC-01/02: **agc** converts, marker gone, cursor after the mark', () => {
    const { engine, blockId } = engineWith()
    typeChunks(engine, blockId, ['**', 'agc', '*', '*'])
    expect(fireInlineRuleOn(engine, blockId)).toBe(true)
    const found = engine.doc.children[0]
    expect(tail(engine)).toBe('agc')
    const bold = found.inlines.find((s) => s.text === 'agc')
    expect(bold?.marks).toContain(Mark.Strong)
    expect(engine.selection.anchor.offset).toBe(3)
    expect(engine.selection.head.offset).toBe(3)
  })

  it('AC-03: one undo reverts to the typed marker text', () => {
    const { engine, blockId } = engineWith()
    typeChunks(engine, blockId, ['**', 'agc', '**'])
    expect(fireInlineRuleOn(engine, blockId)).toBe(true)
    expect(engine.undo()).toBe(true)
    expect(tail(engine)).toBe('**agc**')
  })

  it('AC-04: Code-marked region never fires', () => {
    const { engine, blockId } = engineWith()
    type(engine, blockId, 'y')
    // mark the "y" as Code directly on the block's inlines (the same surface
    // the marks resplit commands write)
    const found = engine.doc.children[0]
    engine.applyTree((t) => {
      const b = t.children[0]
      return {
        ...t,
        children: [
          {
            ...b,
            inlines: b.inlines.map((s) =>
              s.text === 'y' ? { ...s, marks: [...s.marks, Mark.Code] } : s,
            ),
          },
        ],
      }
    })
    expect(blockText(found)).toBe('y')
    // wrap the code char with an em pair via explicit-offset inserts so the
    // match region [0,3) covers the Code-marked "y"
    const at0 = blockText(found).length
    void at0
    engine.apply(Op.InsertText(new InsertTextOp(new BlockPos(blockId, 0), '*')))
    engine.apply(Op.InsertText(new InsertTextOp(new BlockPos(blockId, 2), '*')))
    expect(blockText(engine.doc.children[0])).toBe('*y*')
    // region "*y*" covers the Code-marked y → the em rule must NOT fire
    expect(fireInlineRuleOn(engine, blockId)).toBe(false)
  })

  it('no match → returns false without touching the engine', () => {
    const { engine, blockId } = engineWith()
    const before = engine.doc
    expect(fireInlineRuleOn(engine, blockId)).toBe(false)
    expect(engine.doc).toBe(before)
  })
})
