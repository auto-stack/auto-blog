// @autodown/engine — ./render exit, frozen in plan 017 Phase 3. Render
// layer: streaming document model + scheduler, MarkdownRender /
// StreamingRenderer / tables, optional capabilities, and the pluggable
// panel registry (extension panels register here — see PANEL-ALIGNMENT.md).
export * from './render/index'
export { registerPanel, unregisterPanel, clearPanelRegistry } from './render/panel-registry'
export type { PanelRenderCtx, PanelRenderer, PanelSpec } from './render/panel-registry'
