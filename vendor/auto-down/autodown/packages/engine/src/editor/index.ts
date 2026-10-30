import './styles/autodown-editor.css'

// @autodown/engine ./editor exit (plan 018 Phase 4): the self-built editing
// engine assembly. Tiptap is retired — createExtensions and the Tiptap
// AutoDownEditor are GONE (breaking, engine 0.4.0; see CHANGELOG for the
// migration guide). The frozen external contract (EDITOR-CONTRACT.md) is
// preserved: .autodown-editor* classes, [data-block-id], getBlockMap,
// autodown:slash-* events.

export { default as AutoDownEditor } from './components/EngineEditor.vue'
export type { BlockInfo } from './components/EngineEditor.vue'
export type { SlashItem } from './menus/slashItem'
export { getBlockMap, BLOCK_ID_PREFIX } from './block-map'
export {
  EditorEngine,
  BlockHostController,
  insertTemplate,
  replaceSelection,
  focusBlock,
  tableAddRow,
  tableDeleteRow,
  tableAddColumn,
  tableDeleteColumn,
  moveBlock,
  setBlockAttrs,
  createEditorAdapter,
  // plan 038 T1 — the data-loader channel types (props surface of
  // EngineEditor's runQuery/loadBlock).
  setDataLoaders,
  getDataLoaders,
  type DataLoaders,
  type RunQueryFn,
  type LoadBlockFn,
  type QueryResultItem,
  type QueryResultEnvelope,
  type EmbeddedBlock,
} from './engine'
