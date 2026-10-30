// List/quote structural commands (plan 025 Phase 0): every command is ONE
// undo step, lands as the documented container shape, and never leaves an
// empty ListBlock or a bare ListItem behind (dissolution guard).

import { describe, expect, it } from 'vitest'
import {
  BlockNode,
  BlockType,
  attrGetBool,
  attrOf,
  block,
  blockFull,
  blockText,
  collapsedSel,
  findBlock,
  leafBlock,
  rng,
  withChildren,
} from '../../parser/block-model'
import { Value } from '../../parser/block-model'
import { serialize } from '../../parser/serializer'
import { EditorEngine } from '../engine/editor-engine'
import {
  backspaceAtItemStart,
  enterInItem,
  enterInQuote,
  exitQuote,
  indentItem,
  outdentItem,
} from '../engine/list-commands'

function doc(...kids: BlockNode[]): BlockNode {
  return withChildren(block('doc', BlockType.Paragraph), kids)
}

function ul(id: string, ordered = false): BlockNode {
  const attrs = ordered ? [attrOf('ordered', Value.Bool(true)), attrOf('start', Value.Int(1))] : []
  return blockFull(id, BlockType.ListBlock, attrs, [], [], rng(0, 0))
}

function withItems(list: BlockNode, items: BlockNode[]): BlockNode {
  return withChildren(list, items)
}

function li(id: string, ...kids: BlockNode[]): BlockNode {
  return withChildren(block(id, BlockType.ListItem), kids)
}

function quote(id: string, ...kids: BlockNode[]): BlockNode {
  return withChildren(block(id, BlockType.Blockquote), kids)
}

const P = (id: string, text: string) => leafBlock(id, BlockType.Paragraph, text)

function md(e: EditorEngine): string {
  return serialize(e.doc, false)
}

describe('enterInItem', () => {
  it('splits the tail into a new ListItem right after the current one', () => {
    const e = new EditorEngine(
      doc(withItems(ul('l1'), [li('i1', P('p1', 'one two')), li('i2', P('p2', 'three'))])),
      collapsedSel('p1', 4)
    )
    enterInItem(e, 'p1', 4)
    const list = findBlock(e.doc, 'l1')!
    expect(list.children).toHaveLength(3)
    expect(list.children[0].id).toBe('i1')
    expect(list.children[2].id).toBe('i2')
    const newItem = list.children[1]
    expect(newItem.kind).toBe(BlockType.ListItem)
    expect(newItem.children.map((c) => c.kind)).toEqual([BlockType.Paragraph])
    expect(blockText(newItem.children[0])).toBe('two')
    expect(blockText(findBlock(e.doc, 'p1')!)).toBe('one ')
    // caret lands at the start of the new item's paragraph
    expect(e.selection.anchor.blockId).toBe(newItem.children[0].id)
    expect(e.selection.anchor.offset).toBe(0)
  })

  it('Enter at the item end appends an empty continuation item', () => {
    const e = new EditorEngine(doc(withItems(ul('l1'), [li('i1', P('p1', 'one'))])), collapsedSel('p1', 3))
    enterInItem(e, 'p1', 3)
    const list = findBlock(e.doc, 'l1')!
    expect(list.children).toHaveLength(2)
    expect(blockText(list.children[1].children[0])).toBe('')
    expect(e.selection.anchor.blockId).toBe(list.children[1].children[0].id)
  })

  it('Enter on an empty item exits the list; empty list dissolves', () => {
    const e = new EditorEngine(doc(withItems(ul('l1'), [li('i1', P('p1', ''))])), collapsedSel('p1', 0))
    enterInItem(e, 'p1', 0)
    expect(e.doc.children).toHaveLength(1)
    expect(e.doc.children[0].id).toBe('p1')
    expect(e.doc.children[0].kind).toBe(BlockType.Paragraph)
    expect(e.selection.anchor.blockId).toBe('p1')
  })

  it('exit keeps the remaining items; the paragraph lands after the list', () => {
    const e = new EditorEngine(
      doc(withItems(ul('l1'), [li('i1', P('p1', '')), li('i2', P('p2', 'three'))])),
      collapsedSel('p1', 0)
    )
    enterInItem(e, 'p1', 0)
    expect(e.doc.children.map((c) => c.kind)).toEqual([BlockType.ListBlock, BlockType.Paragraph])
    expect(e.doc.children[0].id).toBe('l1')
    expect(e.doc.children[1].id).toBe('p1')
    expect(findBlock(e.doc, 'l1')!.children).toHaveLength(1)
  })

  it('one undo step restores tree and selection', () => {
    const e = new EditorEngine(
      doc(withItems(ul('l1'), [li('i1', P('p1', 'one two'))]), P('tail', 'x')),
      collapsedSel('p1', 4)
    )
    enterInItem(e, 'p1', 4)
    expect(md(e)).toBe('- one \n- two\n\nx\n')
    e.undo()
    expect(md(e)).toBe('- one two\n\nx\n')
    expect(e.selection.anchor.blockId).toBe('p1')
    expect(e.selection.anchor.offset).toBe(4)
  })

  it('serializes the split list back to markdown', () => {
    const e = new EditorEngine(doc(withItems(ul('l1'), [li('i1', P('p1', 'one two'))])), collapsedSel('p1', 4))
    enterInItem(e, 'p1', 4)
    expect(md(e)).toBe('- one \n- two\n')
  })
})

