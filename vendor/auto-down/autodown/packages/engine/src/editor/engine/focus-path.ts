// Focus path resolution (plan 025 Phase 1) — the deep-selection primitives
// the assembly needs. The model addresses blocks recursively
// (findBlock/parentOf); these helpers resolve WHICH block actually takes
// focus (containers never host — the deepest editable leaf or a registered
// edit face does) and WHICH ancestors render expanded along the way.

import { BlockNode, BlockType, parentOf } from '../../parser/block-model'
import { editSlotFor } from '../../render/block-component'
import { isEditableLeaf } from './host-controller'

/** Ancestor ids of `focusedId` up to (excluding) the document root — the
 *  containers that render EXPANDED while the focus sits inside them. Every
 *  subtree hanging off this chain stays preview. */
export function focusPathOf(tree: BlockNode, focusedId: string): Set<string> {
  const path = new Set<string>()
  if (!focusedId) return path
  let cur = focusedId
  for (;;) {
    const parent = parentOf(tree, cur)
    if (!parent || parent === tree) break
    path.add(parent.id)
    cur = parent.id
  }
  return path
}

/** Composite container kinds (plan 042): their family edit face is a CARD
 *  whose children stay individually addressable — focus keeps descending to
 *  the deepest editable leaf, so one click lands the caret in the text (the
 *  atomic-face rule below applies to kinds like Fence/Table whose edit face
 *  is the whole block). Without this exemption the registered container edit
 *  slots would capture focus on the card itself and deep editing would need
 *  a second click. Exported for click-caret's wrapper pairing (same ruling,
 *  one source). */
export const COMPOSITE_CONTAINER_KINDS = new Set<number>([
  BlockType.Callout,
  BlockType.Details,
  BlockType.Blockquote,
  BlockType.ListBlock,
])

/** Can this node take direct focus (host an editing face)? Registered edit
 *  faces (Fence/Table) stop the descent — focusing a table means the table
 *  face, not its first cell. Composite containers never host directly (the
 *  descent rule above); an empty container resolves to null today, same as
 *  before its family registration. */
function isFocusTarget(node: BlockNode): boolean {
  if (COMPOSITE_CONTAINER_KINDS.has(node.kind)) return false
  return editSlotFor(BlockType[node.kind]) != null || isEditableLeaf(node)
}

/** The block that actually takes focus when `node` is selected: containers
 *  resolve to their first focusable descendant; leaves / edit faces stay.
 *  Null when the subtree has nothing focusable (e.g. a lone ThematicBreak). */
export function focusTargetOf(node: BlockNode): BlockNode | null {
  if (isFocusTarget(node)) return node
  for (const child of node.children) {
    const target = focusTargetOf(child)
    if (target) return target
  }
  return null
}

/** Last focusable block of the subtree (Ctrl+End lands here): post-order,
 *  last child first. */
export function lastFocusTargetOf(node: BlockNode): BlockNode | null {
  if (isFocusTarget(node)) return node
  for (let i = node.children.length - 1; i >= 0; i--) {
    const target = lastFocusTargetOf(node.children[i])
    if (target) return target
  }
  return null
}
