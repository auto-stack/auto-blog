// Builtin panel renderers (plan 017 Phase 2). One entry per builtin panel
// kind from auto/palette_map.at (Text, H1..H6, Separator, Quote) — Callout
// joined in plan 030 and left again in plan 035 T6 with List (the container
// families' widgets own both panel faces now, custom slot via
// block-widget-panels.ts). The DOM shape is byte-identical to the
// pre-registry render-node switch — the render.test.ts DOM contract and
// the downstream chrome (scroll sync, code-header injection, CSS) pin it.
//
// Table is NOT here anymore (plan 032 P2): the single table implementation
// (progressive + terminal faces) lives in StreamingTable.vue and mounts on
// the registry's custom slot — see render-node's side-effect import.
//
// Codeblock is NOT here anymore either (plan 033 T5): the fence family
// widget (auto/editor/code_block_widget.at — view/stream/edit one chrome)
// owns the panel face now, registered on the custom slot by
// block-widget-panels.ts, same channel Table pioneered. The retired
// renderCodeblockPanel's DOM contract is absorbed byte-for-byte (the
// widget's ext bridge viewCodeInner + the 032 loading family).
//
// Extension panel kinds (Details/MathBlock/Mermaid/Query/Embed) deliberately
// have no entry here: consumers register them (see panel-registry.ts and
// PANEL-ALIGNMENT.md). Callout and List are the same shape since plan 035
// T6: the container family widgets register on the custom slot
// (block-widget-panels.ts) — Callout's 030-era builtin residency retired.

import { h, type VNode } from 'vue'
import type { PanelRenderCtx, PanelRenderer } from './panel-registry'

function renderTextPanel({ node, final, budget, renderInlineChildren }: PanelRenderCtx): VNode {
  if (node.type === 'text') {
    // a bare text block (e.g. inside a table cell)
    return h('span', { class: 'whitespace-pre-wrap break-words text-node' }, [h('span', node.content)])
  }
  return h('p', { class: 'paragraph-node', dir: 'auto' }, renderInlineChildren(node.children, final, budget))
}

function renderHeadingPanel({ node, final, budget, renderInlineChildren }: PanelRenderCtx): VNode {
  const level = Math.min(6, Math.max(1, node.level))
  return h(`h${level}`, { class: `heading-node heading-${level}`, dir: 'auto' }, [
    ...renderInlineChildren(node.children, final, budget),
  ])
}

function renderSeparatorPanel(): VNode {
  return h('hr', { class: 'hr-node' })
}

function renderQuotePanel({ node, final, budget, renderEmbedded }: PanelRenderCtx): VNode {
  return h('blockquote', { class: 'blockquote', dir: 'auto' }, [
    renderEmbedded(node.children, final, budget),
  ])
}

// Callout card chrome (plan 030). Class chain is the single CSS channel:
// .autodown-callout* styles live in autodown-editor.css; the palette spec
// adds the .callout-node tag; data-callout-type carries the type for
// downstream consumers. Since plan 035 T6 the card chrome itself lives in
// the family widget (auto/editor/callout_block_widget.at — the widget's
// ext bridge reads this list for the known-type icon); this list stays the
// shared vocabulary.
export const CALLOUT_TYPES = ['note', 'info', 'tip', 'warning', 'caution', 'danger', 'error']

const headingRenderer: PanelRenderer = renderHeadingPanel

export const builtinPanelRenderers: Record<string, PanelRenderer> = {
  Text: renderTextPanel,
  H1: headingRenderer,
  H2: headingRenderer,
  H3: headingRenderer,
  H4: headingRenderer,
  H5: headingRenderer,
  H6: headingRenderer,
  Separator: renderSeparatorPanel,
  Quote: renderQuotePanel,
  // List and Callout are NOT here anymore (plan 035 T6): the container
  // families' widgets own those panel faces, registered on the custom slot
  // by block-widget-panels.ts (same channel Codeblock took in 033).
}