describe('backspaceAtItemStart', () => {
  it('merges into the previous item; caret at the junction', () => {
    const e = new EditorEngine(
      doc(withItems(ul('l1'), [li('i1', P('p1', 'one ')), li('i2', P('p2', 'two'))])),
      collapsedSel('p2', 0)
    )
    backspaceAtItemStart(e, 'p2')
    const list = findBlock(e.doc, 'l1')!
    expect(list.children).toHaveLength(1)
    expect(list.children[0].id).toBe('i1')
    expect(blockText(list.children[0].children[0])).toBe('one two')
    expect(e.selection.anchor.blockId).toBe('p1')
    expect(e.selection.anchor.offset).toBe(4)
    expect(md(e)).toBe('- one two\n')
  })

  it('the merged item keeps the nested list of the removed item', () => {
    const e = new EditorEngine(
      doc(
        withItems(ul('l1'), [
          li('i1', P('p1', 'one ')),
          li('i2', P('p2', 'two'), withItems(ul('l2'), [li('i3', P('p3', 'deep'))])),
        ])
      ),
      collapsedSel('p2', 0)
    )
    backspaceAtItemStart(e, 'p2')
    const list = findBlock(e.doc, 'l1')!
    expect(list.children).toHaveLength(1)
    const item = list.children[0]
    expect(item.children.map((c) => c.kind)).toEqual([BlockType.Paragraph, BlockType.ListBlock])
    expect(blockText(item.children[0])).toBe('one two')
    expect(blockText(item.children[1].children[0].children[0])).toBe('deep')
  })

  it('first item lifts out in place; remaining list follows', () => {
    const e = new EditorEngine(
      doc(withItems(ul('l1'), [li('i1', P('p1', 'one')), li('i2', P('p2', 'two'))])),
      collapsedSel('p1', 0)
    )
    backspaceAtItemStart(e, 'p1')
    expect(e.doc.children.map((c) => c.kind)).toEqual([BlockType.Paragraph, BlockType.ListBlock])
    expect(e.doc.children[0].id).toBe('p1')
    expect(e.doc.children[0].kind).toBe(BlockType.Paragraph)
    expect(blockText(e.doc.children[0])).toBe('one')
    expect(e.selection.anchor.blockId).toBe('p1')
    expect(md(e)).toBe('one\n\n- two\n')
  })

  it('single item dissolves the whole list', () => {
    const e = new EditorEngine(doc(withItems(ul('l1'), [li('i1', P('p1', 'one'))])), collapsedSel('p1', 0))
    backspaceAtItemStart(e, 'p1')
    expect(e.doc.children).toHaveLength(1)
    expect(e.doc.children[0].kind).toBe(BlockType.Paragraph)
    expect(md(e)).toBe('one\n')
  })

  it('one undo step restores the merge', () => {
    const e = new EditorEngine(
      doc(withItems(ul('l1'), [li('i1', P('p1', 'one ')), li('i2', P('p2', 'two'))])),
      collapsedSel('p2', 0)
    )
    backspaceAtItemStart(e, 'p2')
    expect(md(e)).toBe('- one two\n')
    e.undo()
    expect(md(e)).toBe('- one \n- two\n')
    expect(e.selection.anchor.blockId).toBe('p2')
  })
})

