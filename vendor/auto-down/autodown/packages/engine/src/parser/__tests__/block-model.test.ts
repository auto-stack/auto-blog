// Tests for the unified block model (auto/block_model.at -> ../block-model.ts).
// Every op gets >= 3 cases: positive / negative (no-op) / boundary, plus
// invertOp roundtrips. Assertions target semantic shape (ids, kinds, flattened
// text, selection) rather than exact span topology where an op legitimately
// re-segments spans (split/merge/replace roundtrips).

import { describe, expect, it } from 'vitest'
import {
  Attr,
  BlockNode,
  BlockPos,
  BlockType,
  EditResult,
  InsertTextOp,
  LiftBlockOp,
  Mark,
  MergeBlocksOp,
  Op,
  ReplaceRangeOp,
  SetBlockTypeOp,
  SplitBlockOp,
  Value,
  WrapBlockOp,
  addMark,
  applyOp,
  attrDel,
  attrGetInt,
  attrGetStr,
  attrSet,
  block,
  blockText,
  childIndex,
  collapsedSel,
  delMark,
  findBlock,
  hasMark,
  invertOp,
  leafBlock,
  markedSpan,
  parentOf,
  pathOf,
  pos,
  span,
  spansDelete,
  spansInsert,
  spansSplitAt,
  withChildren,
  withInlines,
} from '../block-model'

// -- tree builders -----------------------------------------------------------

/** doc root with the given blocks as children */
function doc(...kids: BlockNode[]): BlockNode {
  return withChildren(block('doc', BlockType.Paragraph), kids)
}

function quote(id: string, ...kids: BlockNode[]): BlockNode {
  return withChildren(block(id, BlockType.Blockquote), kids)
}

/** serializable summary: [id, kind, text] with nested children */
function summary(n: BlockNode): unknown[] {
  const kids = n.children.map(summary)
  const base: unknown[] = [n.id, BlockType[n.kind], blockText(n)]
  return kids.length > 0 ? [...base, kids] : base
}

function apply(tree: BlockNode, op: Op): EditResult {
  return applyOp(tree, collapsedSel('', 0), op)
}

// -- lookup helpers ----------------------------------------------------------

describe('lookup helpers', () => {
  const tree = doc(
    leafBlock('p1', BlockType.Paragraph, 'one'),
    quote('q1', leafBlock('p2', BlockType.Paragraph, 'two')),
  )

  it('findBlock finds nested blocks', () => {
    expect(findBlock(tree, 'p2')?.kind).toBe(BlockType.Paragraph)
    expect(blockText(findBlock(tree, 'p2')!)).toBe('two')
  })

  it('findBlock returns null for missing ids', () => {
    expect(findBlock(tree, 'nope')).toBeNull()
  })

  it('pathOf returns root-to-target ids', () => {
    expect(pathOf(tree, 'p2')).toEqual(['doc', 'q1', 'p2'])
    expect(pathOf(tree, 'doc')).toEqual(['doc'])
  })

  it('pathOf returns empty for missing ids', () => {
    expect(pathOf(tree, 'nope')).toEqual([])
  })

  it('parentOf finds the direct parent', () => {
    expect(parentOf(tree, 'p2')?.id).toBe('q1')
    expect(parentOf(tree, 'p1')?.id).toBe('doc')
    expect(parentOf(tree, 'doc')).toBeNull()
  })

  it('childIndex locates direct children only', () => {
    expect(childIndex(tree, 'p1')).toBe(0)
    expect(childIndex(tree, 'p2')).toBe(-1)
  })
})

// -- attrs / marks / spans ---------------------------------------------------

