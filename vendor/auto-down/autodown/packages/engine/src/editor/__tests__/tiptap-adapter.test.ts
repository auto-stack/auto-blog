// Tiptap chain adapter tests (plan 018 余量批次): the slash manifest's
// chain API runs unchanged against the engine; the slash trigger helper
// derives the Suggestion-compatible query.

import { describe, expect, it } from 'vitest'
import {
  Attr,
  BlockNode,
  BlockType,
  Mark,
  Selection,
  Value,
  attrSet,
  block,
  blockText,
  collapsedSel,
  findBlock,
  leafBlock,
  pos,
  span,
  spanWith,
  withChildren,
  withInlines,
} from '../../parser/block-model'
import { parse_blocks } from '../../parser/markdown-parser'
import { serialize } from '../../parser/serializer'
import { EditorEngine } from '../engine/editor-engine'
import { createEditorAdapter, slashQueryAt } from '../engine/tiptap-adapter'

function doc(...kids: BlockNode[]): BlockNode {
  return withChildren(block('doc', BlockType.Paragraph), kids)
}

describe('tiptap chain adapter', () => {
  it('setHeading sets kind + level attr in one run()', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, 'x')), collapsedSel('p1', 0))
    const adapter = createEditorAdapter(e)
    adapter.chain().focus().setHeading({ level: 2 }).run()
    const found = findBlock(e.doc, 'p1') as any
    expect(found.kind).toBe(BlockType.Heading)
    expect(found.attrs.some((a: any) => a.key === 'level' && a.value.value === 2)).toBe(true)
    // one undo step
    e.undo()
    expect(findBlock(e.doc, 'p1')!.kind).toBe(BlockType.Paragraph)
  })

  it('toggle commands map to block kinds', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, 'x')), collapsedSel('p1', 0))
    const adapter = createEditorAdapter(e)
    const c: any = adapter.chain()
    c.focus().toggleBlockquote().run()
    expect(findBlock(e.doc, 'p1')!.kind).toBe(BlockType.Blockquote)
    c.focus().setCodeBlock().run()
    expect(findBlock(e.doc, 'p1')!.kind).toBe(BlockType.Fence)
    c.focus().setHorizontalRule().run()
    expect(findBlock(e.doc, 'p1')!.kind).toBe(BlockType.ThematicBreak)
  })

  it('insertContent appends markdown text into the focused block', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, 'a')), collapsedSel('p1', 0))
    const adapter = createEditorAdapter(e)
    adapter.chain().focus().insertContent('b').run()
    expect(blockText(findBlock(e.doc, 'p1')!)).toBe('ab')
  })

  it('setImage inserts an image markdown', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, '')), collapsedSel('p1', 0))
    const adapter = createEditorAdapter(e)
    adapter.chain().focus().setImage({ src: 'u.png', alt: 'alt' }).run()
    expect(blockText(findBlock(e.doc, 'p1')!)).toBe('![alt](u.png)')
  })

  it('storage carries the slash-command handshake shape', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, '')), collapsedSel('p1', 0))
    const adapter = createEditorAdapter(e)
    expect(adapter.storage['slash-command']).toMatchObject({ query: '', handled: false })
  })

  it('carries __engine so engine-native manifest readers reach the session (plan 021 Phase 2)', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, 'x')), collapsedSel('p1', 0))
    const adapter = createEditorAdapter(e)
    // optional field on the frozen interface; the factory always sets it
    expect(adapter.__engine).toBeDefined()
    expect(adapter.__engine!.selection.anchor.blockId).toBe('p1')
  })
})

describe('slashQueryAt (Suggestion-compatible trigger)', () => {
  it('finds the query after a block-start slash', () => {
    expect(slashQueryAt('/he', 3)).toBe('he')
    expect(slashQueryAt('/', 1)).toBe('')
  })

  it('requires start-of-block or whitespace before the slash', () => {
    expect(slashQueryAt('a/he', 4)).toBeNull()
    expect(slashQueryAt('a /he', 5)).toBe('he')
  })

  it('no slash, no query', () => {
    expect(slashQueryAt('hello', 5)).toBeNull()
  })
})

// -- event bus + selectionUpdate dispatch (plan 026 P0T1) ------------------------

