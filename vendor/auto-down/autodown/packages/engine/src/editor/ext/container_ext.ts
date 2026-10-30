// container_ext.ts — Hand-written TS extension shared by the container
// family widgets (../callout_block_widget.at, ../details_block_widget.at,
// ../blockquote_block_widget.at, ../list_block_widget.at — plan 035). The
// gen pipeline copies this file into the transient gen project (never
// type-checked there) and deploys it verbatim to
// src/editor/ext/container_ext.ts; the generated SFCs import it from
// ../ext/container_ext (gen.mjs E1 rewrite).
//
// What lives here:
// 1. BlockChildren — the recursive child-mount hole (the plan 035 T1
//    platform component). The widgets embed it via `use { component }` and
//    pass the assembly-built children_slot closure: the recursion and ALL
//    its runtime state (epoch remounts 029, host registry, focus path)
//    stay at the single assembly point (EngineEditor's childrenOf adapter).
// 2. AttrHost — the generated single-line attr host widget (plan 035 T2),
//    embedded by the Callout title / Details summary faces.
// 3. The container flat chrome reads — attr strings off the model node
//    (attrGetStr), the CALLOUT_TYPES known-type check, and the wide ctx
//    accessors (engine/blockId/readonly) reused from the 033 family idiom.

import { attrGetBool, attrGetInt, attrGetStr, findBlock, Value, type BlockNode } from '../../parser/block-model'
import { CALLOUT_TYPES } from '../../render/builtin-panels'
import { setBlockAttrs } from '../engine/commands'
import type { EditorEngine } from '../engine/editor-engine'
import { ctxBlockId as ctxBlockIdOf } from './code_block_widget_ext'

export { BlockChildren } from '../components/BlockChildren'
export { default as AttrHost } from '../components/AttrHost.vue'
export { ctxReadonly, ctxBlockId, htmlText } from './code_block_widget_ext'

/** The ctx's engine — the controller-prop idiom (engine passed wide-typed,
 *  the 033 CodeBlockWidget fenceEditSlot ruling: controller = engine). */
export function ctxEngine(ctx: unknown): unknown {
  return (ctx as { engine?: unknown } | null | undefined)?.engine ?? null
}

/** One string attr off the model node ('' when absent). */
export function nodeAttrStr(node: BlockNode | undefined, key: string): string {
  return node ? attrGetStr(node.attrs, key, '') : ''
}

/** The builtin renderCalloutPanel known-type check (shared list). */
export function calloutTypeKnown(type: string): boolean {
  return CALLOUT_TYPES.includes(type)
}

/** One bool attr off the model node (default false). */
export function nodeAttrBool(node: BlockNode | undefined, key: string): boolean {
  return node ? attrGetBool(node.attrs, key, false) : false
}

/** One int attr off the model node (default 1 — the list start). */
export function nodeAttrInt(node: BlockNode | undefined, key: string): number {
  return node ? attrGetInt(node.attrs, key, 1) : 1
}

/** The edit face's ordered-list start attr: present only in edit mode on an
 *  ordered list (the builtin renderListPanel view carries no start attr —
 *  returning undefined omits it, the Vue attr rule). */
export function editOrderedStart(mode: string, ordered: boolean, start: number): number | undefined {
  return mode === 'edit' && ordered ? start : undefined
}

/** The task checkbox verb (edit face): flip `checked` through setBlockAttrs
 *  as ONE undo step — expandedElement's toggleTaskChecked, stopPropagation
 *  riding the DSL modifier. */
export function toggleTaskChecked(controller: unknown, itemId: string): void {
  const engine = controller as EditorEngine | null
  if (!engine || !itemId) return
  const item = findBlock(engine.doc, itemId)
  if (!item) return
  const cur = attrGetBool(item.attrs, 'checked', false)
  setBlockAttrs(engine, itemId, [{ key: 'checked', value: Value.Bool(!cur) }])
}

/** The block id a container verb addresses: the edit ctx's blockId, falling
 *  back to the model node's own id (the panel path passes no ctx). */
export function blockRef(node: BlockNode | undefined, ctx: unknown): string {
  const fromCtx = ctxBlockIdOf(ctx)
  if (fromCtx) return fromCtx
  return node?.id ?? ''
}

/** The details marker verb (both faces): flip `open` through setBlockAttrs
 *  as ONE undo step — the expandedElement inline onClick semantics, with
 *  stopPropagation riding the DSL modifier. */
export function toggleDetailsOpen(controller: unknown, blockId: string, open: boolean): void {
  const engine = controller as EditorEngine | null
  if (!engine || !blockId) return
  setBlockAttrs(engine, blockId, [{ key: 'open', value: Value.Bool(!open) }])
}