describe('attrs, marks, spans', () => {
  it('attrSet upserts and appends; typed getters fall back to defaults', () => {
    let attrs: Attr[] = []
    attrs = attrSet(attrs, 'level', Value.Int(2))
    attrs = attrSet(attrs, 'language', Value.Str('ts'))
    attrs = attrSet(attrs, 'level', Value.Int(3))
    expect(attrs).toHaveLength(2)
    expect(attrGetInt(attrs, 'level', 0)).toBe(3)
    expect(attrGetStr(attrs, 'language', '')).toBe('ts')
    expect(attrGetStr(attrs, 'missing', 'dflt')).toBe('dflt')
    // wrong-variant value yields the default
    expect(attrGetStr(attrs, 'level', 'dflt')).toBe('dflt')
  })

  it('attrDel removes by key', () => {
    const attrs = attrDel([new Attr('a', Value.Int(1)), new Attr('b', Value.Int(2))], 'a')
    expect(attrs.map((a) => a.key)).toEqual(['b'])
  })

  it('addMark dedups, delMark removes', () => {
    let marks: Mark[] = []
    marks = addMark(marks, Mark.Strong)
    marks = addMark(marks, Mark.Strong)
    marks = addMark(marks, Mark.Em)
    expect(marks).toEqual([Mark.Strong, Mark.Em])
    expect(hasMark(marks, Mark.Em)).toBe(true)
    expect(delMark(marks, Mark.Strong)).toEqual([Mark.Em])
  })

  it('spansInsert lands inside the containing span (extends its marks)', () => {
    const spans = [span('ab'), markedSpan('cd', [Mark.Strong])]
    // boundary offset 2 goes into the left span
    expect(spansInsert(spans, 2, 'X').map((s) => [s.text, s.marks])).toEqual([
      ['abX', []],
      ['cd', [Mark.Strong]],
    ])
    // offset 3 is inside the strong span
    expect(spansInsert(spans, 3, 'X').map((s) => [s.text, s.marks])).toEqual([
      ['ab', []],
      ['cXd', [Mark.Strong]],
    ])
  })

  it('spansDelete trims across span boundaries and drops empty spans', () => {
    const spans = [span('ab'), markedSpan('cd', [Mark.Code]), span('ef')]
    const out = spansDelete(spans, 1, 5)
    expect(out.map((s) => [s.text, s.marks])).toEqual([
      ['a', []],
      ['f', []],
    ])
  })

  it('spansSplitAt splits inside a span, duplicating marks', () => {
    const split = spansSplitAt([markedSpan('abcd', [Mark.Em])], 2)
    expect(split.before.map((s) => [s.text, s.marks])).toEqual([['ab', [Mark.Em]]])
    expect(split.after.map((s) => [s.text, s.marks])).toEqual([['cd', [Mark.Em]]])
  })
})

// -- insert_text -------------------------------------------------------------

describe('insert_text', () => {
  const tree = doc(leafBlock('p1', BlockType.Paragraph, 'hello'))

  it('positive: inserts mid-text and collapses the selection after the insert', () => {
    const r = applyOp(tree, collapsedSel('p1', 2), Op.InsertText(new InsertTextOp(pos('p1', 2), 'XY')))
    expect(blockText(findBlock(r.tree, 'p1')!)).toBe('heXYllo')
    expect(r.selection.head).toEqual(new BlockPos('p1', 4))
  })

  it('negative: missing block id leaves tree and selection unchanged', () => {
    const r = applyOp(tree, collapsedSel('p1', 1), Op.InsertText(new InsertTextOp(pos('nope', 0), 'X')))
    expect(r.tree).toEqual(tree)
    expect(r.selection.head).toEqual(new BlockPos('p1', 1))
  })

  it('boundary: offset 0 inserts at the start; past-the-end appends', () => {
    const atStart = apply(tree, Op.InsertText(new InsertTextOp(pos('p1', 0), 'X')))
    expect(blockText(findBlock(atStart.tree, 'p1')!)).toBe('Xhello')
    const atEnd = apply(tree, Op.InsertText(new InsertTextOp(pos('p1', 99), 'X')))
    expect(blockText(findBlock(atEnd.tree, 'p1')!)).toBe('helloX')
  })
})