describe('adapter event bus', () => {
  it("dispatches 'selectionUpdate' when the engine selection changes", () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, 'x')), collapsedSel('p1', 0))
    const adapter = createEditorAdapter(e)
    const seen: number[] = []
    adapter.on?.('selectionUpdate', () => seen.push(1))
    e.select(collapsedSel('p1', 1))
    expect(seen.length).toBe(1)
    e.select(new Selection(pos('p1', 0), pos('p1', 1)))
    expect(seen.length).toBe(2)
  })

  it('does not dispatch when the same selection is re-set (change gating)', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, 'x')), collapsedSel('p1', 0))
    const adapter = createEditorAdapter(e)
    const seen: number[] = []
    adapter.on?.('selectionUpdate', () => seen.push(1))
    e.select(collapsedSel('p1', 0)) // same anchor+head — no dispatch
    expect(seen.length).toBe(0)
  })

  it('does not dispatch for selection-neutral changes (streaming append)', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, 'x')), collapsedSel('p1', 0))
    const adapter = createEditorAdapter(e)
    const seen: number[] = []
    adapter.on?.('selectionUpdate', () => seen.push(1))
    e.appendBlocks([leafBlock('p2', BlockType.Paragraph, 'streamed')])
    expect(seen.length).toBe(0)
  })

  it("off() removes the subscription", () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, 'x')), collapsedSel('p1', 0))
    const adapter = createEditorAdapter(e)
    const seen: number[] = []
    const cb = () => seen.push(1)
    adapter.on?.('selectionUpdate', cb)
    adapter.off?.('selectionUpdate', cb)
    e.select(collapsedSel('p1', 1))
    expect(seen.length).toBe(0)
  })

  it('undo/redo selection restores still dispatch (selection moved back)', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, 'x')), collapsedSel('p1', 0))
    const adapter = createEditorAdapter(e)
    const seen: number[] = []
    adapter.on?.('selectionUpdate', () => seen.push(1))
    e.select(collapsedSel('p1', 1))
    e.select(collapsedSel('p1', 0)) // back to the initial position — still a change vs p1:1
    expect(seen.length).toBe(2)
  })
})

// -- block-family surface: isActive/getAttributes/view (plan 026 P0T2) -----------

describe('adapter block-family surface', () => {
  function tableEngine() {
    const e = new EditorEngine(
      doc(...parse_blocks('| A | B |\n| --- | --- |\n| 1 | 2 |\n\npara', true).children),
      collapsedSel('p-none', 0),
    )
    const table = e.doc.children.find((n) => n.kind === BlockType.Table)!
    return { e, table }
  }

  it("isActive('table') is true for a selection inside any cell", () => {
    const { e, table } = tableEngine()
    const adapter = createEditorAdapter(e)
    const cell = table.children[1]!.children[0]!
    e.select(collapsedSel(cell.id, 0))
    expect(adapter.isActive('table')).toBe(true)
  })

  it("isActive('table') is false for a selection outside the table; mark names unaffected", () => {
    const { e, table } = tableEngine()
    const adapter = createEditorAdapter(e)
    const para = e.doc.children.find((n) => n.kind === BlockType.Paragraph)!
    e.select(collapsedSel(para.id, 0))
    expect(adapter.isActive('table')).toBe(false)
    expect(adapter.isActive('codeBlock')).toBe(false)
    // header cell family still counts as the table
    const headerCell = table.children[0]!.children[0]!
    e.select(collapsedSel(headerCell.id, 0))
    expect(adapter.isActive('table')).toBe(true)
  })

  it("getAttributes('codeBlock') returns the focused Fence attrs as an object", () => {
    const fence = leafBlock('f1', BlockType.Fence, 'let x = 1')
    fence.attrs = attrSet(fence.attrs, 'language', Value.Str('ts'))
    const e = new EditorEngine(doc(fence, leafBlock('p1', BlockType.Paragraph, 'x')), collapsedSel('f1', 0))
    const adapter = createEditorAdapter(e)
    expect(adapter.getAttributes?.('codeBlock')).toEqual({ language: 'ts' })
  })

  it("getAttributes returns {} when the focused block is not of that family", () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, 'x')), collapsedSel('p1', 0))
    const adapter = createEditorAdapter(e)
    expect(adapter.getAttributes?.('codeBlock')).toEqual({})
  })

  it('view.dom lazily resolves the editor content element (null without DOM)', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, 'x')), collapsedSel('p1', 0))
    const adapter = createEditorAdapter(e)
    // headless test env: no document — the anchor degrades instead of throwing
    expect(adapter.view?.dom ?? null).toBe(null)
  })
})

