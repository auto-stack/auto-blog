// Panel registry (plan 017 Phase 2): resolves a block node to its view
// panel spec (palette-map.generated, single source from auto/palette_map.at)
// and to a panel renderer — a consumer-pluggable function per panel kind.
//
// Resolution order: custom registration (registerPanel) → builtin renderer
// (builtin-panels) → degrade (unknown-node div). Extension panels
// (Callout / Details / MathBlock / Mermaid / Query / Embed) have NO builtin
// renderer by design (plan 017 待澄清 #2 — 注册位): consumers inject them;
// absent registrations degrade gracefully.

import type { VNode } from 'vue'
import { panelHeading, panelOfBlock, type PanelSpec } from './palette-map.generated'
import { builtinPanelRenderers } from './builtin-panels'

export interface RevealBudget {
  /** characters of inline text still revealable (typewriter); Infinity = all */
  remaining: number
}

export interface PanelRenderCtx {
  node: any
  final: boolean | undefined
  budget: RevealBudget | undefined
  spec: PanelSpec
  /** nested block content (li body, quote body, table cells) */
  renderEmbedded(children: any[], final: boolean | undefined, budget?: RevealBudget): VNode
  /** inline children of the panel's text content */
  renderInlineChildren(children: any[] | undefined, final: boolean | undefined, budget?: RevealBudget): VNode[]
}

export type PanelRenderer = (ctx: PanelRenderCtx) => VNode

const customRenderers: Record<string, PanelRenderer> = {}

/** Register a panel renderer. Overrides the builtin for the same kind
 *  (the extension slots have no builtin to override). */
export function registerPanel(kind: string, renderer: PanelRenderer): void {
  customRenderers[kind] = renderer
}

/** Remove a custom registration, falling back to the builtin renderer. */
export function unregisterPanel(kind: string): void {
  delete customRenderers[kind]
}

/** Test/teardown helper: drop every custom registration at once. */
export function clearPanelRegistry(): void {
  for (const key of Object.keys(customRenderers)) delete customRenderers[key]
}

/** Panel spec for a parsed block node. Headings resolve through their
 *  level (H1..H6); everything else maps by block type. */
export function specForNode(node: any): PanelSpec {
  if (node?.type === 'heading') return panelHeading(node.level)
  return panelOfBlock(node?.type ?? '')
}

export function resolvePanelRenderer(spec: PanelSpec): PanelRenderer | undefined {
  return customRenderers[spec.kind] ?? builtinPanelRenderers[spec.kind]
}

export type { PanelSpec }

// -- panel body decorator (plan 035 T6) ------------------------------------------
//
// Container family widgets mount their bodies through the BlockChildren
// hole — closures the outer decorateWikilinks pass CANNOT descend into
// (component props are opaque to the walker). The editor's preview path
// therefore registers its decorator HERE for the duration of a renderNodes
// call; the container panel adapters capture the current decorator at
// closure-construction time (inside the window) and apply it to the body
// vnodes at evaluation time (component mount, long after the window
// closed). Non-container panels keep the plain tree the top-level pass
// decorates, so the two channels never overlap.

export type PanelBodyDecorator = (vnodes: VNode[]) => void

let activePanelDecorator: PanelBodyDecorator | null = null

/** Run fn with the panel body decorator active (window semantics — same
 *  shape as the editor's node-view host window). */
export function withPanelDecorator<T>(dec: PanelBodyDecorator, fn: () => T): T {
  const prev = activePanelDecorator
  activePanelDecorator = dec
  try {
    return fn()
  } finally {
    activePanelDecorator = prev
  }
}

/** The decorator active at closure-construction time (null outside a
 *  window — static render stays undecorated). */
export function currentPanelDecorator(): PanelBodyDecorator | null {
  return activePanelDecorator
}
