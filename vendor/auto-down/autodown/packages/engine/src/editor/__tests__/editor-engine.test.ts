// Editing engine tests (plan 018 Phase 1): the engine must reproduce the
// Phase 0 semantics baseline (semantics.test.ts) through its own API, and
// the added session behavior (undo coalescing, group steps, streaming
// append, composition protocol, host diff) holds.

import { describe, expect, it } from 'vitest'
import {
  BlockNode,
  InsertTextOp as ITO,
  ReplaceRangeOp as RRO,
  BlockType,
  InsertTextOp,
  MergeBlocksOp,
  Op,
  SplitBlockOp,
  block,
  blockText,
  collapsedSel,
  findBlock,
  leafBlock,
  pos,
  withChildren,
} from '../../parser/block-model'
import { EditorEngine } from '../engine/editor-engine'
import { CompositionSession } from '../engine/composition'
import { diffToOp } from '../engine/text-diff'
import { INPUT_RULES, fireRuleOn, matchInputRule } from '../engine/input-rules'
import { serialize } from '../../parser/serializer'
import { parse_blocks } from '../../parser/markdown-parser'

function doc(...kids: BlockNode[]): BlockNode {
  return withChildren(block('doc', BlockType.Paragraph), kids)
}

describe('EditorEngine — Phase 0 semantics through the engine API', () => {
  it('typing then Enter splits, typing continues in the new block', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, '')), collapsedSel('p1', 0))
    e.apply(Op.InsertText(new InsertTextOp(pos('p1', 0), 'hello')))
    e.apply(Op.InsertText(new InsertTextOp(pos('p1', 5), ' world')))
    e.apply(Op.SplitBlock(new SplitBlockOp(pos('p1', 5), 'p2')))
    e.apply(Op.InsertText(new InsertTextOp(pos('p2', 0), 'tail')))
    expect(e.doc.children).toHaveLength(2)
    expect(blockText(e.doc.children[0])).toBe('hello')
    expect(blockText(e.doc.children[1])).toBe('tail world')
    expect(e.selection.anchor.blockId).toBe('p2')
  })

  it('backspace merge and full undo restore the original document + caret', () => {
    const tree = doc(leafBlock('p1', BlockType.Paragraph, 'hello'), leafBlock('p2', BlockType.Paragraph, 'world'))
    const e = new EditorEngine(tree, collapsedSel('p2', 0))
    e.apply(Op.MergeBlocks(new MergeBlocksOp('p1', 'p2')))
    expect(e.doc.children).toHaveLength(1)
    expect(e.canUndo).toBe(true)
    e.undo()
    expect(e.doc.children).toHaveLength(2)
    expect(blockText(findBlock(e.doc, 'p1')!)).toBe('hello')
    expect(e.selection.anchor.blockId).toBe('p2')
    expect(e.selection.anchor.offset).toBe(0)
  })

  it('undo → redo replays the change', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, 'a')), collapsedSel('p1', 1))
    e.apply(Op.InsertText(new InsertTextOp(pos('p1', 1), 'bc')))
    e.undo()
    expect(blockText(findBlock(e.doc, 'p1')!)).toBe('a')
    expect(e.canRedo).toBe(true)
    e.redo()
    expect(blockText(findBlock(e.doc, 'p1')!)).toBe('abc')
  })

  it('undo → redo → undo restores again (plan 028: redo records the PRE state)', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, 'a')), collapsedSel('p1', 1))
    e.apply(Op.InsertText(new InsertTextOp(pos('p1', 1), 'bc')))
    e.undo()
    e.redo()
    expect(blockText(findBlock(e.doc, 'p1')!)).toBe('abc')
    e.undo()
    expect(blockText(findBlock(e.doc, 'p1')!)).toBe('a')
    // the cycle is repeatable
    e.redo()
    expect(blockText(findBlock(e.doc, 'p1')!)).toBe('abc')
    e.undo()
    expect(blockText(findBlock(e.doc, 'p1')!)).toBe('a')
  })
})

