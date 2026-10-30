// List/quote structural commands (plan 025 Phase 0) — container-level editing
// semantics on top of the deep-addressable block model. All commands are pure
// applyTree transforms (ONE undo step each, the 023 table-command precedent:
// the op kernel's WrapBlock/LiftBlock are left untouched by v1 ruling).
//
// Guardrails: no command ever leaves an empty ListBlock or a bare top-level
// ListItem behind — emptied containers dissolve. Commands routed by the host
// controller receive the focused nested PARAGRAPH id (blockText(ListItem) is
// always "" — editing an item means editing its paragraph).

import {
  Attr,
  BlockNode,
  BlockType,
  attrGet,
  attrOf,
  block,
  blockText,
  childIndex,
  collapsedSel,
  findBlock,
  hasIdDeep,
  leafBlock,
  parentOf,
  replaceNode,
  spansSplitAt,
  withChildren,
  withInlines,
} from '../../parser/block-model'
import type { EditorEngine } from './editor-engine'

/** Engine-internal id (never serializes — only anchor attrs do). */
function freshId(tree: BlockNode, prefix: string): string {
  for (;;) {
    const id = `${prefix}-${Math.random().toString(36).slice(2, 8)}`
    if (!hasIdDeep(tree, id)) return id
  }
}

interface ItemContext {
  para: BlockNode
  item: BlockNode
  list: BlockNode
  itemIndex: number
}

/** paragraph → ListItem → ListBlock context, or null when not in a list. */
function itemContextOf(tree: BlockNode, paragraphId: string): ItemContext | null {
  const para = findBlock(tree, paragraphId)
  if (!para) return null
  const item = parentOf(tree, paragraphId)
  if (!item || item.kind !== BlockType.ListItem) return null
  const list = parentOf(tree, item.id)
  if (!list || list.kind !== BlockType.ListBlock) return null
  return { para, item, list, itemIndex: childIndex(list, item.id) }
}

/** The last Paragraph child of an item (merge target), if any. */
function lastParagraphOf(item: BlockNode): { node: BlockNode; index: number } | null {
  for (let i = item.children.length - 1; i >= 0; i--) {
    const c = item.children[i]
    if (c.kind === BlockType.Paragraph) return { node: c, index: i }
  }
  return null
}

/** Copy the list attrs the serializer understands onto a fresh nested list. */
function copyListAttrs(list: BlockNode): Attr[] {
  const out: Attr[] = []
  const ordered = attrGet(list.attrs, 'ordered')
  if (ordered != null) out.push(attrOf('ordered', ordered))
  const start = attrGet(list.attrs, 'start')
  if (start != null) out.push(attrOf('start', start))
  return out
}

/** Lift `paragraphId` out of its list, keeping it before/after the list node.
 *  The emptied item drops out; an emptied ListBlock dissolves (guardrail). */
function exitListItem(engine: EditorEngine, paragraphId: string, place: 'before' | 'after'): void {
  if (!itemContextOf(engine.doc, paragraphId)) return
  engine.applyTree((tree) => {
    const c = itemContextOf(tree, paragraphId)
    if (!c) return tree
    const itemKids = c.item.children.filter((ch) => ch.id !== paragraphId)
    const listChildren = [...c.list.children]
    if (itemKids.length > 0) listChildren[c.itemIndex] = withChildren(c.item, itemKids)
    else listChildren.splice(c.itemIndex, 1)
    let repl: BlockNode[]
    if (listChildren.length === 0) repl = [c.para]
    else {
      const rest = withChildren(c.list, listChildren)
      repl = place === 'after' ? [rest, c.para] : [c.para, rest]
    }
    return replaceNode(tree, c.list.id, repl)
  })
  engine.select(collapsedSel(paragraphId, 0))
}

/** Enter inside a list item: split the tail into a following ListItem; an
 *  empty item exits the list instead (paragraph lands after it). */
