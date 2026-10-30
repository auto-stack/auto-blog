// Platform bridge for syntax highlighting (plan 008 goal 3, port pattern —
// same shape as the render-scheduler timer port).
//
// Upper layers (builtin codeblock panel) call ONE function and degrade to
// plain text on `undefined`; the implementation is bound per platform:
//   - Vue:  lowlight/highlight.js (highlight-lowlight.ts, the default here)
//   - VM:   the backend's own bridge (e.g. a Rust highlighter through the
//           Auto VM), registered via enableHighlight(vmImpl) before render
//
// The on/off switch stays the `highlight` capability in
// optional-capabilities; the impl slot lives here so a platform can swap
// the library without touching any call site.

export type HighlightFn = (code: string, language: string) => string | undefined

let platformImpl: HighlightFn | null = null

/** Bind the platform implementation. Passing null reverts to "no impl"
 *  (the Vue default is then resolved by the caller — see resolveHighlighter). */
export function setHighlightImpl(impl: HighlightFn | null): void {
  platformImpl = impl
}

/** Currently bound platform implementation, if any. */
export function getHighlightImpl(): HighlightFn | null {
  return platformImpl
}
