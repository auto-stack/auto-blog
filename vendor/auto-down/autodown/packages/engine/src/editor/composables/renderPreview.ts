// renderPreview.ts — KaTeX / Mermaid preview rendering for the Auto
// render-type node-view widgets (MermaidNodeView, MathBlockNodeView,
// MathInlineNodeView). Imported by the generated SFCs through the
// src/auto extension re-export (src/auto/src/front/utils/node_view_ext.ts).
//
// Since plan 017 Phase 2 the implementation lives ONCE in the render layer
// (src/render/preview.ts); this module keeps its historical path as the
// editor-side facade (the Auto gen project still resolves a stub here —
// src/auto/stubs/gen_renderPreview.ts, see src/auto/README.md).

export {
  renderKatexPreview,
  renderMermaidPreview,
  type RenderedKatex,
  type RenderedMermaid,
} from '../../render/preview'
