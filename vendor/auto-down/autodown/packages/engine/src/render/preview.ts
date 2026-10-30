// KaTeX / Mermaid preview rendering — the single implementation since plan
// 017 Phase 2 (editor renderPreview and the render-layer optional
// capabilities converge here). Not re-exported through the ./render barrel:
// consumers who want katex/mermaid import the module explicitly, so the
// renderer core stays dependency-clean (plan 008 goal 3 degradation).
//
// What lives here genuinely cannot be expressed in the widget DSL:
// 1. katex/mermaid are npm packages — the DSL cannot import them.
// 2. try/catch — the DSL has no exceptions, so render error paths return a
//    plain { html/svg, error } result ("" error = success, matching the
//    original node views' falsy null).

import katex from 'katex'
import mermaid from 'mermaid'
import { artifactHash } from './artifact-key'
import { getArtifactStore } from './optional-capabilities'

mermaid.initialize({ startOnLoad: false, theme: 'default' })

export interface RenderedKatex {
  html: string
  error: string
}

// renderKatexPreview — the original MathBlock/MathInline render() bodies:
// katex.renderToString with throwOnError: true; on success error = ""
// (the originals' null), on failure html = "" and the extracted message.
export function renderKatexPreview(source: string, displayMode: boolean): RenderedKatex {
  try {
    return {
      html: katex.renderToString(source, { throwOnError: true, displayMode }),
      error: '',
    }
  } catch (e: any) {
    return { html: '', error: e.message || String(e) }
  }
}

export interface RenderedMermaid {
  svg: string
  error: string
}

// renderMermaidPreview — the original MermaidNodeView render() body (the
// empty-source early return stays in the widget). Same random id shape,
// same error extraction; error = "" on success (the originals' null).
export async function renderMermaidPreview(source: string): Promise<RenderedMermaid> {
  try {
    const id = `mermaid-${Math.random().toString(36).slice(2)}`
    const result = await mermaid.render(id, source)
    return { svg: result.svg, error: '' }
  } catch (e: any) {
    return { svg: '', error: e.message || String(e) }
  }
}

// -- rendered artifacts (plan 031 D6) -----------------------------------------
//
// The persistable product of a successful view render: mermaid -> SVG (a
// natural VM/iced displayable), math -> HTML v1 (a KaTeX-to-SVG generator
// is deliberately out of scope — tracked in DEBTS; the kind field already
// reserves the choice). renderKatexPreview / renderMermaidPreview stay
// untouched (their in-register consumers keep zero disturbance); artifactFor
// is the NEW final-artifact producer the artifact store hooks into (the
// put-on-success wiring lives with the store registration, T8).

export type ArtifactKind = 'html' | 'svg'

export interface RenderedArtifact {
  /** the body's display form — drives the VM-side displayer */
  kind: ArtifactKind
  /** the rendered body ("" when error != "") */
  body: string
  /** "" on success; the render error message otherwise */
  error: string
}

export type ArtifactBlockKind = 'MathBlock' | 'Mermaid'

/** The single put choke point (plan 031 D6/T8): a SUCCESSFUL final render
 *  lands in the host-injected store under the single-source artifactHash
 *  key. No store registered -> no-op (pre-031 behavior, byte for byte).
 *  Repeated puts of the same (kind, source) rewrite the same key — the
 *  "exactly once" semantics come from final-renders-only + idempotent
 *  keys, not from call counting. Exported for the node-view bridge's
 *  synchronous katex path (the bridge family in src/editor/ext/). */
export function recordArtifact(blockKind: ArtifactBlockKind, source: string, artifact: RenderedArtifact): void {
  if (artifact.error !== '') return
  const store = getArtifactStore()
  if (!store) return
  store.put(artifactHash(blockKind, source), artifact)
}

/** Produce the persistable artifact for a final render: math -> katex HTML
 *  (display mode, same face as the node view), mermaid -> SVG. Errors are
 *  data, not exceptions (the preview-bridge idiom). A successful result is
 *  recorded into the artifact store when one is registered. */
export async function artifactFor(blockKind: ArtifactBlockKind, source: string): Promise<RenderedArtifact> {
  if (blockKind === 'MathBlock') {
    const res = renderKatexPreview(source, true)
    const artifact: RenderedArtifact = { kind: 'html', body: res.html, error: res.error }
    recordArtifact(blockKind, source, artifact)
    return artifact
  }
  const res = await renderMermaidPreview(source)
  const artifact: RenderedArtifact = { kind: 'svg', body: res.svg, error: res.error }
  recordArtifact(blockKind, source, artifact)
  return artifact
}
