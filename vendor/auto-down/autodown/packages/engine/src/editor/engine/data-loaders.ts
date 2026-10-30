// Data-loader slot (plan 038 T1) — the module-level channel the
// EngineEditor props watch feeds and the deep render surfaces (node-view
// bridge now; pure-render consumers later) read. The same shape problem as
// the node-view host window: the nodeViewProps fabricator sits at the
// bottom of the render pipeline with no component-tree context, so the
// loaders register once at module scope and the assembling editor's watch
// keeps them current (hostStack sibling pattern — but persistent, not
// windowed: static renders read the SAME registrations, they only fire
// from final-mounted widgets).
//
// Un-set loaders read as undefined and the widgets fall back to their
// "No query runner configured" / "No block loader configured" placeholder
// states — the pre-038 behavior, preserved for editor-less renders.

/** One row of a QueryResultEnvelope (jade's /api/query QueryResponse item —
 *  marker/priority/content plus the source-label pair; only content is
 *  required). */
export interface QueryResultItem {
  marker?: string
  priority?: number
  content: string
  title?: string
  page_path?: string
}

/** The query envelope: `{ results: QueryResultItem[] }` (jade's
 *  QueryResponse shape — normalizeQueryResults reads res.results). */
export interface QueryResultEnvelope {
  results: QueryResultItem[]
}

/** A loaded embedded block (jade's getBlock().block shape). */
export interface EmbeddedBlock {
  title?: string
  content: string
}

export type RunQueryFn = (q: string) => Promise<QueryResultEnvelope>
export type LoadBlockFn = (id: string) => Promise<EmbeddedBlock | null>

export interface DataLoaders {
  runQuery?: RunQueryFn
  loadBlock?: LoadBlockFn
}

let loaders: DataLoaders = {}

/** Register (or clear with an empty object) the data loaders. Replaces the
 *  whole slot — the EngineEditor props watch passes both keys every time,
 *  a partial object intentionally leaves the other loader unset. */
export function setDataLoaders(next: DataLoaders): void {
  loaders = { runQuery: next.runQuery, loadBlock: next.loadBlock }
}

/** The currently registered loaders (never null — read `.runQuery` /
 *  `.loadBlock` and undefined-check, the widget placeholder semantics). */
export function getDataLoaders(): DataLoaders {
  return loaders
}

/** Run fn with `next` as the active loaders, restoring the previous
 *  registration on exit (test seam; same window shape as
 *  pushNodeViewHost/popNodeViewHost). */
export function withDataLoaders<T>(next: DataLoaders, fn: () => T): T {
  const prev = loaders
  setDataLoaders(next)
  try {
    return fn()
  } finally {
    loaders = prev
  }
}
