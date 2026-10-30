// Editing engine barrel (plan 018 Phase 1-3) — UI-free core: session +
// undo/redo, input rules, IME composition protocol, host text diff, block
// host controller, and the command layer (insertTemplate / table ops /
// moveBlock / setBlockAttrs).
export { EditorEngine, type EngineChange, type EngineListener } from './editor-engine'
// plan 038 T1 — the Query/Embed data-loader channel (module slot + types).
export {
  setDataLoaders,
  getDataLoaders,
  withDataLoaders,
  type DataLoaders,
  type RunQueryFn,
  type LoadBlockFn,
  type QueryResultItem,
  type QueryResultEnvelope,
  type EmbeddedBlock,
} from './data-loaders'
export { INPUT_RULES, matchInputRule, inputRuleOps, applyRuleAttrs, fireRuleOn, type InputRule, type InputRuleResult } from './input-rules'
export { CompositionSession } from './composition'
export { diffToOp } from './text-diff'
export { BlockHostController, isEditableLeaf } from './host-controller'
export { createEditorAdapter, type EditorAdapter, type ChainLike } from './tiptap-adapter'
export {
  insertTemplate,
  replaceSelection,
  focusBlock,
  tableAddRow,
  tableDeleteRow,
  tableAddColumn,
  tableDeleteColumn,
  moveBlock,
  setBlockAttrs,
  tableAddRowTree,
  tableAddColumnTree,
  ensureBlockAnchor,
  generateAnchorId,
  toggleMark,
  setLink,
  marksInRange,
} from './commands'
export { toggleMarkOnSpans, setLinkOnSpans, marksAtRange, normalizeSpans } from './marks'
export {
  enterInItem,
  backspaceAtItemStart,
  indentItem,
  outdentItem,
  enterInQuote,
  exitQuote,
} from './list-commands'
