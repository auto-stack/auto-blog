// BlockWidget family mechanism (plan 033 D1) — hand-written platform layer,
// same pattern as block-component.ts: never generated.
//
// The family sugar: one .at widget per block kind serves all three modes
// (view / stream / edit) behind a single `mode` prop, so the chrome (DOM
// skeleton / class chain / styles) has exactly one source — cross-mode style
// drift becomes structurally impossible. registerBlockWidget wraps the
// widget into the three BlockComponent slot factories; the per-slot
// registerBlockComponent API stays untouched (the family is sugar, not a
// replacement).
//
// panelOf mounts the same widget on the panel-registry custom slot, so the
// view face reaches BOTH panel consumers (editor preview panes and static
// render) through the same component — one widget, every consumption face.

import { h, type Component, type VNode } from 'vue'
import type { Attr, BlockNode } from '../parser/block-model'
import { BlockType, Value, span } from '../parser/block-model'
import type { WNode } from '../parser/markdown-parser'
import type { BlockComponent, BlockEditCtx } from './block-component'
import { registerBlockComponent, unregisterBlockComponent } from './block-component'
import { blockOfWNode } from './block-wnode'
import type { PanelRenderCtx, PanelRenderer, PanelBodyDecorator } from './panel-registry'
import { currentPanelDecorator } from './panel-registry'

export type BlockWidgetMode = 'view' | 'stream' | 'edit'

export interface BlockWidgetProps {
  mode: BlockWidgetMode
  /** the block's model — payload shape is the same in every mode */
  node: BlockNode
  /** stream consumption: false while the segment is still open */
  final?: boolean
  /** edit consumption (engine / blockId / readonly) */
  ctx?: BlockEditCtx
}

/** Register one widget as a kind's whole family: the three BlockComponent
 *  slots become thin wrappers that mount the widget with the right mode.
 *  A family registration owns all three slots (it replaces earlier
 *  per-slot registrations for the kind). Family widgets declare the four
 *  family props (mode/node/final/ctx); the non-edit wrappers pass ctx: null
 *  so the generated required-prop checks stay quiet.
 *
 *  `slots` (plan 042 T2) overrides individual slot factories for kinds whose
 *  faces need more than the generic four props: the container families'
 *  edit faces take the assembly-injected children/items closures (see
 *  BlockEditCtx), Table's faces take flat chrome data. The override still
 *  participates in the family semantics — ONE registration call owns all
 *  three slots for the kind. */
export function registerBlockWidget(
  kind: string,
  widget: Component,
  slots: Partial<Pick<BlockComponent, 'view' | 'stream' | 'edit'>> = {},
): void {
  registerBlockComponent(kind, {
    view: slots.view ?? ((node, final) => h(widget, { mode: 'view', node, final, ctx: null })),
    stream: slots.stream ?? ((node, final) => h(widget, { mode: 'stream', node, final, ctx: null })),
    edit: slots.edit ?? ((node, ctx) => h(widget, { mode: 'edit', node, ctx })),
  })
}

/** Drop a kind's family registration (builtin fallback resumes). */
export function unregisterBlockWidget(kind: string): void {
  unregisterBlockComponent(kind)
}

/** Wrap a family widget as a PanelRenderer — the panel face of view mode.
 *  The registry WNode resolves back to its model BlockNode when the editor
 *  bridge produced it; parse-side WNodes (static render, no back-link) get a
 *  fabricated model from the WNode slots (code/language -> inlines/attrs),
 *  the same shape EngineEditor's node-view fallback built (plan 030). */
export function panelOf(widget: Component): PanelRenderer {
  return (ctx: PanelRenderCtx): VNode => {
    const node = blockOfWNode(ctx.node) ?? wnodeFallbackModel(ctx.node)
    return h(widget, { mode: 'view', node, final: ctx.final ?? true, ctx: null })
  }
}

