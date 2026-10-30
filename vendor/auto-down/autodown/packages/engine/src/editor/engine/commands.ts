// Command layer (plan 018 Phase 3) — the public editor commands that
// replace `editor.chain()` bypasses (the single jade-garden leak), plus the
// model-level extended operations (table rows/columns, block move, block
// attrs) layered on the 016 core ops. Tree-level commands go through
// EditorEngine.applyTree → ONE undo step each.

import {
  Attr,
  BlockNode,
  BlockType,
  BlockPos,
  InlineSpan,
  Mark,
  Selection,
  anchorOf,
  attrSet,
  block,
  childIndex,
  findBlock,
  leafBlock,
  parentOf,
  replaceNode,
  retargetAnchor,
  withChildren,
  withInlines,
} from '../../parser/block-model'
import { marksAtRange, setLinkOnSpans, toggleMarkOnSpans } from './marks'
import type { EditorEngine } from './editor-engine'

// -- command layer (jade-garden migration surface) --------------------------------

/** Insert template blocks replacing the anchor block (slash templates). */
export function insertTemplate(engine: EditorEngine, anchorId: string, blocks: BlockNode[]): void {
  if (!findBlock(engine.doc, anchorId)) return
  engine.applyTree((tree) => replaceNode(tree, anchorId, blocks.length > 0 ? blocks : [leafBlock(anchorId, BlockType.Paragraph, '')]))
}

/** Replace the selection's block with the given blocks. */
export function replaceSelection(engine: EditorEngine, blocks: BlockNode[]): void {
  const id = engine.selection.anchor.blockId
  if (!id || !findBlock(engine.doc, id)) return
  engine.applyTree((tree) => replaceNode(tree, id, blocks))
}

/** Focus a block at an offset; the host picks the move up. No history. */
export function focusBlock(engine: EditorEngine, id: string, offset = 0): void {
  if (!findBlock(engine.doc, id)) return
  engine.select(new Selection(new BlockPos(id, offset), new BlockPos(id, offset)))
}

// -- extended ops (model level; wrap with engine.applyTree for undo) ----------------

/** Table: add a row after `afterRowId` (null = first). One undo step. */
export function tableAddRow(engine: EditorEngine, tableId: string, afterRowId: string | null): void {
  engine.applyTree((tree) => tableAddRowTree(tree, tableId, afterRowId))
}

export function tableAddRowTree(tree: BlockNode, tableId: string, afterRowId: string | null): BlockNode {
  const table = findBlock(tree, tableId)
  if (!table) return tree
  const colCount = table.children[0]?.children.length ?? 1
  const newRowId = `row-${Math.random().toString(36).slice(2, 8)}`
  const cells: BlockNode[] = []
  for (let i = 0; i < colCount; i++) cells.push(leafBlock(`${newRowId}-c${i}`, BlockType.TableCell, ''))
  const row = withChildren(block(newRowId, BlockType.TableRow), cells)
  const rows = [...table.children]
  const idx = afterRowId == null ? 0 : childIndex(table, afterRowId) + 1
  rows.splice(idx < 0 ? rows.length : idx, 0, row)
  return replaceNode(tree, tableId, [withChildren(table, rows)])
}

/** Table: delete a row. One undo step. */
export function tableDeleteRow(engine: EditorEngine, rowId: string): void {
  engine.applyTree((tree) => replaceNode(tree, rowId, []))
}

/** Table: append a column (empty cell on every row). One undo step. */
export function tableAddColumn(engine: EditorEngine, tableId: string): void {
  engine.applyTree((tree) => tableAddColumnTree(tree, tableId))
}

export function tableAddColumnTree(tree: BlockNode, tableId: string): BlockNode {
  const table = findBlock(tree, tableId)
  if (!table) return tree
  const rows = table.children.map((row) =>
    withChildren(row, [...row.children, leafBlock(`${row.id}-nc`, BlockType.TableCell, '')])
  )
  return replaceNode(tree, tableId, [withChildren(table, rows)])
}

/** Table: insert an empty column at `index` on every row (menu
 *  addColumnBefore/addColumnAfter — plan 026 P0T3). */
export function tableAddColumnAtTree(tree: BlockNode, tableId: string, index: number): BlockNode {
  const table = findBlock(tree, tableId)
  if (!table) return tree
  const rows = table.children.map((row) => {
    const cells = [...row.children]
    const at = Math.max(0, Math.min(index, cells.length))
    cells.splice(at, 0, leafBlock(`${row.id}-nc${at}`, BlockType.TableCell, ''))
    return withChildren(row, cells)
  })
  return replaceNode(tree, tableId, [withChildren(table, rows)])
}

/** Table: delete column `index` from every row; refuses to empty the table
 *  (menu deleteColumn — plan 026 P0T3). */
export function tableDeleteColumnAtTree(tree: BlockNode, tableId: string, index: number): BlockNode {
  const table = findBlock(tree, tableId)
  if (!table) return tree
  if ((table.children[0]?.children.length ?? 0) <= 1) return tree
  const rows = table.children.map((row) => withChildren(row, row.children.filter((_, i) => i !== index)))
  return replaceNode(tree, tableId, [withChildren(table, rows)])
}

