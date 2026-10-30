// TableEditorController (plan 023 P1T6) — the headless logic behind
// TableEditorBlock.vue (BlockHost pattern: logic here, DOM wiring in the
// SFC). Row/column directions go through the commands.ts tree ops (ONE undo
// step each); cell text commits follow the BlockHost protocol — the cell's
// DOM owns its text while focused, blur → diffToOp → engine.apply.
//
// Guards: the header row (children[0]) is structural (the serializer emits
// it plus the delimiter), so deleteRow never removes the last remaining row;
// deleteColumn never drops below one column.

import { BlockNode, BlockType, blockText, collapsedSel, findBlock, replaceNode } from '../../parser/block-model'
import { diffToOp } from './text-diff'
import { tableAddColumn, tableAddColumnAtTree, tableAddRow, tableDeleteColumn, tableDeleteRow } from './commands'
import type { EditorEngine } from './editor-engine'

export class TableEditorController {
  private engine: EditorEngine
  private tableId: string

  constructor(engine: EditorEngine, tableId: string) {
    this.engine = engine
    this.tableId = tableId
  }

  table(): BlockNode | null {
    return findBlock(this.engine.doc, this.tableId)
  }

  get rows(): BlockNode[] {
    return this.table()?.children ?? []
  }

  cellText(cellId: string): string {
    const cell = findBlock(this.engine.doc, cellId)
    return cell ? blockText(cell) : ''
  }

  /** Append an empty row after the last row (or after the header when only
   *  the header exists). One undo step. */
  addRow(): void {
    const lastRow = this.rows[this.rows.length - 1]
    tableAddRow(this.engine, this.tableId, lastRow?.id ?? null)
  }

  /** Insert an empty row ABOVE the header (TableMenu absorption, plan 026
   *  adjudication #1 — single table entry). One undo step. */
  addRowAbove(): void {
    tableAddRow(this.engine, this.tableId, null)
  }

  /** Insert an empty column at index 0. One undo step. */
  addColumnBefore(): void {
    this.engine.applyTree((tree) => tableAddColumnAtTree(tree, this.tableId, 0))
  }

  /** Remove the whole table; the dangling selection collapses to the first
   *  block (the menu chain's deleteTable repair, same semantics). */
  deleteTable(): void {
    this.engine.applyTree((tree) => replaceNode(tree, this.tableId, []))
    if (!findBlock(this.engine.doc, this.engine.selection.anchor.blockId) && this.engine.doc.children[0]) {
      this.engine.select(collapsedSel(this.engine.doc.children[0].id, 0))
    }
  }

  /** Remove the last row. Refused (no-op) when only the header remains. */
  deleteRow(): boolean {
    if (this.rows.length <= 1) return false
    tableDeleteRow(this.engine, this.rows[this.rows.length - 1].id)
    return true
  }

  /** Append an empty column. One undo step. */
  addColumn(): void {
    tableAddColumn(this.engine, this.tableId)
  }

  /** Remove the last column. Refused (no-op) below one column. */
  deleteColumn(): boolean {
    const cols = this.rows[0]?.children.length ?? 0
    if (cols <= 1) return false
    tableDeleteColumn(this.engine, this.tableId)
    return true
  }

  /** Cell blur-commit: old→new text as one diff op (BlockHost protocol).
   *  The selection stays anchored on the TABLE — the op's position points at
   *  the cell and applyOp would otherwise drag the anchor into it, dropping
   *  the top-level focus that assembles this editing face (found live in the
   *  demo: committing a cell unmounted the table editor).
   *  Returns false when the text is unchanged or the cell is gone. */
  commitCell(cellId: string, newText: string): boolean {
    const cell = findBlock(this.engine.doc, cellId)
    if (!cell) return false
    if (cell.kind !== BlockType.TableCell) return false
    const oldText = blockText(cell)
    if (oldText === newText) return false
    const op = diffToOp(cellId, oldText, newText)
    if (!op) return false
    const preSel = this.engine.selection
    this.engine.apply(op)
    if (this.engine.selection.anchor.blockId !== preSel.anchor.blockId) {
      this.engine.select(preSel)
    }
    return true
  }
}
