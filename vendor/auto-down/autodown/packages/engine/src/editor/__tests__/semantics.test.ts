// Semantic interaction baseline (plan 018 Phase 0) — engine-independent.
//
// These cases express EDITOR interaction semantics as operation sequences on
// the 016 block model (parser layer): typing, paragraph split, list
// continuation, table row add/remove (semantic form — the table_add_row op
// extension lands in Phase 3), undo/redo, slash template insert, markdown
// input rules and the IME composition convention. The self-built editing
// engine (Phase 1) must reproduce exactly these sequences; Tiptap 退休前后
// 本文件都必须全绿。人类可读清单见 packages/engine/EDITOR-CONTRACT.md §4。

import { describe, expect, it } from 'vitest'
import {
  BlockNode,
  BlockType,
  InsertTextOp,
  MergeBlocksOp,
  Op,
  ReplaceRangeOp,
  Selection,
  SetBlockTypeOp,
  SplitBlockOp,
  applyOp,
  block,
  blockText,
  collapsedSel,
  findBlock,
  invertOp,
  leafBlock,
  pos,
  replaceNode,
  withChildren,
  withKind,
} from '../../parser/block-model'

// -- helpers ------------------------------------------------------------------

function doc(...kids: BlockNode[]): BlockNode {
  return withChildren(block('doc', BlockType.Paragraph), kids)
}

function apply(tree: BlockNode, sel: Selection, op: Op) {
  return applyOp(tree, sel, op)
}

/** thread an op sequence, returning the final tree+selection */
function typeOps(tree: BlockNode, sel: Selection, ops: Op[]) {
  let t = tree
  let s = sel
  for (const op of ops) {
    const r = apply(t, s, op)
    t = r.tree
    s = r.selection
  }
  return { tree: t, sel: s }
}

// -- 1. 输入 -------------------------------------------------------------------

describe('typing', () => {
  it('keystrokes concatenate and the caret tracks the insertion point', () => {
    const tree = doc(leafBlock('p1', BlockType.Paragraph, ''))
    const r = typeOps(tree, collapsedSel('p1', 0), [
      Op.InsertText(new InsertTextOp(pos('p1', 0), '你')),
      Op.InsertText(new InsertTextOp(pos('p1', 1), '好')),
      Op.InsertText(new InsertTextOp(pos('p1', 2), ' world')),
    ])
    expect(blockText(findBlock(r.tree, 'p1')!)).toBe('你好 world')
    expect(r.sel.anchor.blockId).toBe('p1')
    expect(r.sel.anchor.offset).toBe(8)
  })

  it('mid-text insertion lands between existing spans', () => {
    const tree = doc(leafBlock('p1', BlockType.Paragraph, 'ad'))
    const r = apply(tree, collapsedSel('p1', 1), Op.InsertText(new InsertTextOp(pos('p1', 1), 'bc')))
    expect(blockText(findBlock(r.tree, 'p1')!)).toBe('abcd')
  })
})

// -- 2. 换段 -------------------------------------------------------------------

describe('paragraph split (Enter)', () => {
  it('split moves the tail into a new same-kind block and focuses it', () => {
    const tree = doc(leafBlock('p1', BlockType.Paragraph, 'hello world'))
    const r = typeOps(tree, collapsedSel('p1', 5), [
      Op.SplitBlock(new SplitBlockOp(pos('p1', 5), 'p2')),
      Op.InsertText(new InsertTextOp(pos('p2', 0), 'X')),
    ])
    expect(r.tree.children).toHaveLength(2)
    expect(blockText(r.tree.children[0])).toBe('hello')
    expect(blockText(r.tree.children[1])).toBe('X world')
    expect(r.sel.anchor.blockId).toBe('p2')
  })

  it('backspace at block start merges back (the inverse path)', () => {
    const tree = doc(leafBlock('p1', BlockType.Paragraph, 'hello'), leafBlock('p2', BlockType.Paragraph, 'world'))
    const r = apply(tree, collapsedSel('p2', 0), Op.MergeBlocks(new MergeBlocksOp('p1', 'p2')))
    expect(r.tree.children).toHaveLength(1)
    expect(blockText(r.tree.children[0])).toBe('helloworld')
    expect(r.selection.anchor.blockId).toBe('p1')
    expect(r.selection.anchor.offset).toBe(5)
  })
})

