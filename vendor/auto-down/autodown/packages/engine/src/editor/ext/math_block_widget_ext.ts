// math_block_widget_ext.ts — platform bridge for the MathBlockWidget (plan
// 033 T3): the math block family's three-mode widget. Merges the 031 edit
// bridge (math_edit_ext.ts: katex re-export, focus, rows) with the node-view
// face's artifact-recording bridge (renderMathBlockPreview from
// node_view_ext.ts), plus the family prop readers re-exported from
// code_block_widget_ext.ts (the canonical home — cross-bridge re-exports are
// the established idiom, cf. math_edit_ext ← code_editor_block_ext).
//
// 1. renderMathBlockPreview — the VIEW face's final render: the single katex
//    bridge PLUS the 031 artifact final-put (successful finals land in the
//    host-injected store via recordArtifact — a no-op without a store, so
//    unregistered hosts keep the exact pre-031 behavior).
// 2. renderKatexPreview — the EDIT face's live preview (put-free: drafts are
//    not artifacts; only finals record, through the view bridge above).
// 3. textareaRows — the draft's line-count → rows approximation (031 D1 v1).
// 4. focusCodeArea + the family readers (nodeText/ctxReadonly/ctxBlockId/
//    codeController) + root-attr helpers — re-exports.
//
// Deployed verbatim to src/editor/ext/math_block_widget_ext.ts by gen.mjs
// (assert-editor-gen guards the byte sync).

import { recordArtifact, renderKatexPreview } from '../../render/preview'

export { renderKatexPreview }
export { focusCodeArea, nodeText, ctxReadonly, ctxBlockId, codeController, editOnlyAttr, viewMarker } from './code_block_widget_ext'

// MathBlock FINAL render (031 T8 contract, carried over from node_view_ext):
// the view face's success branch lands its artifact in the host store.
export function renderMathBlockPreview(source: string): { html: string; error: string } {
  const res = renderKatexPreview(source, true)
  if (res.error === '') {
    recordArtifact('MathBlock', source, { kind: 'html', body: res.html, error: '' })
  }
  return res
}

/** rows attr for the source textarea: draft line count + 1 breathing line,
 *  clamped to [4, 24] — past the cap CSS takes over (max-height +
 *  overflow). */
export function textareaRows(source: string): string {
  const lines = source.split('\n').length
  return String(Math.max(4, Math.min(24, lines + 1)))
}