// -- chain verbs: table rows/columns + code language (plan 026 P0T3) ------------

describe('adapter chain verbs', () => {
  function tableEngine() {
    const e = new EditorEngine(
      doc(...parse_blocks('| A | B |\n| --- | --- |\n| 1 | 2 |', true).children),
      collapsedSel('p-none', 0),
    )
    const table = e.doc.children.find((n) => n.kind === BlockType.Table)!
    const bodyCell = table.children[1]!.children[0]!
    e.select(collapsedSel(bodyCell.id, 0))
    return { e, table, adapter: createEditorAdapter(e) }
  }

  function cellTexts(engine: EditorEngine, tableId: string): string[][] {
    const t = findBlock(engine.doc, tableId)!
    return t.children.map((r) => r.children.map((c) => blockText(c)))
  }

  it('addRowAfter inserts an empty row after the focused row, one undo step', () => {
    const { e, table, adapter } = tableEngine()
    adapter.chain().focus().addRowAfter().run()
    // focus sits in the body row ('1') — the new row lands after it
    expect(cellTexts(e, table.id)).toEqual([['A', 'B'], ['1', '2'], ['', '']])
    e.undo()
    expect(cellTexts(e, table.id)).toEqual([['A', 'B'], ['1', '2']])
  })

  it('addRowBefore on the first focused row inserts at index 0', () => {
    const { e, table, adapter } = tableEngine()
    const headerCell = table.children[0]!.children[0]!
    e.select(collapsedSel(headerCell.id, 0))
    adapter.chain().focus().addRowBefore().run()
    expect(cellTexts(e, table.id).length).toBe(3)
    expect(cellTexts(e, table.id)[0]).toEqual(['', ''])
  })

  it('deleteRow removes the focused row', () => {
    const { e, table, adapter } = tableEngine()
    adapter.chain().focus().deleteRow().run()
    expect(cellTexts(e, table.id)).toEqual([['A', 'B']])
  })

  it('addColumnAfter/addColumnBefore/deleteColumn operate on the focused column', () => {
    const { e, table, adapter } = tableEngine()
    adapter.chain().focus().addColumnAfter().run()
    expect(cellTexts(e, table.id)).toEqual([['A', '', 'B'], ['1', '', '2']])
    adapter.chain().focus().addColumnBefore().run()
    expect(cellTexts(e, table.id)).toEqual([['', 'A', '', 'B'], ['', '1', '', '2']])
    // the focused cell ('1') shifted to column 1 — deleteColumn removes ITS column
    adapter.chain().focus().deleteColumn().run()
    expect(cellTexts(e, table.id)).toEqual([['', '', 'B'], ['', '', '2']])
  })

  it('deleteTable removes the table and repairs the dangling selection', () => {
    const e = new EditorEngine(
      doc(...parse_blocks('| A | B |\n| --- | --- |\n| 1 | 2 |\n\npara', true).children),
      collapsedSel('p-none', 0),
    )
    const table = e.doc.children.find((n) => n.kind === BlockType.Table)!
    const bodyCell = table.children[1]!.children[0]!
    e.select(collapsedSel(bodyCell.id, 0))
    const adapter = createEditorAdapter(e)
    adapter.chain().focus().deleteTable().run()
    expect(findBlock(e.doc, table.id)).toBeNull()
    // anchor no longer dangles on the removed cell
    expect(findBlock(e.doc, e.selection.anchor.blockId)).toBeTruthy()
  })

  it('setCodeBlockLanguage writes the language attr; serialize roundtrips the fence', () => {
    const fence = leafBlock('f1', BlockType.Fence, 'let x = 1')
    const e = new EditorEngine(doc(fence, leafBlock('p1', BlockType.Paragraph, 'x')), collapsedSel('f1', 0))
    const adapter = createEditorAdapter(e)
    adapter.chain().focus().setCodeBlockLanguage('ts').run()
    expect(serialize(e.doc, false)).toContain('```ts')
    e.undo()
    expect(serialize(e.doc, false)).not.toContain('```ts')
  })

  it("setCodeBlock({language}) — the generated menu's verb — routes to the language channel", () => {
    const fence = leafBlock('f1', BlockType.Fence, 'code')
    fence.attrs = attrSet(fence.attrs, 'language', Value.Str('js'))
    const e = new EditorEngine(doc(fence), collapsedSel('f1', 0))
    const adapter = createEditorAdapter(e)
    adapter.chain().focus().setCodeBlock({ language: 'python' }).run()
    expect(serialize(e.doc, false)).toContain('```python')
    // no-arg form still converts the kind (slash parity)
    const p = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, 'x')), collapsedSel('p1', 0))
    createEditorAdapter(p).chain().focus().setCodeBlock().run()
    expect(findBlock(p.doc, 'p1')!.kind).toBe(BlockType.Fence)
  })

  it('table-level focus (the table face itself) takes the table-ends defaults', () => {
    const e = new EditorEngine(
      doc(...parse_blocks('| A | B |\n| --- | --- |\n| 1 | 2 |', true).children),
      collapsedSel('p-none', 0),
    )
    const table = e.doc.children.find((n) => n.kind === BlockType.Table)!
    e.select(collapsedSel(table.id, 0)) // focus stops at the table face
    const adapter = createEditorAdapter(e)
    expect(adapter.isActive('table')).toBe(true)
    adapter.chain().focus().addRowAfter().run()
    // appends after the LAST row (TableEditorController.addRow parity)
    const texts = findBlock(e.doc, table.id)!.children.map((r) => r.children.map((c) => blockText(c)))
    expect(texts).toEqual([['A', 'B'], ['1', '2'], ['', '']])
    adapter.chain().focus().addColumnAfter().run()
    expect(findBlock(e.doc, table.id)!.children[0]!.children.map((c) => blockText(c))).toEqual(['A', 'B', ''])
  })

  it('setDetails carries the slash template summary attr and moves inlines into a child paragraph', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, 'body text')), collapsedSel('p1', 0))
    const adapter = createEditorAdapter(e)
    adapter.chain().focus().setDetails({ summary: 'Details' }).run()
    const found = findBlock(e.doc, 'p1')!
    expect(found.kind).toBe(BlockType.Details)
    expect(found.attrs.some((a) => a.key === 'summary' && a.value._tag === 'Str' && a.value.value === 'Details')).toBe(true)
    // the paragraph's text survives as the details body (serialize keeps it)
    expect(found.children.length).toBe(1)
    expect(blockText(found.children[0]!)).toBe('body text')
    expect(serialize(e.doc, false)).toContain('$details(summary: "Details") {\nbody text\n}')
  })

  it('deleteRange removes the range at its position (start-anchored query)', () => {
    const e = new EditorEngine(doc(leafBlock('p1', BlockType.Paragraph, 'hello world')), collapsedSel('p1', 0))
    const adapter = createEditorAdapter(e)
    adapter.chain().focus().deleteRange({ from: 0, to: 6 }).run()
    expect(blockText(findBlock(e.doc, 'p1')!)).toBe('world')
  })
})