describe('indentItem / outdentItem', () => {
  it('indent nests the item under the previous one (new nested list)', () => {
    const e = new EditorEngine(
      doc(withItems(ul('l1'), [li('i1', P('p1', 'one')), li('i2', P('p2', 'two'))])),
      collapsedSel('p2', 0)
    )
    indentItem(e, 'p2')
    const list = findBlock(e.doc, 'l1')!
    expect(list.children).toHaveLength(1)
    const item = list.children[0]
    expect(item.children.map((c) => c.kind)).toEqual([BlockType.Paragraph, BlockType.ListBlock])
    expect(item.children[1].children[0].id).toBe('i2')
    expect(md(e)).toBe('- one\n  - two\n')
    // focus survives inside the moved item
    expect(e.selection.anchor.blockId).toBe('p2')
  })

  it('indent copies the ordered attr to the nested list', () => {
    const e = new EditorEngine(
      doc(withItems(ul('l1', true), [li('i1', P('p1', 'one')), li('i2', P('p2', 'two'))])),
      collapsedSel('p2', 0)
    )
    indentItem(e, 'p2')
    const nested = findBlock(e.doc, 'l1')!.children[0].children[1]
    expect(nested.kind).toBe(BlockType.ListBlock)
    expect(attrGetBool(nested.attrs, 'ordered', false)).toBe(true)
    expect(md(e)).toBe('1. one\n   1. two\n')
  })

  it('indent appends to an existing nested list', () => {
    const e = new EditorEngine(
      doc(
        withItems(ul('l1'), [
          li('i1', P('p1', 'one'), withItems(ul('l2'), [li('i3', P('p3', 'deep'))])),
          li('i2', P('p2', 'two')),
        ])
      ),
      collapsedSel('p2', 0)
    )
    indentItem(e, 'p2')
    const nested = findBlock(e.doc, 'l2')!
    expect(nested.children.map((c) => c.id)).toEqual(['i3', 'i2'])
    expect(findBlock(e.doc, 'l1')!.children).toHaveLength(1)
    expect(md(e)).toBe('- one\n  - deep\n  - two\n')
  })

  it('indent on the first item is a no-op without history', () => {
    const e = new EditorEngine(
      doc(withItems(ul('l1'), [li('i1', P('p1', 'one')), li('i2', P('p2', 'two'))])),
      collapsedSel('p1', 0)
    )
    indentItem(e, 'p1')
    expect(md(e)).toBe('- one\n- two\n')
    expect(e.canUndo).toBe(false)
  })

  it('outdent lifts the item after its grandparent item; empty nested list dissolves', () => {
    const e = new EditorEngine(
      doc(
        withItems(ul('l1'), [
          li('i1', P('p1', 'one'), withItems(ul('l2'), [li('i2', P('p2', 'two'))])),
          li('i3', P('p3', 'three')),
        ])
      ),
      collapsedSel('p2', 0)
    )
    outdentItem(e, 'p2')
    const list = findBlock(e.doc, 'l1')!
    expect(list.children.map((c) => c.id)).toEqual(['i1', 'i2', 'i3'])
    expect(list.children[0].children.map((c) => c.kind)).toEqual([BlockType.Paragraph])
    expect(findBlock(e.doc, 'l2')).toBeNull()
    expect(md(e)).toBe('- one\n- two\n- three\n')
    expect(e.selection.anchor.blockId).toBe('p2')
  })

  it('outdent on a top-level item is a no-op without history', () => {
    const e = new EditorEngine(doc(withItems(ul('l1'), [li('i1', P('p1', 'one'))])), collapsedSel('p1', 0))
    outdentItem(e, 'p1')
    expect(md(e)).toBe('- one\n')
    expect(e.canUndo).toBe(false)
  })

  it('indent then outdent round-trips the markdown', () => {
    const e = new EditorEngine(
      doc(withItems(ul('l1'), [li('i1', P('p1', 'one')), li('i2', P('p2', 'two'))])),
      collapsedSel('p2', 0)
    )
    indentItem(e, 'p2')
    expect(md(e)).toBe('- one\n  - two\n')
    outdentItem(e, 'p2')
    expect(md(e)).toBe('- one\n- two\n')
    e.undo()
    expect(md(e)).toBe('- one\n  - two\n')
    e.undo()
    expect(md(e)).toBe('- one\n- two\n')
  })
})

