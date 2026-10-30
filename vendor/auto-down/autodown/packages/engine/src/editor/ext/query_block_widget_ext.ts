// query_block_widget_ext.ts — platform bridge for the QueryBlockWidget
// (plan 038 T4): the query family's view/stream widget, absorbing the
// retired QueryBlockNodeView's ext surface (normalizeQueryResults /
// errorMessage came from node_view_ext.ts) plus the family readers:
//
// 1. queryText — typed reader for the family's wide node prop: the model
//    attr `query` (the T3 bridge carries it onto the WNode content slot,
//    the fallback model reshapes it back into the attr).
// 2. queryRunner — the module-level data-loader slot read (plan 038 T1):
//    null when unconfigured, the widget's "No query runner configured"
//    placeholder branch. The node view read extension.options.runQuery;
//    the family widget has no node-view props, so the read moves here.
// 3. normalizeQueryResults — verbatim from node_view_ext.ts: precomputes
//    result.source (`title || page_path`) and result.priority_label
//    (`[#${priority}]`) — per-item template expressions are not
//    expressible in the widget DSL view.
// 4. errorMessage — the catch-branch `err.message || String(err)`
//    extraction; TS types the catch param `unknown` and the DSL has no
//    casts.
//
// Deployed verbatim to src/editor/ext/query_block_widget_ext.ts by gen.mjs
// (assert-editor-gen guards the byte sync).

import { attrGetStr, type BlockNode } from '../../parser/block-model'
import { getDataLoaders, type RunQueryFn } from '../engine/data-loaders'

/** The family node prop's query text (attrs.query — '' when absent). */
export function queryText(node: BlockNode | undefined): string {
  return attrGetStr(node?.attrs ?? [], 'query', '')
}

/** The registered query runner (null = the placeholder state — the
 *  EngineEditor runQuery prop never arrived). */
export function queryRunner(): RunQueryFn | null {
  return getDataLoaders().runQuery ?? null
}

// normalizeQueryResults — the QueryBlock result list with the template's
// `result.title || result.page_path` fallback precomputed as `source` and
// the priority badge's `[#${priority}]` interpolation precomputed as
// `priority_label` (per-item template expressions are not expressible in
// the widget DSL view — see the header comment).
export function normalizeQueryResults(res: any): any[] {
  const list = (res && res.results) || []
  return list.map((r: any) => ({
    ...r,
    source: r.title || r.page_path,
    priority_label: r.priority ? `[#${r.priority}]` : '',
  }))
}

// errorMessage — the originals' `err.message || String(err)` catch-branch
// extraction. TS types the catch param `unknown` under strict mode (no
// annotation/cast syntax exists for it), and the DSL has no casts, so the
// narrowing lives here.
export function errorMessage(e: unknown): string {
  return (e as any)?.message || String(e)
}