/** Static-render fallback model for the widget kinds (fence/math/mermaid +
 *  query/embed, plan 038 T6): WNode slot data re-shaped into the model the
 *  widget faces read — source in inlines, fence language + the 032
 *  open-fence loading flag in attrs, the query text (content slot, T3
 *  bridge) and embed src (src slot) in attrs. */
function wnodeFallbackModel(w: WNode): BlockNode {
  const attrs: Attr[] = []
  const src = typeof w?.code === 'string' ? w.code : ''
  if (w?.type === 'code_block') {
    attrs.push({ key: 'language', value: Value.Str(String(w.language ?? '')) })
    if (w?.loading === true) attrs.push({ key: 'loading', value: Value.Bool(true) })
  }
  if (w?.type === 'query') attrs.push({ key: 'query', value: Value.Str(String(w.content ?? '')) })
  if (w?.type === 'embed') attrs.push({ key: 'src', value: Value.Str(String(w.src ?? '')) })
  return {
    id: 'nv',
    kind: kindOfWNode(w?.type ?? ''),
    attrs,
    children: [],
    inlines: src.length > 0 ? [span(src)] : [],
    source: { start: 0, end: 0 },
  } as unknown as BlockNode
}

function kindOfWNode(type: string): BlockType {
  if (type === 'code_block') return BlockType.Fence
  if (type === 'mermaid') return BlockType.Mermaid
  if (type === 'query') return BlockType.QueryBlock
  if (type === 'embed') return BlockType.BlockEmbed
  return BlockType.MathBlock
}

// -- container families (plan 035 T6) --------------------------------------------
//
// The container widgets (Callout/Details/Blockquote/List) read their chrome
// off the model node's attrs and mount the block bodies through the
// BlockChildren hole — the panel face feeds that hole with the registry's
// renderEmbedded closure, so the widget template owns the chrome while the
// panel pipeline feeds the body (the recursion stays at the single
// assembly point).

/** Fabricate a CONTAINER model for parse-side WNodes (static render, no
 *  back-link): the slot data the widget faces read — callout type/title
 *  (language/title slots), details summary/open (text/loading), list
 *  ordered/start — re-shaped into attrs. The container sibling of
 *  wnodeFallbackModel. */
function containerFallbackModel(w: WNode): BlockNode {
  const attrs: Attr[] = []
  if (w?.type === 'callout') {
    attrs.push({ key: 'type', value: Value.Str(String(w.language ?? '')) })
    attrs.push({ key: 'title', value: Value.Str(String(w.title ?? '')) })
  }
  if (w?.type === 'details') {
    attrs.push({ key: 'summary', value: Value.Str(String(w.text ?? '')) })
    if (w?.loading === true) attrs.push({ key: 'open', value: Value.Bool(true) })
  }
  if (w?.type === 'list') {
    attrs.push({ key: 'ordered', value: Value.Bool(w.ordered === true) })
    attrs.push({ key: 'start', value: Value.Int(typeof w.start === 'number' ? w.start : 1) })
  }
  return {
    id: 'nv',
    kind: BlockType.Paragraph,
    attrs,
    children: [],
    inlines: [],
    source: { start: 0, end: 0 },
  } as unknown as BlockNode
}

/** The panel model of a container WNode: the editor bridge's back-link when
 *  present, the fabricated static-render model otherwise. */
export function containerPanelModel(w: WNode): BlockNode {
  return blockOfWNode(w) ?? containerFallbackModel(w)
}

/** Wrap a CONTAINER family widget as a PanelRenderer — panelOf's container
 *  sibling: the children hole gets the renderEmbedded closure (view mode,
 *  final forwarded verbatim; verbed faces like the details marker get their
 *  engine from the editor-side registration's live host window). The body
 *  closure applies the captured panel body decorator (plan 035 T6): the
 *  outer editor decoration pass cannot descend into component props, so
 *  wikilink decoration rides the closure instead. */