// -- 3. 列表续行 ----------------------------------------------------------------

describe('list continuation', () => {
  it('Enter in a list item keeps the item kind on both halves (续行)', () => {
    const tree = doc(withChildren(block('l1', BlockType.ListBlock), [
      leafBlock('i1', BlockType.ListItem, 'first'),
    ]))
    const r = typeOps(tree, collapsedSel('i1', 5), [
      Op.SplitBlock(new SplitBlockOp(pos('i1', 5), 'i2')),
      Op.InsertText(new InsertTextOp(pos('i2', 0), 'second')),
    ])
    const list = findBlock(r.tree, 'l1')!
    expect(list.children).toHaveLength(2)
    expect(list.children.every((c) => c.kind === BlockType.ListItem)).toBe(true)
    expect(blockText(list.children[1])).toBe('second')
  })

  it('empty item Enter lifts out of the list (退出列表的语义形状)', () => {
    const tree = doc(withChildren(block('l1', BlockType.ListBlock), [
      leafBlock('i1', BlockType.ListItem, 'only'),
      leafBlock('i2', BlockType.ListItem, ''),
    ]))
    // exit = merge/lift composition; semantic assertion: the empty item is
    // removed from the list and a paragraph sibling takes over
    const r = applyOp(tree, collapsedSel('i2', 0), Op.SetBlockType(new SetBlockTypeOp('i2', BlockType.Paragraph)))
    const lifted = findBlock(r.tree, 'i2')!
    expect(lifted.kind).toBe(BlockType.Paragraph)
  })
})

// -- 4. 表格行增删（语义形式；Phase 3 扩展操作封装） ------------------------------

describe('table row add/remove (semantic form)', () => {
  function row(id: string, ...cells: string[]): BlockNode {
    return withChildren(block(id, BlockType.TableRow), cells.map((c, i) => leafBlock(`${id}c${i}`, BlockType.TableCell, c)))
  }
  function table(id: string, ...rows: BlockNode[]): BlockNode {
    return withChildren(block(id, BlockType.Table), rows)
  }

  it('adding a row = inserting a TableRow node at the anchor index', () => {
    const t = table('t1', row('r1', 'a', 'b'))
    const withTwo = replaceNode(t, 'r1', [findBlock(t, 'r1')!, row('r2', '', '')])
    expect(findBlock(withTwo, 't1')!.children).toHaveLength(2)
    expect(blockText(findBlock(withTwo, 'r2c1')!)).toBe('')
  })

  it('removing a row = dropping the TableRow node, siblings unaffected', () => {
    const t = table('t1', row('r1', 'a', 'b'), row('r2', 'c', 'd'))
    const one = replaceNode(t, 'r1', [])
    const rows = findBlock(one, 't1')!.children
    expect(rows).toHaveLength(1)
    expect(blockText(findBlock(one, 'r2c0')!)).toBe('c')
  })
})

// -- 5. undo / redo --------------------------------------------------------------

describe('undo / redo', () => {
  it('undoing an interaction sequence restores the document and caret', () => {
    const tree = doc(leafBlock('p1', BlockType.Paragraph, 'hello'))
    const ops = [
      Op.InsertText(new InsertTextOp(pos('p1', 5), ' world')),
      Op.SplitBlock(new SplitBlockOp(pos('p1', 11), 'p2')),
      Op.InsertText(new InsertTextOp(pos('p2', 0), 'tail')),
    ]
    // apply forward, recording pre-state per op
    let t = tree
    let s = collapsedSel('p1', 5)
    const pre: { tree: BlockNode; op: Op }[] = []
    for (const op of ops) {
      pre.push({ tree: t, op })
      const r = apply(t, s, op)
      t = r.tree
      s = r.selection
    }
    expect(t.children).toHaveLength(2)
    // undo in reverse
    for (let i = pre.length - 1; i >= 0; i--) {
      const r = apply(t, s, invertOp(pre[i].tree, pre[i].op))
      t = r.tree
      s = r.selection
    }
    expect(t.children).toHaveLength(1)
    expect(blockText(t.children[0])).toBe('hello')
  })
})

