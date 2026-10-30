// Command layer + extended ops tests (plan 018 Phase 2/3): every command is
// ONE undo step and lands as the documented tree shape.

import { describe, expect, it } from 'vitest'
import {
  BlockNode,
  BlockType,
  Mark,
  Selection,
  block,
  blockText,
  collapsedSel,
  findBlock,
  leafBlock,
  markedSpan,
  pos,
  span,
  withChildren,
  withInlines,
} from '../../parser/block-model'
import { serialize } from '../../parser/serializer'
import { EditorEngine } from '../engine/editor-engine'
import {
  focusBlock,
  insertTemplate,
  marksInRange,
  moveBlock,
  setBlockAttrs,
  setLink,
  tableAddColumn,
  tableAddRow,
  tableDeleteColumn,
  tableDeleteRow,
  toggleMark,
} from '../engine/commands'
import { Value } from '../../parser/block-model'

function doc(...kids: BlockNode[]): BlockNode {
  return withChildren(block('doc', BlockType.Paragraph), kids)
}

function table(id: string, rows: string[][]): BlockNode {
  return withChildren(
    block(id, BlockType.Table),
    rows.map((cells, ri) =>
      withChildren(
        block(`${id}-r${ri}`, BlockType.TableRow),
        cells.map((c, ci) => leafBlock(`${id}-r${ri}c${ci}`, BlockType.TableCell, c))
      )
    )
  )
}

describe('command layer', () => {
  it('insertTemplate replaces the anchor and is one undo step', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, '')), collapsedSel('p1', 0))
    insertTemplate(e, 'p1', [
      leafBlock('t-h', BlockType.Heading, 'Title'),
      leafBlock('t-p', BlockType.Paragraph, 'body'),
    ])
    expect(e.doc.children.map((c) => c.kind)).toEqual([BlockType.Heading, BlockType.Paragraph])
    e.undo()
    expect(e.doc.children).toHaveLength(1)
    expect(e.doc.children[0].id).toBe('p1')
  })

  it('focusBlock moves the selection without history', () => {
    const e = new EditorEngine(
      doc(leafBlock('p1', BlockType.Paragraph, 'a'), leafBlock('p2', BlockType.Paragraph, 'b')),
      collapsedSel('p1', 0)
    )
    focusBlock(e, 'p2', 1)
    expect(e.selection.anchor.blockId).toBe('p2')
    expect(e.selection.anchor.offset).toBe(1)
    expect(e.canUndo).toBe(false)
  })

  it('replaceSelection swaps the selection block', () => {
    const e = new EditorEngine(
      doc(leafBlock('p1', BlockType.Paragraph, 'a'), leafBlock('p2', BlockType.Paragraph, 'b')),
      collapsedSel('p2', 0)
    )
    insertTemplate(e, 'p2', [leafBlock('q', BlockType.Blockquote, 'quoted')])
    expect(e.doc.children[1].kind).toBe(BlockType.Blockquote)
  })
})

describe('table extended ops', () => {
  it('add row after the anchor row; undo restores', () => {
    const e = new EditorEngine(doc(table('t1', [['a', 'b'], ['c', 'd']])), collapsedSel('t1-r0c0', 0))
    tableAddRow(e, 't1', 't1-r0')
    const t = findBlock(e.doc, 't1')!
    expect(t.children).toHaveLength(3)
    const added = t.children[1]
    expect(added.kind).toBe(BlockType.TableRow)
    expect(added.children).toHaveLength(2)
    expect(added.children.every((c) => blockText(c) === '')).toBe(true)
    e.undo()
    expect(findBlock(e.doc, 't1')!.children).toHaveLength(2)
  })

  it('delete row drops only that row', () => {
    const e = new EditorEngine(doc(table('t1', [['a', 'b'], ['c', 'd']])), collapsedSel('t1-r0c0', 0))
    tableDeleteRow(e, 't1-r1')
    const t = findBlock(e.doc, 't1')!
    expect(t.children).toHaveLength(1)
    expect(blockText(t.children[0].children[0])).toBe('a')
  })

  it('add/delete column touches every row', () => {
    const e = new EditorEngine(doc(table('t1', [['a', 'b'], ['c', 'd']])), collapsedSel('t1-r0c0', 0))
    tableAddColumn(e, 't1')
    expect(findBlock(e.doc, 't1')!.children.every((r) => r.children.length === 3)).toBe(true)
    tableDeleteColumn(e, 't1')
    expect(findBlock(e.doc, 't1')!.children.every((r) => r.children.length === 2)).toBe(true)
  })
})

