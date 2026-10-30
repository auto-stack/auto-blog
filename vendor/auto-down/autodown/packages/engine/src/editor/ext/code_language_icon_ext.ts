// code_language_icon_ext.ts — Hand-written TS extension for the
// CodeLanguageIcon widget (../code_language_icon.at). Same re-export pattern
// as slash_menu_ext.ts: the language→icon mapping must stay in the real
// src/utils/codeBlockLanguage.ts (single source of truth, also used by
// CodeBlockMenu), but a `use` path cannot leave the project src/, so the
// widget imports it via this re-export. The path resolves from the deployed
// location src/editor/ext/ → src/editor/utils (plan 021 Phase 2: engine tree
// is the only resolution target).

export { getLanguageIconUrl } from '../utils/codeBlockLanguage'