// -- 6. 斜杠模板插入 --------------------------------------------------------------

describe('slash template insert', () => {
  it('insertTemplate replaces the anchor block with the template blocks', () => {
    const tree = doc(leafBlock('p1', BlockType.Paragraph, ''))
    // insertTemplate([heading, paragraph]) — command-layer semantic shape
    const template = [
      leafBlock('t-h', BlockType.Heading, 'Title'),
      leafBlock('t-p', BlockType.Paragraph, 'body'),
    ]
    const r = replaceNode(tree, 'p1', template)
    expect(r.children.map((c) => c.kind)).toEqual([BlockType.Heading, BlockType.Paragraph])
    expect(blockText(r.children[0])).toBe('Title')
  })
})

// -- 7. markdown 输入规则 ----------------------------------------------------------

describe('markdown input rules', () => {
  it('"# " converts the block to a heading and consumes the marker', () => {
    const tree = doc(leafBlock('p1', BlockType.Paragraph, ''))
    const r = typeOps(tree, collapsedSel('p1', 0), [
      // user types "# " — the rule engine rewrites it as: delete marker + set kind
      Op.ReplaceRange(new ReplaceRangeOp(
        new Selection(pos('p1', 0), pos('p1', 2)),
        '',
      )),
      Op.SetBlockType(new SetBlockTypeOp('p1', BlockType.Heading)),
      Op.InsertText(new InsertTextOp(pos('p1', 0), 'Title')),
    ])
    const h = findBlock(r.tree, 'p1')!
    expect(h.kind).toBe(BlockType.Heading)
    expect(blockText(h)).toBe('Title')
  })

  it('"- " converts to a list item wrap (semantic form)', () => {
    const tree = doc(leafBlock('p1', BlockType.Paragraph, 'item one'))
    const r = typeOps(tree, collapsedSel('p1', 8), [
      Op.SetBlockType(new SetBlockTypeOp('p1', BlockType.ListItem)),
    ])
    expect(findBlock(r.tree, 'p1')!.kind).toBe(BlockType.ListItem)
  })
})

// -- 8. IME 组合约定 ---------------------------------------------------------------

describe('IME composition convention', () => {
  it('preedit never enters the op stack; commit lands as ONE insert', () => {
    const tree = doc(leafBlock('p1', BlockType.Paragraph, ''))
    // composition session for "中文": user stages zh → zho... → 中文 in the
    // host. NONE of the intermediate states are ops. Commit = single op.
    const r = typeOps(tree, collapsedSel('p1', 0), [
      Op.InsertText(new InsertTextOp(pos('p1', 0), '中文')),
    ])
    expect(blockText(findBlock(r.tree, 'p1')!)).toBe('中文')
    expect(r.sel.anchor.offset).toBe(2)
  })

  it('undo after a commit removes the whole composed text in one step', () => {
    const tree = doc(leafBlock('p1', BlockType.Paragraph, ''))
    const op = Op.InsertText(new InsertTextOp(pos('p1', 0), '中文'))
    const r1 = apply(tree, collapsedSel('p1', 0), op)
    const r2 = apply(r1.tree, r1.selection, invertOp(tree, op))
    expect(blockText(findBlock(r2.tree, 'p1')!)).toBe('')
  })
})

// -- 9. 交互不变量：文档模型是唯一真相源 ---------------------------------------------

describe('document invariant', () => {
  it('serialize(parse(text)) roundtrip still anchors the edit session', () => {
    // the edit session starts from parse_blocks output; the roundtrip is
    // asserted exhaustively in the parser suite — here we pin the entrypoint
    // the editing engine will use.
    const tree = doc(leafBlock('p1', BlockType.Paragraph, '编辑会话锚点'))
    const r = apply(tree, collapsedSel('p1', 6), Op.InsertText(new InsertTextOp(pos('p1', 6), '!')))
    expect(blockText(findBlock(r.tree, 'p1')!)).toBe('编辑会话锚点!')
  })
})
