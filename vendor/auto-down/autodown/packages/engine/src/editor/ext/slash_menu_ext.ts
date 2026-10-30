// slash_menu_ext.ts — Hand-written TS extension for the SlashMenu widget
// (../slash_menu.at). The gen pipeline copies this file into the transient
// gen project (never type-checked there) and deploys it verbatim to
// src/editor/ext/slash_menu_ext.ts; the generated SlashMenu.vue imports it
// from ../ext/slash_menu_ext (gen.mjs E1 rewrite).
//
// Everything else from the original port (filtering, two-phase positioning,
// scroll-into-view, markHandled, command dispatch, list length) lives in the
// widget DSL itself. What remains here genuinely cannot be expressed in the
// DSL:
//
// 1. computeMenuPosition re-export. The position math must stay in the real
//    composables/useMenuBounds.ts (single source of truth, also used by
//    TableMenu/CodeBlockMenu), but a `use` path cannot leave the project
//    src/, so the widget imports it via this re-export. The path resolves
//    from the deployed location src/editor/ext/ → src/editor/composables
//    (plan 021 Phase 2: engine tree is the only resolution target — the
//    Tiptap-era dual-resolution shim is retired).

export { computeMenuPosition } from '../composables/useMenuBounds'