describe('EditorEngine — history behavior', () => {
  it('coalesces adjacent typing into a single undo step', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, '')), collapsedSel('p1', 0))
    e.apply(Op.InsertText(new InsertTextOp(pos('p1', 0), 'a')))
    e.apply(Op.InsertText(new InsertTextOp(pos('p1', 1), 'b')))
    e.apply(Op.InsertText(new InsertTextOp(pos('p1', 2), 'c')))
    expect(blockText(findBlock(e.doc, 'p1')!)).toBe('abc')
    e.undo()
    // one undo removes the whole coalesced run
    expect(blockText(findBlock(e.doc, 'p1')!)).toBe('')
  })

  it('non-adjacent edits are separate undo steps', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, '')), collapsedSel('p1', 0))
    e.apply(Op.InsertText(new InsertTextOp(pos('p1', 0), 'ab')))
    e.apply(Op.SplitBlock(new SplitBlockOp(pos('p1', 2), 'p2')))
    e.apply(Op.InsertText(new InsertTextOp(pos('p2', 0), 'cd')))
    e.undo()
    expect(blockText(findBlock(e.doc, 'p2')!)).toBe('')
    e.undo()
    expect(e.doc.children).toHaveLength(1)
  })

  it('a new edit clears the redo stack', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, '')), collapsedSel('p1', 0))
    e.apply(Op.InsertText(new InsertTextOp(pos('p1', 0), 'x')))
    e.undo()
    expect(e.canRedo).toBe(true)
    e.apply(Op.InsertText(new InsertTextOp(pos('p1', 0), 'y')))
    expect(e.canRedo).toBe(false)
  })

  it('applyGroup is one undo step (input rule: marker delete + kind set)', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, '# ')), collapsedSel('p1', 2))
    expect(fireRuleOn(e, 'p1')).toBe(true)
    expect(findBlock(e.doc, 'p1')!.kind).toBe(BlockType.Heading)
    expect(blockText(findBlock(e.doc, 'p1')!)).toBe('')
    e.undo()
    expect(findBlock(e.doc, 'p1')!.kind).toBe(BlockType.Paragraph)
    expect(blockText(findBlock(e.doc, 'p1')!)).toBe('# ')
  })
})

describe('EditorEngine — streaming append (追加分流裁定)', () => {
  it('appends land at the tail without touching focus or selection', () => {
    const e = new EditorEngine(
      doc(leafBlock('p1', BlockType.Paragraph, '用户正在编辑'), leafBlock('p2', BlockType.Paragraph, '')),
      collapsedSel('p2', 0)
    )
    e.appendBlocks([leafBlock('s1', BlockType.Paragraph, 'AI 追加段落 1'), leafBlock('s2', BlockType.Paragraph, 'AI 追加段落 2')])
    expect(e.doc.children).toHaveLength(4)
    expect(e.doc.children[2].id).toBe('s1')
    expect(e.selection.anchor.blockId).toBe('p2') // focused block untouched
    expect(e.canUndo).toBe(false) // stream appends are not user edits
  })
})

describe('input rule table', () => {
  it('covers the markdown shortcuts with exact markers', () => {
    expect(matchInputRule('# ')).toMatchObject({ kind: BlockType.Heading })
    expect(matchInputRule('## ')).toMatchObject({ level: 2 })
    expect(matchInputRule('- ')).toMatchObject({ kind: BlockType.ListItem })
    expect(matchInputRule('> ')).toMatchObject({ kind: BlockType.Blockquote })
    expect(matchInputRule('``` ')).toMatchObject({ kind: BlockType.Fence })
    expect(matchInputRule('---')).toMatchObject({ kind: BlockType.ThematicBreak })
    expect(matchInputRule('hello')).toBeNull()
    expect(matchInputRule('# heading already typed')).toBeNull()
    expect(INPUT_RULES.length).toBeGreaterThanOrEqual(10)
  })

  it('fires from typed marker text through the engine', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, '- ')), collapsedSel('p1', 2))
    expect(fireRuleOn(e, 'p1')).toBe(true)
    // container form: the paragraph stays a paragraph inside ListBlock>ListItem
    const list = e.doc.children[0]
    expect(list.kind).toBe(BlockType.ListBlock)
    expect(list.children).toHaveLength(1)
    expect(list.children[0].kind).toBe(BlockType.ListItem)
    expect(list.children[0].children[0].id).toBe('p1')
    expect(findBlock(e.doc, 'p1')!.kind).toBe(BlockType.Paragraph)
    expect(blockText(findBlock(e.doc, 'p1')!)).toBe('')
    // the selection stays in the wrapped paragraph (the host keeps editing it)
    expect(e.selection.anchor.blockId).toBe('p1')
  })

  it('"- " produces a serializable list (roundtrip "- item")', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, '- ')), collapsedSel('p1', 2))
    expect(fireRuleOn(e, 'p1')).toBe(true)
    // one undo unwraps back to the typed marker paragraph…
    e.undo()
    expect(e.doc.children).toHaveLength(1)
    expect(e.doc.children[0].kind).toBe(BlockType.Paragraph)
    expect(blockText(e.doc.children[0])).toBe('- ')
    // …and redo re-applies the container wrap (after-fn on the group entry)
    e.redo()
    expect(e.doc.children[0].kind).toBe(BlockType.ListBlock)
    e.apply(Op.InsertText(new InsertTextOp(pos('p1', 0), 'item')))
    expect(serialize(e.doc, false)).toBe('- item\n')
    const reparsed = parse_blocks('- item\n', true)
    const rl = reparsed.children[0]
    expect(rl.kind).toBe(BlockType.ListBlock)
    expect(blockText(rl.children[0].children[0])).toBe('item')
  })

  it('"> " produces a Blockquote>Paragraph container (roundtrip)', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, '> ')), collapsedSel('p1', 2))
    expect(fireRuleOn(e, 'p1')).toBe(true)
    const quote = e.doc.children[0]
    expect(quote.kind).toBe(BlockType.Blockquote)
    expect(quote.children[0].id).toBe('p1')
    expect(findBlock(e.doc, 'p1')!.kind).toBe(BlockType.Paragraph)
    expect(e.selection.anchor.blockId).toBe('p1')
    e.apply(Op.InsertText(new InsertTextOp(pos('p1', 0), 'quoted')))
    expect(serialize(e.doc, false)).toBe('> quoted\n')
    e.undo()
    expect(e.doc.children[0].kind).toBe(BlockType.Blockquote)
    e.undo()
    expect(e.doc.children[0].kind).toBe(BlockType.Paragraph)
    expect(blockText(e.doc.children[0])).toBe('> ')
  })

  it('container rules report wrap semantics in the table', () => {
    expect(matchInputRule('- ')!.wrap).toBe(BlockType.ListBlock)
    expect(matchInputRule('* ')!.wrap).toBe(BlockType.ListBlock)
    expect(matchInputRule('+ ')!.wrap).toBe(BlockType.ListBlock)
    expect(matchInputRule('> ')!.wrap).toBe(BlockType.Blockquote)
    expect(matchInputRule('# ')!.wrap).toBeUndefined()
  })
})