// -- split_block -------------------------------------------------------------

describe('split_block', () => {
  const heading = withInlines(
    Object.assign(block('h1', BlockType.Heading), { attrs: [new Attr('level', Value.Int(2))] }),
    [span('hello')],
  )
  const tree = doc(heading, leafBlock('p1', BlockType.Paragraph, 'tail'))

  it('positive: heading split demotes the tail to Paragraph, cursor to the new block start', () => {
    const r = apply(tree, Op.SplitBlock(new SplitBlockOp(pos('h1', 2), 'h2')))
    expect(summary(r.tree)).toEqual([
      'doc',
      'Paragraph',
      '',
      [
        ['h1', 'Heading', 'he'],
        ['h2', 'Paragraph', 'llo'],
        ['p1', 'Paragraph', 'tail'],
      ],
    ])
    expect(r.selection.head).toEqual(new BlockPos('h2', 0))
  })

  it('positive: the head keeps heading attrs, the demoted tail drops them', () => {
    const r = apply(tree, Op.SplitBlock(new SplitBlockOp(pos('h1', 2), 'h2')))
    expect(attrGetInt(findBlock(r.tree, 'h1')!.attrs, 'level', 0)).toBe(2)
    expect(attrGetInt(findBlock(r.tree, 'h2')!.attrs, 'level', 0)).toBe(0)
  })

  it('invariant: undoing a merge into a heading round-trips the tail to Paragraph', () => {
    const merge = Op.MergeBlocks(new MergeBlocksOp('h1', 'p1'))
    const undo = invertOp(tree, merge) // junction from the PRE-merge tree
    const merged = apply(tree, merge)
    expect(findBlock(merged.tree, 'h1')!.kind).toBe(BlockType.Heading)
    expect(blockText(findBlock(merged.tree, 'h1')!)).toBe('hellotail')
    const r = apply(merged.tree, undo)
    expect(summary(r.tree)).toEqual([
      'doc',
      'Paragraph',
      '',
      [
        ['h1', 'Heading', 'hello'],
        ['p1', 'Paragraph', 'tail'],
      ],
    ])
  })

  it('negative: missing block id leaves the tree unchanged', () => {
    const r = apply(tree, Op.SplitBlock(new SplitBlockOp(pos('nope', 0), 'x')))
    expect(r.tree).toEqual(tree)
  })

  it('boundary: split at the end yields an empty right block', () => {
    const r = apply(tree, Op.SplitBlock(new SplitBlockOp(pos('p1', 4), 'p2')))
    expect(blockText(findBlock(r.tree, 'p1')!)).toBe('tail')
    expect(blockText(findBlock(r.tree, 'p2')!)).toBe('')
  })
})

// -- merge_blocks ------------------------------------------------------------

describe('merge_blocks', () => {
  const tree = doc(
    leafBlock('a', BlockType.Paragraph, 'ab'),
    leafBlock('b', BlockType.Paragraph, 'cd'),
    leafBlock('c', BlockType.Paragraph, 'ef'),
  )

  it('positive: b is folded into a, cursor at the junction', () => {
    const r = apply(tree, Op.MergeBlocks(new MergeBlocksOp('a', 'b')))
    expect(summary(r.tree)).toEqual([
      'doc',
      'Paragraph',
      '',
      [
        ['a', 'Paragraph', 'abcd'],
        ['c', 'Paragraph', 'ef'],
      ],
    ])
    expect(r.selection.head).toEqual(new BlockPos('a', 2))
  })

  it('negative: missing second id leaves the tree unchanged', () => {
    const r = apply(tree, Op.MergeBlocks(new MergeBlocksOp('a', 'nope')))
    expect(r.tree).toEqual(tree)
  })

  it('boundary: merging an empty block just removes it', () => {
    const r = apply(tree, Op.MergeBlocks(new MergeBlocksOp('a', 'c')))
    expect(findBlock(r.tree, 'c')).toBeNull()
    expect(blockText(findBlock(r.tree, 'a')!)).toBe('abef')
  })
})

