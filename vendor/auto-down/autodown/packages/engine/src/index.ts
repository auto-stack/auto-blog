// @autodown/engine — root exit, frozen in plan 017 Phase 3. Curated
// composition of the layer exits; the full per-layer surfaces stay at
// ./parser, ./render and ./editor.
export {
  MarkdownRender,
  StreamingRenderer,
  useStreamingDocument,
  enableKatex,
  enableMermaid,
  enableHighlight,
  isCapabilityEnabled,
  clearOptionalCapabilities,
  registerPanel,
  unregisterPanel,
  clearPanelRegistry,
} from './render'
export type {
  MarkdownSegment,
  ComponentSegment,
  StreamingSegment,
  PanelRenderCtx,
  PanelRenderer,
  PanelSpec,
} from './render'
export { AutoDownEditor, getBlockMap, BLOCK_ID_PREFIX } from './editor'
export { insertTemplate, replaceSelection, focusBlock, moveBlock, setBlockAttrs, tableAddRow, tableDeleteRow, tableAddColumn, tableDeleteColumn, createEditorAdapter } from './editor'
export type { BlockInfo, SlashItem } from './editor'
