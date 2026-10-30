// TableEditorBlock tests (plan 023 P1T6): the typed table editing face.
//
// - TableEditorController (headless, BlockHost pattern): the four table
//   command directions go through commands.ts (ONE undo step each); cell
//   text commits follow the BlockHost protocol (DOM owns text while
//   focused, blur → diffToOp writeback). Guards: never delete the last
//   remaining row / column.
// - The table EDIT FACE's chrome (toolbar + cells + readonly banner) lives
//   on TableBlockWidget's edit mode since plan 037; this file keeps the
//   controller kernel + the assembly-level readonly gate (EngineEditor SSR).

import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { BlockType, BlockPos, Selection, blockText, findBlock } from '../../parser/block-model'
import { parse_blocks } from '../../parser/markdown-parser'
import { serialize } from '../../parser/serializer'
import { EditorEngine } from '../engine/editor-engine'
import { TableEditorController } from '../engine/table-editor-controller'
import EngineEditor from '../components/EngineEditor.vue'

function tableDoc(): { engine: EditorEngine; tableId: string } {
  const doc = parse_blocks('| A | B |\n| --- | --- |\n| 1 | 2 |\n\npara after', true)
  const engine = new EditorEngine(doc)
  const table = doc.children.find((n) => n.kind === BlockType.Table)
  return { engine, tableId: table!.id }
}

function rows(engine: EditorEngine, tableId: string) {
  return findBlock(engine.doc, tableId)!.children
}

describe('TableEditorController — four command directions', () => {
  it('addRow appends an empty row as one undo step', () => {
    const { engine, tableId } = tableDoc()
    const c = new TableEditorController(engine, tableId)
    expect(rows(engine, tableId).length).toBe(2)

    c.addRow()
    const after = rows(engine, tableId)
    expect(after.length).toBe(3)
    expect(after[2].kind).toBe(BlockType.TableRow)
    expect(after[2].children.map((cell) => blockText(cell))).toEqual(['', ''])

    engine.undo()
    expect(rows(engine, tableId).length).toBe(2)
  })

  it('addColumn appends an empty cell to every row as one undo step', () => {
    const { engine, tableId } = tableDoc()
    const c = new TableEditorController(engine, tableId)

    c.addColumn()
    expect(rows(engine, tableId).map((r) => r.children.length)).toEqual([3, 3])

    engine.undo()
    expect(rows(engine, tableId).map((r) => r.children.length)).toEqual([2, 2])
  })

  it('deleteRow removes the last row and undo restores it', () => {
    const { engine, tableId } = tableDoc()
    const c = new TableEditorController(engine, tableId)
    const lastId = rows(engine, tableId)[1].id

    c.deleteRow()
    expect(rows(engine, tableId).length).toBe(1)

    engine.undo()
    expect(findBlock(engine.doc, lastId)).toBeTruthy()
  })

  it('deleteRow refuses to remove the last remaining row', () => {
    const { engine, tableId } = tableDoc()
    const c = new TableEditorController(engine, tableId)
    c.deleteRow() // body row gone; only the header remains
    const before = engine.doc
    expect(c.deleteRow()).toBe(false)
    expect(engine.doc).toBe(before)
  })

  it('deleteColumn removes the last column and refuses below one column', () => {
    const { engine, tableId } = tableDoc()
    const c = new TableEditorController(engine, tableId)

    expect(c.deleteColumn()).toBe(true)
    expect(rows(engine, tableId).map((r) => r.children.length)).toEqual([1, 1])

    expect(c.deleteColumn()).toBe(false)
    expect(rows(engine, tableId).map((r) => r.children.length)).toEqual([1, 1])
  })

  it('addRowAbove inserts at index 0 (TableMenu absorption, adjudication #1)', () => {
    const { engine, tableId } = tableDoc()
    const c = new TableEditorController(engine, tableId)
    c.addRowAbove()
    expect(rows(engine, tableId).length).toBe(3)
    expect(rows(engine, tableId)[0].children.map((cell) => blockText(cell))).toEqual(['', ''])
    engine.undo()
    expect(rows(engine, tableId).length).toBe(2)
  })

  it('addColumnBefore inserts at index 0', () => {
    const { engine, tableId } = tableDoc()
    const c = new TableEditorController(engine, tableId)
    c.addColumnBefore()
    expect(rows(engine, tableId).map((r) => r.children.map((cell) => blockText(cell)))).toEqual([
      ['', 'A', 'B'],
      ['', '1', '2'],
    ])
    engine.undo()
    expect(rows(engine, tableId)[0].children.length).toBe(2)
  })

  it('deleteTable removes the table and repairs the dangling selection', () => {
    const doc = parse_blocks('| A | B |\n| --- | --- |\n| 1 | 2 |\n\npara', true)
    const e = new EditorEngine(doc)
    const table = doc.children.find((n) => n.kind === BlockType.Table)!
    const p = new BlockPos(table.id, 0)
    e.select(new Selection(p, p))
    const c = new TableEditorController(e, table.id)
    c.deleteTable()
    expect(findBlock(e.doc, table.id)).toBeNull()
    expect(findBlock(e.doc, e.selection.anchor.blockId)).toBeTruthy()
  })
})