describe('enterInQuote / exitQuote', () => {
  it('Enter splits the quote paragraph into a continuation paragraph', () => {
    const e = new EditorEngine(doc(quote('q1', P('p1', 'one two'))), collapsedSel('p1', 4))
    enterInQuote(e, 'p1', 4)
    const q = findBlock(e.doc, 'q1')!
    expect(q.children).toHaveLength(2)
    expect(blockText(q.children[0])).toBe('one ')
    expect(blockText(q.children[1])).toBe('two')
    expect(e.selection.anchor.blockId).toBe(q.children[1].id)
    expect(md(e)).toBe('> one \n>\n> two\n')
  })

  it('Enter on an empty quote paragraph exits; empty quote dissolves', () => {
    const e = new EditorEngine(doc(quote('q1', P('p1', ''))), collapsedSel('p1', 0))
    enterInQuote(e, 'p1', 0)
    expect(e.doc.children).toHaveLength(1)
    expect(e.doc.children[0].id).toBe('p1')
    expect(e.doc.children[0].kind).toBe(BlockType.Paragraph)
    expect(md(e)).toBe('')
  })

  it('exit keeps the remaining quote children; paragraph lands after the quote', () => {
    const e = new EditorEngine(doc(quote('q1', P('p1', 'one'), P('p2', ''))), collapsedSel('p2', 0))
    enterInQuote(e, 'p2', 0)
    expect(e.doc.children.map((c) => c.kind)).toEqual([BlockType.Blockquote, BlockType.Paragraph])
    expect(e.doc.children[0].id).toBe('q1')
    expect(e.doc.children[1].id).toBe('p2')
    expect(md(e)).toBe('> one\n\n\n')
  })

  it('exitQuote lifts the paragraph and dissolves an empty quote', () => {
    const e = new EditorEngine(doc(quote('q1', P('p1', 'one'))), collapsedSel('p1', 3))
    exitQuote(e, 'p1')
    expect(e.doc.children).toHaveLength(1)
    expect(e.doc.children[0].kind).toBe(BlockType.Paragraph)
    expect(blockText(e.doc.children[0])).toBe('one')
    expect(e.selection.anchor.blockId).toBe('p1')
    expect(md(e)).toBe('one\n')
  })

  it('exitQuote is one undo step', () => {
    const e = new EditorEngine(doc(P('top', 'x'), quote('q1', P('p1', 'one'))), collapsedSel('p1', 3))
    exitQuote(e, 'p1')
    expect(md(e)).toBe('x\n\none\n')
    e.undo()
    expect(md(e)).toBe('x\n\n> one\n')
    expect(e.selection.anchor.blockId).toBe('p1')
  })
})

describe('guards', () => {
  it('non-container paragraphs are untouched no-ops', () => {
    const e = new EditorEngine(doc(P('p1', 'plain')), collapsedSel('p1', 0))
    enterInItem(e, 'p1', 0)
    backspaceAtItemStart(e, 'p1')
    indentItem(e, 'p1')
    outdentItem(e, 'p1')
    enterInQuote(e, 'p1', 0)
    exitQuote(e, 'p1')
    expect(md(e)).toBe('plain\n')
    expect(e.canUndo).toBe(false)
  })

  it('unknown ids are no-ops', () => {
    const e = new EditorEngine(doc(P('p1', 'plain')), collapsedSel('p1', 0))
    enterInItem(e, 'nope', 0)
    indentItem(e, 'nope')
    outdentItem(e, 'nope')
    enterInQuote(e, 'nope', 0)
    exitQuote(e, 'nope')
    expect(md(e)).toBe('plain\n')
    expect(e.canUndo).toBe(false)
  })
})