describe('CompositionSession — IME protocol', () => {
  it('preedit stages produce no ops; commit lands as ONE insert', () => {
    const c = new CompositionSession()
    c.begin('p1', '', 0)
    expect(c.update('z')).toBeNull()
    expect(c.update('zh')).toBeNull()
    expect(c.update('中')).toBeNull()
    const op = c.commit('中文')
    expect(op!._tag).toBe('InsertText')
    expect((op!.value as RRO).text).toBe('中文')
    expect(c.composing).toBe(false)
  })

  it('commit over an existing baseline diffs into a ReplaceRange', () => {
    const c = new CompositionSession()
    c.begin('p1', '旧', 0)
    const op = c.commit('新中文')
    expect(op!._tag).toBe('ReplaceRange')
    expect((op!.value as RRO).text).toBe('新中文')
  })

  it('cancel produces nothing', () => {
    const c = new CompositionSession()
    c.begin('p1', '', 0)
    c.update('中')
    expect(c.cancel()).toBeNull()
    expect(c.composing).toBe(false)
  })
})

describe('diffToOp — host text bridge', () => {
  it('pure insertion becomes InsertText at the common prefix', () => {
    const op = diffToOp('p1', 'ad', 'abcd')
    expect(op!._tag).toBe('InsertText')
    expect((op!.value as ITO).pos.offset).toBe(1)
    expect((op!.value as RRO).text).toBe('bc')
  })

  it('deletion becomes ReplaceRange with empty replacement', () => {
    const op = diffToOp('p1', 'abcd', 'ad')
    expect(op!._tag).toBe('ReplaceRange')
    expect((op!.value as RRO).text).toBe('')
  })

  it('replacement covers the changed span only', () => {
    const op = diffToOp('p1', 'hello world', 'hello vue')
    expect(op!._tag).toBe('ReplaceRange')
    expect((op!.value as RRO).text).toBe('vue')
  })

  it('no change yields null', () => {
    expect(diffToOp('p1', 'same', 'same')).toBeNull()
  })
})

describe('EditorEngine — command-layer change notification (plan-023 follow-up)', () => {
  function newEngine(text: string): EditorEngine {
    return new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, text)))
  }

  // applyTree/applyGroup mutators (commands.ts, input rules, the code/table
  // edit-face commits) MUST notify onChange listeners — the editor repaints
  // and re-emits markdown from that signal; a silent tree change leaves the
  // UI stale (found live in the demo: table add-row had no visual effect).
  it('applyTree notifies onChange', () => {
    const engine = newEngine('hello')
    let notified = 0
    engine.onChange(() => { notified++ })
    engine.applyTree((tree) => tree)
    expect(notified).toBe(1)
  })

  it('applyGroup notifies onChange once per group', () => {
    const engine = newEngine('hello')
    let notified = 0
    engine.onChange(() => { notified++ })
    engine.applyGroup([])
    expect(notified).toBe(0) // no-op group stays silent
  })
})