// -- mark chain + isActive (plan 024 P3T1) --------------------------------------

describe('adapter mark surface', () => {
  function markedEngine() {
    const spans = [span('a'), spanWith('b', [Mark.Strong], []), spanWith('c', [Mark.Em], [])]
    const e = new EditorEngine(doc(withInlines(leafBlock('p1', BlockType.Paragraph, ''), spans)), collapsedSel('p1', 0))
    return e
  }

  it('isActive reads the selection marks from the engine', () => {
    const e = markedEngine()
    const adapter = createEditorAdapter(e)
    e.select(new Selection(pos('p1', 1), pos('p1', 2)))
    expect(adapter.isActive('bold')).toBe(true)
    expect(adapter.isActive('italic')).toBe(false)
    e.select(new Selection(pos('p1', 2), pos('p1', 3)))
    expect(adapter.isActive('italic')).toBe(true)
    expect(adapter.isActive('bold')).toBe(false)
    // caret inside the bold run reads the enclosing span
    e.select(collapsedSel('p1', 1))
    expect(adapter.isActive('bold')).toBe(true)
  })

  it('isActive is false for unknown/unsupported names (underline)', () => {
    const e = markedEngine()
    const adapter = createEditorAdapter(e)
    expect(adapter.isActive('underline')).toBe(false)
    expect(adapter.isActive('heading')).toBe(false)
    expect(adapter.isActive('image')).toBe(false)
  })

  it('mark chain methods exist and run without a focused host (no-op)', () => {
    const e = markedEngine()
    const adapter = createEditorAdapter(e)
    const c: any = adapter.chain()
    expect(c.focus().toggleBold().run()).toBe(true)
    expect(c.focus().toggleItalic().run()).toBe(true)
    expect(c.focus().toggleStrike().run()).toBe(true)
    expect(c.focus().toggleCode().run()).toBe(true)
    expect(c.focus().toggleUnderline().run()).toBe(true)
    // DOM wrap never happened — model untouched
    expect(serialize(e.doc, false)).toContain('a**b***c*')
  })

  it('setLink/unsetLink chain methods run without a host (no-op safe)', () => {
    const e = markedEngine()
    const adapter = createEditorAdapter(e)
    const c: any = adapter.chain()
    expect(c.focus().setLink({ href: 'https://x' }).run()).toBe(true)
    expect(c.focus().unsetLink().run()).toBe(true)
  })
})