export function enterInItem(engine: EditorEngine, paragraphId: string, offset: number): void {
  const ctx = itemContextOf(engine.doc, paragraphId)
  if (!ctx) return
  if (blockText(ctx.para) === '') {
    exitListItem(engine, paragraphId, 'after')
    return
  }
  const newParaId = freshId(engine.doc, 'b')
  const newItemId = freshId(engine.doc, 'li')
  engine.applyTree((tree) => {
    const c = itemContextOf(tree, paragraphId)
    if (!c) return tree
    const split = spansSplitAt(c.para.inlines, offset)
    const headItem = withChildren(
      c.item,
      c.item.children.map((ch) => (ch.id === paragraphId ? withInlines(c.para, split.before) : ch))
    )
    const tailItem = withChildren(block(newItemId, BlockType.ListItem), [
      withInlines(leafBlock(newParaId, BlockType.Paragraph, ''), split.after),
    ])
    const items = [...c.list.children]
    items.splice(c.itemIndex, 1, headItem, tailItem)
    return replaceNode(tree, c.list.id, [withChildren(c.list, items)])
  })
  engine.select(collapsedSel(newParaId, 0))
}

/** Backspace at offset 0 of an item paragraph: merge into the previous item's
 *  last paragraph (caret at the junction); a first item lifts out in place. */
export function backspaceAtItemStart(engine: EditorEngine, paragraphId: string): void {
  const ctx = itemContextOf(engine.doc, paragraphId)
  if (!ctx) return
  if (ctx.itemIndex === 0) {
    exitListItem(engine, paragraphId, 'before')
    return
  }
  let junctionId = ''
  let junctionOffset = 0
  engine.applyTree((tree) => {
    const c = itemContextOf(tree, paragraphId)
    if (!c || c.itemIndex === 0) return tree
    const prev = c.list.children[c.itemIndex - 1]
    const curOther = c.item.children.filter((ch) => ch.id !== paragraphId)
    const lastPara = lastParagraphOf(prev)
    let prevKids: BlockNode[]
    if (lastPara) {
      junctionId = lastPara.node.id
      junctionOffset = blockText(lastPara.node).length
      const merged = withInlines(lastPara.node, [...lastPara.node.inlines, ...c.para.inlines])
      prevKids = [...prev.children.map((ch, i) => (i === lastPara.index ? merged : ch)), ...curOther]
    } else {
      // degenerate item without a paragraph: the paragraph itself moves in
      junctionId = paragraphId
      junctionOffset = 0
      prevKids = [...prev.children, c.para, ...curOther]
    }
    const mergedItem = withChildren(prev, prevKids)
    const items = c.list.children.filter((_, i) => i !== c.itemIndex && i !== c.itemIndex - 1)
    items.splice(c.itemIndex - 1, 0, mergedItem)
    return replaceNode(tree, c.list.id, [withChildren(c.list, items)])
  })
  if (junctionId) engine.select(collapsedSel(junctionId, junctionOffset))
}

/** Tab: move the item into the previous item's nested list (created on
 *  demand, copying ordered/start). The first item cannot indent (no-op). */
export function indentItem(engine: EditorEngine, paragraphId: string): void {
  const ctx = itemContextOf(engine.doc, paragraphId)
  if (!ctx || ctx.itemIndex <= 0) return
  const nestedId = freshId(engine.doc, 'lb')
  engine.applyTree((tree) => {
    const c = itemContextOf(tree, paragraphId)
    if (!c || c.itemIndex <= 0) return tree
    const prev = c.list.children[c.itemIndex - 1]
    const existing = [...prev.children].reverse().find((ch) => ch.kind === BlockType.ListBlock)
    const nested = existing ?? {
      ...block(nestedId, BlockType.ListBlock),
      attrs: copyListAttrs(c.list),
    }
    const prevKids = prev.children.filter((ch) => ch.id !== nested.id)
    const newPrev = withChildren(prev, [...prevKids, withChildren(nested, [...nested.children, c.item])])
    const items = c.list.children.filter((_, i) => i !== c.itemIndex)
    items.splice(c.itemIndex - 1, 1, newPrev)
    return replaceNode(tree, c.list.id, [withChildren(c.list, items)])
  })
}

