// BlockComponent contract (plan 023 P1T1) — hand-written bridge layer, same
// pattern as highlight.ts / block-wnode.ts: never generated.
//
// One component per block kind, three mode slots:
// - view(node, final)   final-state render = the existing panel pipeline
//                       (renderNodes over the BlockNode->WNode bridge)
// - stream(node, final) progressive render; defaults to undefined (streaming
//                       consumers keep their markdown-segment path)
// - edit(node, ctx)     typed editing surface (CodeEditorBlock / TableEditor
//                       / BlockHost fallback); defaults to undefined, which
//                       callers read as "use the BlockHost text fallback"
//
// Registry keys are canonical kind names (BlockType enum names: 'Fence',
// 'Table', ...). canonicalKind() maps render-model type strings ('table',
// 'code_block') and any casing to the same key, so the streaming assembly and
// the editor assembly resolve through one registry.
//
// Resolution: registered slots override per slot; slots the registration
// omits fall through to the builtin view (the panel pipeline). Registered
// components are consumers' editor/stream extensions — view-less
// registrations (P1T5 shape: edit-only) keep the builtin final-state render.

import { h, type VNode } from 'vue'
import { BlockNode } from '../parser/block-model'
import type { EditorEngine } from '../editor/engine/editor-engine'
import { blockNodeToWNode } from './block-wnode'
import { renderNodes } from './render-node'

export interface BlockEditCtx {
  /** command entry (applyOp / commands.ts chain) */
  engine: EditorEngine
  blockId: string
  /** v1 ruling (plan 023): true while streaming — editing face renders read-only */
  readonly: boolean
  /** container-family edit contract (plan 042): the assembly injects the
   *  children/items closures + its repaint version so the registered family
   *  edit slot mounts the widget with the focus-path recursion (deep hosts,
   *  epoch remounts) while the recursion itself stays at the single assembly
   *  point. Without the injection (a directly-selected container) the edit
   *  slot's own fallback renders the children through the preview pipeline. */
  children?: () => VNode[]
  items?: () => unknown[]
  version?: number
}

export interface BlockComponent {
  view(node: BlockNode, final: boolean): VNode
  stream?(node: BlockNode, final: boolean): VNode
  edit?(node: BlockNode, ctx: BlockEditCtx): VNode
}

/** Registry keys are canonical: 'Fence' / 'Table' / 'CodeBlock' / 'Details'... */
export function canonicalKind(kind: string): string {
  const parts = (kind ?? '').split(/[_-]+/).filter((p) => p.length > 0)
  if (parts.length === 0) return ''
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('')
}

const blockComponents: Record<string, Partial<BlockComponent>> = {}

/** Register (or extend) the component for a block kind. Slots omitted here
 *  fall through to the builtin view; call again to add more slots. */
export function registerBlockComponent(kind: string, comp: Partial<BlockComponent>): void {
  const key = canonicalKind(kind)
  blockComponents[key] = { ...blockComponents[key], ...comp }
}

/** Drop one kind's registration entirely (builtin fallback resumes). */
export function unregisterBlockComponent(kind: string): void {
  delete blockComponents[canonicalKind(kind)]
}

/** Test/teardown helper: drop every registration at once. */
export function clearBlockComponents(): void {
  for (const key of Object.keys(blockComponents)) delete blockComponents[key]
}

/** The builtin final-state component: the existing panel pipeline over the
 *  BlockNode->WNode bridge. Never registered — it IS the fallback. */
function builtinView(node: BlockNode, final: boolean): VNode {
  return renderNodes([blockNodeToWNode(node)], final)[0]
}

/** Resolve a kind's component. Returns a fully view-capable component in
 *  every case (registered slots win; missing slots get the builtin), so
 *  callers never null-check view. edit/stream stay undefined when neither a
 *  registration nor a builtin provides them — the caller's BlockHost
 *  fallback covers edit; streaming keeps the markdown segment path. */
export function resolveBlockComponent(kind: string): BlockComponent {
  const registered = blockComponents[canonicalKind(kind)]
  if (!registered) return { view: builtinView }
  return {
    view: registered.view ?? builtinView,
    stream: registered.stream,
    edit: registered.edit,
  }
}

/** Convenience: a registered edit slot as a VNode factory, or undefined when
 *  the kind has no typed editing face (use BlockHost). */
export function editSlotFor(kind: string): ((node: BlockNode, ctx: BlockEditCtx) => VNode) | undefined {
  return resolveBlockComponent(kind).edit
}

/** Vue-side wrapper helper: mount an SFC component as an edit slot. */
export function sfcEditSlot(comp: unknown): (node: BlockNode, ctx: BlockEditCtx) => VNode {
  return (node, ctx) => h(comp as any, { node, ctx })
}
