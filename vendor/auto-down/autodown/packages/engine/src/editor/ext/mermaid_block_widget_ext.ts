// mermaid_block_widget_ext.ts — platform bridge for the MermaidBlockWidget
// (plan 033 T4): the mermaid family's three-mode widget. Merges the 031
// edit bridge (mermaid_edit_ext.ts: the debounce scheduler, focus, rows)
// with the node-view face's artifact-recording render, plus the family
// prop readers re-exported from code_block_widget_ext.ts (the canonical
// home — cross-bridge re-exports are the established idiom).
//
// 1. scheduleMermaidRender — the D2 debounce (031, verbatim): 300ms timer +
//    monotonic version counter; stale renders are discarded. Empty source
//    settles synchronously without touching mermaid.
// 2. renderMermaidPreview — the node-view bridge (031 T8): the render
//    layer's single mermaid render PLUS the artifact final-put (successful
//    svg finals land in the host-injected store).
// 3. textareaRows — re-export from math_block_widget_ext (031 placement).
// 4. focusCodeArea + the family readers (nodeText/ctxReadonly/ctxBlockId/
//    codeController) + root-attr helpers — re-exports.
//
// Deployed verbatim to src/editor/ext/mermaid_block_widget_ext.ts by
// gen.mjs (assert-editor-gen guards the byte sync).

import { recordArtifact, renderMermaidPreview as renderMermaidPreviewImpl } from '../../render/preview'

export { focusCodeArea, nodeText, ctxReadonly, ctxBlockId, codeController, editOnlyAttr, viewMarker } from './code_block_widget_ext'
export { textareaRows } from './math_block_widget_ext'

// Mermaid FINAL render (031 T8 contract, carried over from node_view_ext):
// a successful svg additionally records as an artifact.
export async function renderMermaidPreview(source: string): Promise<{ svg: string; error: string }> {
  const res = await renderMermaidPreviewImpl(source)
  if (res.error === '') {
    recordArtifact('Mermaid', source, { kind: 'svg', body: res.svg, error: '' })
  }
  return res
}

export interface MermaidRenderState {
  svg: string
  error: string
  loading: boolean
}

type RenderCallback = (state: MermaidRenderState) => void

// Module-level scheduler state: one pending timer + one version. A single
// edit face is mounted at a time — the focused block owns the assembly.
let pending: ReturnType<typeof setTimeout> | null = null
let version = 0

const DEBOUNCE_MS = 300

export function scheduleMermaidRender(source: string, cb: RenderCallback): void {
  const v = ++version
  if (pending != null) clearTimeout(pending)
  if (source.trim() === '') {
    cb({ svg: '', error: '', loading: false })
    return
  }
  pending = setTimeout(() => {
    pending = null
    cb({ svg: '', error: '', loading: true })
    void renderMermaidPreviewImpl(source).then((res) => {
      if (v !== version) return // a newer edit superseded this render
      cb({ svg: res.svg, error: res.error, loading: false })
    })
  }, DEBOUNCE_MS)
}