export function panelOfContainer(widget: Component): PanelRenderer {
  return (ctx: PanelRenderCtx): VNode => {
    const final = ctx.final ?? true
    const dec = currentPanelDecorator()
    return h(widget, {
      mode: 'view',
      node: containerPanelModel(ctx.node),
      final,
      ctx: null,
      children: decorateBody(dec, () => ctx.renderEmbedded(ctx.node.children ?? [], final, ctx.budget)),
      version: 0,
    })
  }
}

/** The list panel adapter: WNode items flattened to the widget's chrome
 *  data ({id, task, checked, cls, children_slot}) — renderListPanel's
 *  reads, item for item (the retired builtin's shape, byte-for-byte; the
 *  item bodies carry the captured panel decorator — see panelOfContainer). */
export function listItemsOfPanel(ctx: PanelRenderCtx): unknown[] {
  const final = ctx.final ?? true
  const dec = currentPanelDecorator()
  return ((ctx.node as WNode).items ?? []).map((item: any, i: number) => ({
    id: `li-${i}`,
    task: item.checked != null,
    checked: item.checked === true,
    cls: 'list-item' + (item.checked != null ? ' task-item' : ''),
    children_slot: decorateBody(dec, () => ctx.renderEmbedded(item.children ?? [], final, ctx.budget)),
  }))
}

// -- table family (plan 037 T3; cells inline since musk plan 072) -------------------
//
// The table panel adapter: WNode header/rows flattened to the widget's flat
// cell data ({id, cls, children_slot}) — the retired tablePanel's reads,
// cell for cell (dir/align class/inline body). The edit adapter's cell
// shape is {id, text, cls} over the model — same flat boundary, the fields
// each face reads (view never reads text; edit owns it). The children hole
// carries the captured panel decorator (the 035 T6 idiom — the outer
// decorateWikilinks walker cannot descend into component props).
//
// Cell bodies ride renderInlineChildren, NOT renderEmbedded: the parser
// builds cells with parseInline, so every child is an inline node — block
// dispatch wrapped them in node-slot divs (vertical stacking) and the
// unknown-node fallback printed the bare type name (`inline_code`) for
// kinds with no panel.

/** The retired tablePanel's alignClass, verbatim. */
function tableAlignClass(cell: any): string {
  if (cell?.align === 'center') return 'text-center'
  if (cell?.align === 'right') return 'text-right'
  return 'text-left'
}

function tableCellsOfPanel(ctx: PanelRenderCtx, cells: unknown[]): unknown[] {
  const final = ctx.final ?? true
  const dec = currentPanelDecorator()
  return (cells ?? []).map((cell: any, i: number) => ({
    id: `cell-${i}`,
    cls: tableAlignClass(cell),
    children_slot: decorateBody(dec, () => ctx.renderInlineChildren(cell.children ?? [], final, ctx.budget)),
  }))
}

/** plan 019: the WNode carries the table header as a 0-or-1 array. */
export function tableHeaderCellsOfPanel(ctx: PanelRenderCtx): unknown[] {
  return tableCellsOfPanel(ctx, (ctx.node as WNode).header?.[0]?.cells ?? [])
}

export function tableRowsOfPanel(ctx: PanelRenderCtx): unknown[] {
  return ((ctx.node as WNode).rows ?? []).map((row: any, i: number) => ({
    id: `tr-${i}`,
    cells: tableCellsOfPanel(ctx, row.cells),
  }))
}

/** Wrap a body closure so its vnodes get the construction-time decorator
 *  applied before they mount (shared by the render-side panel adapters and
 *  EngineEditor's editor-side Details registration). renderEmbedded returns
 *  a SINGLE vnode (the markdown-renderer div) — normalized to the array
 *  decorateWikilinks mutates in place; the rendered DOM is identical. */
export function decorateBody(dec: PanelBodyDecorator | null, body: () => VNode | VNode[]): () => VNode[] {
  return () => {
    const raw = body()
    const out: VNode[] = Array.isArray(raw) ? raw : [raw]
    if (dec) dec(out)
    return out
  }
}
