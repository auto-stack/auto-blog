// table_block_widget_ext.ts — platform bridge for the TableBlockWidget
// (plan 037 T2/T4). The .at source owns the chrome; row/column commands and
// the cell blur-commit semantics stay on the hand-written
// TableEditorController (engine kernel, passed in as a prop by the
// EngineEditor edit slot — the TableEditorBlock boundary unchanged).
//
// What lives here:
// 1. commitTableCell — verbatim from table_editor_block_ext.ts (plan 023
//    P1T8): extract the cell id / text from the blur event (the DSL has no
//    dataset access) and hand them to controller.commitCell (diffToOp).
// 2. The family root's per-mode chrome reads: the three faces have three
//    roots (edit div.autodown-table-editor / view table.table-node / stream
//    div.streaming-table), so the dyn root's tag, class chain, and
//    attr-presence map come from here — undefined drops the attr (the Vue
//    attr rule, the CodeBlockWidget root_data_language idiom), keeping each
//    face's byte contract: the view root carries NO data-block-id /
//    data-node-type (the retired tablePanel emitted none), the edit/stream
//    roots carry no aria-busy (that lives on the view root table / the edit
//    branch's inner table), and the edit root's conditional is-readonly
//    class folds into the one class string (two :class bindings on the dyn
//    root would collide; the merged string renders identically).
// 3. htmlText — the escaped-text re-export for the stream face's v-html
//    text nodes (`text` emits a <span>{{}}</span> wrapper; the retired
//    StreamingTable template pinned bare text children).
//
// Deployed verbatim to src/editor/ext/table_block_widget_ext.ts by gen.mjs
// (assert-editor-gen guards the byte sync).

import { getCurrentInstance } from 'vue'
import { htmlText } from './code_block_widget_ext'
import { placeCaretAtPoint, takeClickCaret } from '../engine/click-caret'

export { htmlText }

export function commitTableCell(controller: any, e: any): void {
  const el = e?.target as HTMLElement | null
  const cellId = el?.dataset?.cellId
  if (!cellId) return
  controller.commitCell(cellId, (el as HTMLElement).innerText.replace(/\n+$/, ''))
}

/** Mount focus (the widget's .Init): the table face is a cell grid with no
 *  focus of its own, so a preview click's handoff (click-caret's cellId +
 *  point payload) focuses the addressed cell and lands the caret where the
 *  user pointed — without it the first click on a preview cell left focus
 *  nowhere and the position was lost. No handoff (keyboard focus,
 *  programmatic select) keeps the face's old no-focus behavior. */
export function focusPendingCell(blockId: string): void {
  const inst = getCurrentInstance()
  const root = (inst?.proxy?.$el as HTMLElement | undefined) ?? null
  if (!root || blockId === '') return
  const entry = takeClickCaret(blockId)
  if (!entry || !entry.cellId) return
  const cell = Array.from(root.querySelectorAll<HTMLElement>('[data-cell-id]')).find(
    (el) => el.dataset.cellId === entry.cellId,
  )
  if (!cell) return
  cell.focus()
  if (placeCaretAtPoint(cell, entry)) return
  // no caret API / point outside the cell — the cell end, the other faces'
  // append-at-end default
  const doc = cell.ownerDocument
  const range = doc.createRange()
  range.selectNodeContents(cell)
  range.collapse(false)
  const sel = doc.defaultView?.getSelection() ?? null
  sel?.removeAllRanges()
  sel?.addRange(range)
}

/** The dyn root's tag: the view face IS the table (tablePanel's root), the
 *  other two faces are divs. */
export function rootTag(mode: string): string {
  return mode === 'view' ? 'table' : 'div'
}

/** The dyn root's single class chain per face (see header note 2). */
export function rootClass(mode: string, final: boolean, readonly: boolean): string {
  if (mode === 'view') return 'table-node'
  if (mode === 'stream') return final ? 'streaming-table final' : 'streaming-table'
  return readonly ? 'autodown-table-editor is-readonly' : 'autodown-table-editor'
}

/** The view root table's aria-busy (tablePanel pinned "false"); absent on
 *  the edit/stream roots. */
export function rootAriaBusy(mode: string): string | undefined {
  return mode === 'view' ? 'false' : undefined
}

/** The edit root's data-block-id; absent on the view/stream roots. */
export function rootBlockId(mode: string, blockId: string): string | undefined {
  return mode === 'edit' ? blockId : undefined
}

/** The edit root's data-node-type; absent on the view/stream roots. */
export function rootNodeType(mode: string): string | undefined {
  return mode === 'edit' ? 'Table' : undefined
}

// -- stream face (the retired StreamingTable SFC's progressive contract) ---------
//
// 契约注记（plan 037 待澄清 #1 裁定落档）：streaming_table.at 的
// normalizeTableProps（nullish 兜底 `columns ?? []` / `rows ?? []`）随本桥
// 走 TS 而非 .at computed——computed 表达式不支持 `??`（probe 见
// table_menu.at）也无数组字面量；语义零改动（streaming-parity.test.ts 的
// nullish 断言由 streamHeader/streamBody 的 `?? []` 承接），.at 单源让位于
// 家族 widget 单源（streaming_table.at 本体 T5 退役）。

/** The stream face's normalized header list, pre-shaped for the template
 *  loop: {col, html} pairs — html is the escaped header text because the
 *  DSL's `text` emits a <span>{{}}</span> wrapper while the SFC template
 *  pinned bare <th>col</th> children. */
export function streamHeader(columns: unknown): Array<{ col: string; html: string }> {
  const cols = (columns ?? []) as string[]
  return cols.map((col) => ({ col: String(col), html: htmlText(String(col)) }))
}

/** The stream face's normalized body: rows × columns of {col, html} cells —
 *  `row[col] ?? ''` per cell (the SFC's missing-key fallback), keys carried
 *  for the template loops (col per cell, index per row — the SFC's keys). */
export function streamBody(
  columns: unknown,
  rows: unknown,
): Array<Array<{ col: string; html: string }>> {
  const cols = (columns ?? []) as string[]
  const data = (rows ?? []) as Record<string, unknown>[]
  return data.map((row) =>
    cols.map((col) => ({ col: String(col), html: htmlText(String(row?.[col] ?? '')) })),
  )
}

/** The loading row's colspan: Math.max(1, columns.length) — never a 0 span. */
export function streamColspan(columns: unknown): number {
  const len = ((columns ?? []) as string[]).length
  return Math.max(1, len)
}
