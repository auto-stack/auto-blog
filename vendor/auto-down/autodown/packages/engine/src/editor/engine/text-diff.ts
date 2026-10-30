// Host text diff (plan 018 Phase 1): given the old and new plain text of a
// contenteditable host, produce the minimal 016 op. This is the bridge the
// Phase 2 host uses on `input` events (outside composition) and the paste
// path shares it after markdown parsing. Common prefix/suffix stripping —
// single-edit assumption matches how a caret edit mutates a text node.

import { InsertTextOp, Op, BlockPos, ReplaceRangeOp, Selection } from '../../parser/block-model'

export function diffToOp(blockId: string, oldText: string, newText: string): Op | null {
  if (oldText === newText) return null

  // common prefix
  let p = 0
  while (p < oldText.length && p < newText.length && oldText[p] === newText[p]) p++
  // common suffix (not overlapping the prefix)
  let s = 0
  while (
    s < oldText.length - p &&
    s < newText.length - p &&
    oldText[oldText.length - 1 - s] === newText[newText.length - 1 - s]
  )
    s++

  const removed = oldText.slice(p, oldText.length - s)
  const inserted = newText.slice(p, newText.length - s)

  if (removed.length === 0) {
    return Op.InsertText(new InsertTextOp(new BlockPos(blockId, p), inserted))
  }
  const sel = new Selection(new BlockPos(blockId, p), new BlockPos(blockId, p + removed.length))
  return Op.ReplaceRange(new ReplaceRangeOp(sel, inserted))
}