/** Shift+Tab: lift the item into the grandparent list right after the item
 *  that held its nested list. A top-level item cannot outdent (no-op). */
export function outdentItem(engine: EditorEngine, paragraphId: string): void {
  const ctx = itemContextOf(engine.doc, paragraphId)
  if (!ctx) return
  const holder = parentOf(engine.doc, ctx.list.id)
  if (!holder || holder.kind !== BlockType.ListItem) return
  engine.applyTree((tree) => {
    const c = itemContextOf(tree, paragraphId)
    if (!c) return tree
    const outer = parentOf(tree, c.list.id)
    if (!outer || outer.kind !== BlockType.ListItem) return tree
    const outerList = parentOf(tree, outer.id)
    if (!outerList) return tree
    const listKids = c.list.children.filter((ch) => ch.id !== c.item.id)
    const outerOther = outer.children.filter((ch) => ch.id !== c.list.id)
    const outerIdx = childIndex(outerList, outer.id)
    let outerItems: BlockNode[]
    if (outerOther.length > 0) {
      const newOuterKids =
        listKids.length > 0 ? [...outerOther, withChildren(c.list, listKids)] : outerOther
      const newOuter = withChildren(outer, newOuterKids)
      outerItems = outerList.children.map((ch, i) => (i === outerIdx ? newOuter : ch))
      outerItems.splice(outerIdx + 1, 0, c.item)
    } else {
      // the holder item becomes empty: the item takes its place
      outerItems = outerList.children.filter((_, i) => i !== outerIdx)
      outerItems.splice(outerIdx, 0, c.item)
    }
    return replaceNode(tree, outerList.id, [withChildren(outerList, outerItems)])
  })
}

/** Enter inside a blockquote paragraph: split into a continuation paragraph;
 *  an empty paragraph exits the quote instead. */
export function enterInQuote(engine: EditorEngine, paragraphId: string, offset: number): void {
  const para = findBlock(engine.doc, paragraphId)
  const q = para ? parentOf(engine.doc, paragraphId) : null
  if (!para || !q || q.kind !== BlockType.Blockquote) return
  if (blockText(para) === '') {
    exitQuote(engine, paragraphId)
    return
  }
  const newParaId = freshId(engine.doc, 'b')
  engine.applyTree((tree) => {
    const p = findBlock(tree, paragraphId)
    const quoteParent = p ? parentOf(tree, paragraphId) : null
    if (!p || !quoteParent || quoteParent.kind !== BlockType.Blockquote) return tree
    const split = spansSplitAt(p.inlines, offset)
    const idx = childIndex(quoteParent, paragraphId)
    const kids = [...quoteParent.children]
    kids[idx] = withInlines(p, split.before)
    kids.splice(idx + 1, 0, withInlines(leafBlock(newParaId, BlockType.Paragraph, ''), split.after))
    return replaceNode(tree, quoteParent.id, [withChildren(quoteParent, kids)])
  })
  engine.select(collapsedSel(newParaId, 0))
}

/** Lift the paragraph out of the quote (after it); an emptied quote dissolves. */
export function exitQuote(engine: EditorEngine, paragraphId: string): void {
  const para = findBlock(engine.doc, paragraphId)
  const q = para ? parentOf(engine.doc, paragraphId) : null
  if (!para || !q || q.kind !== BlockType.Blockquote) return
  engine.applyTree((tree) => {
    const p = findBlock(tree, paragraphId)
    const quoteParent = p ? parentOf(tree, paragraphId) : null
    if (!p || !quoteParent || quoteParent.kind !== BlockType.Blockquote) return tree
    const kids = quoteParent.children.filter((ch) => ch.id !== paragraphId)
    const repl = kids.length === 0 ? [p] : [withChildren(quoteParent, kids), p]
    return replaceNode(tree, quoteParent.id, repl)
  })
  engine.select(collapsedSel(paragraphId, 0))
}