// -- set_block_type ----------------------------------------------------------

describe('set_block_type', () => {
  const tree = doc(leafBlock('p1', BlockType.Paragraph, 'hello'))

  it('positive: paragraph becomes heading, content preserved', () => {
    const r = apply(tree, Op.SetBlockType(new SetBlockTypeOp('p1', BlockType.Heading)))
    const b = findBlock(r.tree, 'p1')!
    expect(b.kind).toBe(BlockType.Heading)
    expect(blockText(b)).toBe('hello')
  })

  it('negative: missing id leaves the tree unchanged', () => {
    const r = apply(tree, Op.SetBlockType(new SetBlockTypeOp('nope', BlockType.Heading)))
    expect(r.tree).toEqual(tree)
  })

  it('boundary: heading becomes paragraph (attrs like level are kept verbatim)', () => {
    const h = doc(
      withInlines(
        Object.assign(block('h1', BlockType.Heading), { attrs: [new Attr('level', Value.Int(3))] }),
        [span('t')],
      ),
    )
    const r = apply(h, Op.SetBlockType(new SetBlockTypeOp('h1', BlockType.Paragraph)))
    const b = findBlock(r.tree, 'h1')!
    expect(b.kind).toBe(BlockType.Paragraph)
    expect(attrGetInt(b.attrs, 'level', 0)).toBe(3)
  })
})

// -- lift_block --------------------------------------------------------------

describe('lift_block', () => {
  it('positive: sole child of a quote replaces the quote at the grandparent level', () => {
    const tree = doc(leafBlock('pre', BlockType.Paragraph, 'x'), quote('q1', leafBlock('p1', BlockType.Paragraph, 'in')))
    const r = apply(tree, Op.LiftBlock(new LiftBlockOp('p1')))
    expect(summary(r.tree)).toEqual([
      'doc',
      'Paragraph',
      '',
      [
        ['pre', 'Paragraph', 'x'],
        ['p1', 'Paragraph', 'in'],
      ],
    ])
  })

  it('negative: a top-level block has no wrapper to lift out of', () => {
    const tree = doc(leafBlock('p1', BlockType.Paragraph, 'x'))
    const r = apply(tree, Op.LiftBlock(new LiftBlockOp('p1')))
    expect(r.tree).toEqual(tree)
  })

  it('boundary: lifting the middle child splits the wrapper (after-part gets a -l id)', () => {
    const tree = doc(
      quote(
        'q1',
        leafBlock('p1', BlockType.Paragraph, 'a'),
        leafBlock('p2', BlockType.Paragraph, 'b'),
        leafBlock('p3', BlockType.Paragraph, 'c'),
      ),
    )
    const r = apply(tree, Op.LiftBlock(new LiftBlockOp('p2')))
    expect(summary(r.tree)).toEqual([
      'doc',
      'Paragraph',
      '',
      [
        ['q1', 'Blockquote', '', [['p1', 'Paragraph', 'a']]],
        ['p2', 'Paragraph', 'b'],
        ['q1-l', 'Blockquote', '', [['p3', 'Paragraph', 'c']]],
      ],
    ])
  })
})

// -- wrap_block --------------------------------------------------------------

describe('wrap_block', () => {
  const tree = doc(leafBlock('p1', BlockType.Paragraph, 'hello'))

  it('positive: paragraph wrapped in a fresh blockquote', () => {
    const r = apply(tree, Op.WrapBlock(new WrapBlockOp('p1', BlockType.Blockquote, 'q1')))
    expect(summary(r.tree)).toEqual([
      'doc',
      'Paragraph',
      '',
      [['q1', 'Blockquote', '', [['p1', 'Paragraph', 'hello']]]],
    ])
  })

  it('negative: missing id leaves the tree unchanged', () => {
    const r = apply(tree, Op.WrapBlock(new WrapBlockOp('nope', BlockType.Blockquote, 'q1')))
    expect(r.tree).toEqual(tree)
  })

  it('boundary: wrapping preserves the block subtree and keeps the selection valid', () => {
    const nested = doc(quote('q1', leafBlock('p1', BlockType.Paragraph, 'deep')))
    const sel = collapsedSel('p1', 2)
    const r = applyOp(nested, sel, Op.WrapBlock(new WrapBlockOp('q1', BlockType.Details, 'd1')))
    expect(pathOf(r.tree, 'p1')).toEqual(['doc', 'd1', 'q1', 'p1'])
    expect(r.selection).toEqual(sel)
  })
})