describe('callout/task verbs (plan 030 T7)', () => {
  function select(e: EditorEngine, id: string): void {
    const p = pos(id, 0)
    e.select(new Selection(p, p))
  }

  it('setCallout lands kind + type/title attrs and moves text into a child', () => {
    const e = new EditorEngine(doc(leafBlock('b0', BlockType.Paragraph, '正文')))
    select(e, 'b0')
    const adapter = createEditorAdapter(e)
    expect((adapter.chain() as any).focus().setCallout({ type: 'note', title: '提示' }).run()).toBe(true)
    const callout = e.doc.children[0]
    expect(callout.kind).toBe(BlockType.Callout)
    expect(attrGetStrOf(callout, 'type')).toBe('note')
    expect(attrGetStrOf(callout, 'title')).toBe('提示')
    expect(callout.children[0].kind).toBe(BlockType.Paragraph)
    expect(blockText(callout.children[0])).toBe('正文')
    // P1 roundtrip: the serialized dialect reparses to the same attrs
    const md = serialize(e.doc, true)
    expect(md).toContain('$callout(type: "note", title: "提示") {')
    expect(parse_blocks(md, true).children[0].kind).toBe(BlockType.Callout)
  })

  it('toggleTaskList flips a plain item to a task and back (one undo step each)', () => {
    const e = new EditorEngine(parse_blocks('- [ ] a\n- [x] b\n- plain c\n', true))
    const adapter = createEditorAdapter(e)
    const items = () => e.doc.children[0].children
    // caret sits on the plain item's child paragraph — the verb resolves the item
    select(e, items()[2].children[0].id)
    expect((adapter.chain() as any).focus().toggleTaskList().run()).toBe(true)
    const plainNowTask = items()[2]
    expect(attrGetStrOf(plainNowTask, 'checked')).toBe('false')
    expect(serialize(e.doc, true)).toContain('- [ ] plain c')
    // toggle again → back to a plain bullet (attr removed)
    select(e, items()[2].children[0].id)
    expect((adapter.chain() as any).focus().toggleTaskList().run()).toBe(true)
    expect(serialize(e.doc, true)).toContain('- plain c')
    expect(e.undo()).toBe(true)
    expect(serialize(e.doc, true)).toContain('- [ ] plain c')
  })

  it('toggleTaskList on a checked item clears the flag (task ⇄ bullet)', () => {
    const e = new EditorEngine(parse_blocks('- [x] done\n', true))
    const adapter = createEditorAdapter(e)
    select(e, e.doc.children[0].children[0].children[0].id)
    expect((adapter.chain() as any).focus().toggleTaskList().run()).toBe(true)
    expect(serialize(e.doc, true)).toBe('- done\n')
  })
})

function attrGetStrOf(node: BlockNode, key: string): string {
  const a = node.attrs.find((x: Attr) => x.key === key)
  return a == null ? '' : String((a.value as any).value ?? '')
}