/** Table: delete the last column of every row. One undo step. */
export function tableDeleteColumn(engine: EditorEngine, tableId: string): void {
  engine.applyTree((tree) => {
    const table = findBlock(tree, tableId)
    if (!table) return tree
    const rows = table.children.map((row) => withChildren(row, row.children.slice(0, -1)))
    return replaceNode(tree, tableId, [withChildren(table, rows)])
  })
}

/** Move a block up/down one position within its parent (drag parity). */
export function moveBlock(engine: EditorEngine, id: string, dir: -1 | 1): void {
  engine.applyTree((tree) => {
    const parent = parentOf(tree, id)
    if (!parent) return tree
    const idx = childIndex(parent, id)
    const target = idx + dir
    if (target < 0 || target >= parent.children.length) return tree
    const kids = [...parent.children]
    const [moved] = kids.splice(idx, 1)
    kids.splice(target, 0, moved)
    return replaceNode(tree, parent.id, [withChildren(parent, kids)])
  })
}

/** Set attrs on a block (heading level etc. — completes the input rule). */
export function setBlockAttrs(engine: EditorEngine, id: string, attrs: Attr[]): void {
  engine.applyTree((tree) => {
    const found = findBlock(tree, id)
    if (!found) return tree
    let next = found
    for (const a of attrs) next = { ...next, attrs: attrSet(next.attrs, a.key, a.value) }
    return replaceNode(tree, id, [next])
  })
}

// -- mark commands (plan 024 Phase 0): spans resplit + whole-block withInlines
//    writeback through applyTree — ONE undo step each, same protocol as the
//    table ops above (the op kernel has no mark op by v1 ruling).

function applyMarkTree(tree: BlockNode, blockId: string, resplit: (spans: InlineSpan[]) => InlineSpan[]): BlockNode {
  const found = findBlock(tree, blockId)
  if (!found) return tree
  return replaceNode(tree, blockId, [withInlines(found, resplit(found.inlines))])
}

/** Toggle a mark over [lo, hi) of the block's inline text. One undo step. */
export function toggleMark(engine: EditorEngine, blockId: string, lo: number, hi: number, mark: Mark): void {
  engine.applyTree((tree) => applyMarkTree(tree, blockId, (spans) => toggleMarkOnSpans(spans, lo, hi, mark)))
}

/** Link [lo, hi) to href (replacing any previous href). One undo step. */
export function setLink(engine: EditorEngine, blockId: string, lo: number, hi: number, href: string): void {
  engine.applyTree((tree) => applyMarkTree(tree, blockId, (spans) => setLinkOnSpans(spans, lo, hi, href)))
}

/** Marks active over the engine selection — the adapter isActive source.
 *  Cross-block selections collapse to the anchor position (v1: single-block). */
export function marksInRange(engine: EditorEngine, sel: Selection): Mark[] {
  const found = findBlock(engine.doc, sel.anchor.blockId)
  if (!found) return []
  if (sel.anchor.blockId !== sel.head.blockId) return marksAtRange(found.inlines, sel.anchor.offset, sel.anchor.offset)
  const lo = Math.min(sel.anchor.offset, sel.head.offset)
  const hi = Math.max(sel.anchor.offset, sel.head.offset)
  return marksAtRange(found.inlines, lo, hi)
}

// -- on-demand block anchoring (Obsidian-compatible lazy ^ids) -----------------

/** Short persistent anchor id (7 base62 chars) — Obsidian-style, unlike the
 *  engine-internal `block-N` / `b-xxxxxx` fallbacks which never serialize. */
export function generateAnchorId(used: Set<string>): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined
  const rand = (): number => {
    if (cryptoObj?.getRandomValues) {
      const buf = new Uint32Array(1)
      cryptoObj.getRandomValues(buf)
      return buf[0]! % alphabet.length
    }
    return Math.floor(Math.random() * alphabet.length)
  }
  for (let attempt = 0; attempt < 64; attempt++) {
    let id = ''
    for (let i = 0; i < 7; i++) id += alphabet[rand()]!
    if (!used.has(id)) return id
  }
  return `a${Date.now().toString(36).slice(-6)}`
}

/** Return the block's persistent anchor, assigning one on demand (copy-block
 *  link on a not-yet-anchored block). One undo step; emits change so the
 *  autosave persists the new anchor. Returns null when the id is unknown. */
export function ensureBlockAnchor(engine: EditorEngine, id: string): string | null {
  const found = findBlock(engine.doc, id)
  if (!found) return null
  const existing = anchorOf(found)
  if (existing) return existing
  const used = new Set<string>()
  const walk = (n: BlockNode): void => {
    used.add(n.id)
    n.children.forEach(walk)
  }
  walk(engine.doc)
  const anchor = generateAnchorId(used)
  engine.applyTree((tree) => retargetAnchor(tree, id, anchor))
  return anchor
}