// -- replace_range -----------------------------------------------------------

describe('replace_range', () => {
  const tree = doc(
    leafBlock('p1', BlockType.Paragraph, 'ab'),
    leafBlock('p2', BlockType.Paragraph, 'cd'),
    leafBlock('p3', BlockType.Paragraph, 'ef'),
  )

  it('positive: same-block replace, selection collapses after the insert', () => {
    // "cd" with range [1,2) deletes "d", then inserts -> "cX"
    const sel = { anchor: pos('p2', 1), head: pos('p2', 2) }
    const r = applyOp(tree, collapsedSel('', 0), Op.ReplaceRange(new ReplaceRangeOp(sel, 'X')))
    expect(blockText(findBlock(r.tree, 'p2')!)).toBe('cX')
    expect(r.selection.head).toEqual(new BlockPos('p2', 2))
  })

  it('negative: anchor/head under different parents is a no-op (MVP limit)', () => {
    const nested = doc(quote('q1', leafBlock('p1', BlockType.Paragraph, 'ab')), leafBlock('p2', BlockType.Paragraph, 'cd'))
    const sel = { anchor: pos('p1', 0), head: pos('p2', 1) }
    const r = applyOp(nested, collapsedSel('', 0), Op.ReplaceRange(new ReplaceRangeOp(sel, 'X')))
    expect(r.tree).toEqual(nested)
  })

  it('boundary: reversed same-block selection behaves as the ordered range', () => {
    const sel = { anchor: pos('p2', 2), head: pos('p2', 1) }
    const r = applyOp(tree, collapsedSel('', 0), Op.ReplaceRange(new ReplaceRangeOp(sel, 'X')))
    expect(blockText(findBlock(r.tree, 'p2')!)).toBe('cX')
  })

  it('boundary: cross-block sibling range merges anchor/head text and drops the middle', () => {
    // "ab"@1 keeps "a"; "ef"@1 keeps "f"; p2 in between is dropped -> "aXf"
    const sel = { anchor: pos('p1', 1), head: pos('p3', 1) }
    const r = applyOp(tree, collapsedSel('', 0), Op.ReplaceRange(new ReplaceRangeOp(sel, 'X')))
    expect(summary(r.tree)).toEqual(['doc', 'Paragraph', '', [['p1', 'Paragraph', 'aXf']]])
    expect(r.selection.head).toEqual(new BlockPos('p1', 2))
  })
})

// -- invertOp roundtrips -----------------------------------------------------