describe('TableEditorController — cell text commit (BlockHost protocol)', () => {
  it('blur-commit writes cell text back and survives serialize', () => {
    const { engine, tableId } = tableDoc()
    const c = new TableEditorController(engine, tableId)
    const headerCell = rows(engine, tableId)[0].children[0]

    expect(c.cellText(headerCell.id)).toBe('A')
    expect(c.commitCell(headerCell.id, 'Alpha')).toBe(true)
    expect(blockText(findBlock(engine.doc, headerCell.id)!)).toBe('Alpha')

    const md = serialize(engine.doc, true)
    expect(md).toContain('| Alpha | B |')

    engine.undo()
    expect(blockText(findBlock(engine.doc, headerCell.id)!)).toBe('A')
  })

  it('cell commit keeps the selection anchored on the table (edit face stays assembled)', () => {
    // the face is assembled from the TOP-LEVEL focused block; if the commit
    // op drags the engine selection down into the cell, the table leaves the
    // focused branch and the editing face unmounts (found live in the demo)
    const { engine, tableId } = tableDoc()
    const c = new TableEditorController(engine, tableId)
    const cell = rows(engine, tableId)[1].children[0]
    const sel = new Selection(new BlockPos(tableId, 0), new BlockPos(tableId, 0))
    engine.select(sel)
    c.commitCell(cell.id, 'changed')
    expect(engine.selection.anchor.blockId).toBe(tableId)
  })

  it('committing identical cell text is a no-op', () => {
    const { engine, tableId } = tableDoc()
    const c = new TableEditorController(engine, tableId)
    const cell = rows(engine, tableId)[1].children[1]
    expect(c.commitCell(cell.id, '2')).toBe(false)
  })
})

describe('stream→edit readonly gate v1 (P2T2)', () => {
  // assembly wiring for the table face mirrors the code face: streaming=true
  // → BlockEditCtx.readonly → banner + disabled toolbar buttons.
  async function renderEditor(streaming: boolean | undefined): Promise<string> {
    const app = createSSRApp({
      render: () =>
        h(EngineEditor as any, { modelValue: '| A | B |\n| --- | --- |\n| 1 | 2 |', streaming }),
    })
    return renderToString(app)
  }

  it('streaming=true renders the table edit face read-only with the banner', async () => {
    const html = (await renderEditor(true)).replace(/<!--.*?-->/g, '')
    expect(html).toContain('autodown-table-editor')
    expect(html).toContain('autodown-stream-banner')
    expect(html).toContain('disabled')
  })

  it('streaming absent/false leaves the table face editable', async () => {
    const html = (await renderEditor(false)).replace(/<!--.*?-->/g, '')
    expect(html).toContain('autodown-table-editor')
    expect(html).not.toContain('autodown-stream-banner')
  })
})

// TableEditorBlock.vue retired (plan 037 T5): its SSR contract (the
// table-node DOM + toolbar + readonly banner) is absorbed byte-identically
// by TableBlockWidget's edit face — pinned in table-block-widget.test.ts
// (the toolbar verbs / cell blur / readonly gate stay headless here: the
// controller kernel is untouched by the family switch).