describe('moveBlock / setBlockAttrs', () => {
  it('moves a block down one slot; boundary is a no-op', () => {
    const e = new EditorEngine(
      doc(leafBlock('p1', BlockType.Paragraph, 'a'), leafBlock('p2', BlockType.Paragraph, 'b'), leafBlock('p3', BlockType.Paragraph, 'c')),
      collapsedSel('p1', 0)
    )
    moveBlock(e, 'p1', 1)
    expect(e.doc.children.map((c) => c.id)).toEqual(['p2', 'p1', 'p3'])
    e.undo()
    expect(e.doc.children.map((c) => c.id)).toEqual(['p1', 'p2', 'p3'])
    moveBlock(e, 'p3', 1) // last block — boundary no-op
    expect(e.doc.children.map((c) => c.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('setBlockAttrs patches attrs as one undo step (heading level)', () => {
    const e = new EditorEngine(doc(leafBlock('h1', BlockType.Heading, 'T')), collapsedSel('h1', 0))
    setBlockAttrs(e, 'h1', [{ key: 'level', value: Value.Int(2) }])
    const found = findBlock(e.doc, 'h1') as any
    expect(found.attrs.some((a: any) => a.key === 'level')).toBe(true)
    e.undo()
    expect((findBlock(e.doc, 'h1') as any).attrs.some((a: any) => a.key === 'level')).toBe(false)
  })
})

// -- mark commands (plan 024 Phase 0): one undo step, serialize roundtrip ------

describe('mark commands', () => {
  it('toggleMark bolds the range, serializes **b**, and undoes in one step', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, 'abc')), collapsedSel('p1', 0))
    toggleMark(e, 'p1', 0, 1, Mark.Strong)
    expect(serialize(e.doc, false)).toContain('**a**bc')
    expect(marksInRange(e, collapsedSel('p1', 0))).toContain(Mark.Strong)
    const rangeSel = new Selection(pos('p1', 0), pos('p1', 1))
    expect(marksInRange(e, rangeSel)).toContain(Mark.Strong)
    e.undo()
    expect(serialize(e.doc, false)).toBe('abc\n')
    expect(e.canUndo).toBe(false)
  })

  it('toggleMark twice returns to the plain single-span shape', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, 'ab')), collapsedSel('p1', 0))
    toggleMark(e, 'p1', 0, 2, Mark.Strong)
    toggleMark(e, 'p1', 0, 2, Mark.Strong)
    const found = findBlock(e.doc, 'p1')!
    expect(found.inlines).toHaveLength(1)
    expect(found.inlines[0].marks).toHaveLength(0)
  })

  it('setLink writes the href attr and serializes [text](href)', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, 'ab')), collapsedSel('p1', 0))
    setLink(e, 'p1', 0, 2, 'https://example.com')
    expect(serialize(e.doc, false)).toContain('[ab](https://example.com)')
    e.undo()
    expect(serialize(e.doc, false)).toBe('ab\n')
  })

  it('marksInRange intersects over the covered spans of the selection', () => {
    const spans = [markedSpan('ab', [Mark.Em]), span('cd')]
    const e = new EditorEngine(withInlines(leafBlock('p1', BlockType.Paragraph, ''), spans), collapsedSel('p1', 0))
    const half = new Selection(pos('p1', 0), pos('p1', 2))
    expect(marksInRange(e, half)).toContain(Mark.Em)
    const full = new Selection(pos('p1', 0), pos('p1', 4))
    expect(marksInRange(e, full)).toEqual([])
  })
})