describe('invertOp', () => {
  it('insert_text roundtrip restores the original text', () => {
    const tree = doc(leafBlock('p1', BlockType.Paragraph, 'hello'))
    const op = Op.InsertText(new InsertTextOp(pos('p1', 5), '!'))
    const r1 = apply(tree, op)
    const r2 = apply(r1.tree, invertOp(tree, op))
    expect(blockText(findBlock(r2.tree, 'p1')!)).toBe('hello')
  })

  it('split_block roundtrip restores text and block count', () => {
    const tree = doc(leafBlock('p1', BlockType.Paragraph, 'hello'))
    const op = Op.SplitBlock(new SplitBlockOp(pos('p1', 2), 'p2'))
    const r1 = apply(tree, op)
    expect(r1.tree.children).toHaveLength(2)
    const r2 = apply(r1.tree, invertOp(tree, op))
    expect(r2.tree.children).toHaveLength(1)
    expect(blockText(findBlock(r2.tree, 'p1')!)).toBe('hello')
  })

  it('merge_blocks roundtrip restores both blocks at the recorded junction', () => {
    const tree = doc(leafBlock('a', BlockType.Paragraph, 'ab'), leafBlock('b', BlockType.Paragraph, 'cd'))
    const op = Op.MergeBlocks(new MergeBlocksOp('a', 'b'))
    const r1 = apply(tree, op)
    const r2 = apply(r1.tree, invertOp(tree, op))
    expect(blockText(findBlock(r2.tree, 'a')!)).toBe('ab')
    expect(blockText(findBlock(r2.tree, 'b')!)).toBe('cd')
  })

  it('set_block_type roundtrip restores the original kind exactly', () => {
    const tree = doc(leafBlock('p1', BlockType.Paragraph, 'x'))
    const op = Op.SetBlockType(new SetBlockTypeOp('p1', BlockType.Heading))
    const r1 = apply(tree, op)
    const r2 = apply(r1.tree, invertOp(tree, op))
    expect(r2.tree).toEqual(tree)
  })

  it('wrap/lift are mutual inverses (sole-child wrapper)', () => {
    const tree = doc(quote('q1', leafBlock('p1', BlockType.Paragraph, 'x')))
    const lift = Op.LiftBlock(new LiftBlockOp('p1'))
    const r1 = apply(tree, lift)
    // inverse of lift is wrap back into a Blockquote with the original id
    const r2 = apply(r1.tree, invertOp(tree, lift))
    expect(summary(r2.tree)).toEqual(summary(tree))
    // and wrap inverts to lift
    const tree2 = doc(leafBlock('p1', BlockType.Paragraph, 'x'))
    const wrap = Op.WrapBlock(new WrapBlockOp('p1', BlockType.Blockquote, 'q1'))
    const w1 = apply(tree2, wrap)
    const w2 = apply(w1.tree, invertOp(tree2, wrap))
    expect(w2.tree).toEqual(tree2)
  })

  it('replace_range (same block) roundtrip restores the original text', () => {
    const tree = doc(leafBlock('p1', BlockType.Paragraph, 'hello'))
    const sel = { anchor: pos('p1', 1), head: pos('p1', 4) }
    const op = Op.ReplaceRange(new ReplaceRangeOp(sel, 'XX'))
    const r1 = apply(tree, op)
    expect(blockText(findBlock(r1.tree, 'p1')!)).toBe('hXXo')
    const r2 = apply(r1.tree, invertOp(tree, op))
    expect(blockText(findBlock(r2.tree, 'p1')!)).toBe('hello')
  })

  it('liftBlock of a root child inverts to a harmless set_block_type placeholder', () => {
    const tree = doc(leafBlock('p1', BlockType.Paragraph, 'x'))
    const inv = invertOp(tree, Op.LiftBlock(new LiftBlockOp('p1')))
    // documented degenerate inverse: no wrapper -> SetBlockType placeholder
    expect(inv._tag).toBe('SetBlockType')
  })
})

// -- snapshot ----------------------------------------------------------------

describe('op sequence snapshot', () => {
  it('a small editing session stays deterministic', () => {
    let tree = doc(leafBlock('p1', BlockType.Paragraph, 'hello world'))
    tree = apply(tree, Op.SetBlockType(new SetBlockTypeOp('p1', BlockType.Heading))).tree
    tree = apply(tree, Op.SplitBlock(new SplitBlockOp(pos('p1', 5), 'p2'))).tree
    tree = apply(tree, Op.WrapBlock(new WrapBlockOp('p2', BlockType.Blockquote, 'q1'))).tree
    tree = apply(tree, Op.InsertText(new InsertTextOp(pos('p2', 6), '!'))).tree
    expect(summary(tree)).toMatchSnapshot()
  })
})
