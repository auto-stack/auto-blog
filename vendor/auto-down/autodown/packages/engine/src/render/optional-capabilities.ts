// Optional heavy capabilities (plan 008, goal 3): katex / mermaid / syntax
// highlighting become opt-in registrations instead of unconditional
// dependencies. The parse subset (auto/markdown_parser.at) does not emit
// math / mermaid nodes yet (whitelisted), so these entries currently only
// record intent; when the subset grows, renderers are injected here and the
// library keeps working (degraded plain rendering) when they are absent.
//
// The highlight implementation slot itself lives in highlight.ts (the
// platform bridge); enableHighlight just flips the switch and optionally
// binds an implementation in the same call.

import { setHighlightImpl, type HighlightFn } from './highlight'

export type { HighlightFn } from './highlight'
// type-only: RenderedArtifact lives in preview.ts (the artifact contract's
// home, plan 031 D6); a value import would pull katex/mermaid into this
// dependency-light module, the type erases at compile.
import type { RenderedArtifact } from './preview'

export type NodeRendererFactory = () => unknown

/** Host-injected artifact persistence (plan 031 D6): the engine never
 *  touches disk — a host (demo in-memory, VM disk cache + resvg later)
 *  registers a store and successful FINAL renders land in it keyed by
 *  artifactHash (single-source, TS/rust byte-identical). `get` is for
 *  tests and VM consumption demos; the web live render never reads it. */
export interface ArtifactStore {
  get(key: string): RenderedArtifact | undefined
  put(key: string, artifact: RenderedArtifact): void
}

interface CapabilityEntry {
  enabled: boolean
  factory?: NodeRendererFactory
}

const registry: Record<string, CapabilityEntry> = {}

function setEntry(name: string, enabled: boolean, factory?: NodeRendererFactory): void {
  registry[name] = { enabled, factory }
}

/** Register (or clear) the katex renderer. Calling without a factory marks
 *  the capability enabled with the library default (when it grows in). */
export function enableKatex(factory?: NodeRendererFactory): void {
  setEntry('katex', true, factory)
}

/** Register (or clear) the mermaid renderer. */
export function enableMermaid(factory?: NodeRendererFactory): void {
  setEntry('mermaid', true, factory)
}

/** Register (or clear) the syntax highlighter. The optional argument is the
 *  platform implementation (see highlight.ts for the contract): a VM backend
 *  supplies its own bridge, the Vue layer calls enableHighlight() with no
 *  argument and the lowlight default is resolved at the call site. */
export function enableHighlight(impl?: HighlightFn): void {
  setEntry('highlight', true)
  setHighlightImpl(impl ?? null)
}

export function isCapabilityEnabled(name: string): boolean {
  return registry[name]?.enabled === true
}

// -- artifact store (plan 031 D6) ------------------------------------------------
//
// Deliberately NOT a registry entry: the store is not a renderer
// capability but a persistence sink — enableKatex/enableMermaid gate
// renderers, enableArtifactStore gates WHERE successful final artifacts
// land. Unregistered = zero writes = behavior identical to pre-031.

let artifactStore: ArtifactStore | null = null

/** Register the host artifact store. Registering twice replaces (the
 *  latest host wins — demo/jade remount scenarios). */
export function enableArtifactStore(store: ArtifactStore): void {
  registry['artifact-store'] = { enabled: true }
  artifactStore = store
}

/** The registered store, or null (the render paths' no-op guard). Exported
 *  for preview.ts's put choke point; hosts read through their own handle. */
export function getArtifactStore(): ArtifactStore | null {
  return artifactStore
}

/** All capabilities absent -> the renderer still works (degraded path). */
export function clearOptionalCapabilities(): void {
  for (const key of Object.keys(registry)) {
    delete registry[key]
  }
  setHighlightImpl(null)
  artifactStore = null
}
