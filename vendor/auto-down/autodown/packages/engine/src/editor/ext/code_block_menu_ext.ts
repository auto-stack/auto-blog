// code_block_menu_ext.ts — Hand-written TS extension for the CodeBlockMenu
// widget (../code_block_menu.at). The gen pipeline copies this file into the
// transient gen project (never type-checked there) and deploys it verbatim
// to src/editor/ext/code_block_menu_ext.ts; the generated CodeBlockMenu.vue
// imports it from ../ext/code_block_menu_ext (gen.mjs E1 rewrite).
//
// Everything else from the original port (the shared reactive state
// composable, open/close/select, keyboard navigation, the two-phase
// positioning, the scroll-lock wheel handler, the editor-dom capture
// listeners, the outside-click + wrapper-scroll listeners) lives in the
// widget DSL itself. What remains here genuinely cannot (or should not) be
// expressed in the DSL:
//
// 1. computeMenuPosition re-export. The position math must stay in the real
//    composables/useMenuBounds.ts (single source of truth, also used by
//    SlashMenu/TableMenu), but a `use` path cannot leave the project src/
//    (plan 021 Phase 2: engine tree is the only resolution target).
// 2. The static language manifest. The list is typed data and belongs in
//    TS; exposing it through codeBlockLanguages() gives the DSL filter
//    computed's closure parameter its contextual type. `aliases` is
//    REQUIRED (empty arrays instead of omitted) so the DSL filter's
//    `[lang.id, lang.label].concat(lang.aliases)` type-checks — `??`/`||`
//    are unavailable in computed expressions, so `lang.aliases ?? []`
//    cannot be written there. Behaviour is identical: an empty aliases
//    array contributes nothing to the joined haystack, exactly like the
//    original's `...(lang.aliases ?? [])`.
// 3. codeBlockCheckIcon. The Check icon is rendered via `dyn (.check_icon)`:
//    a PascalCase component inside a two-variable for loop gets an
//    auto-generated `:key="'Check-N-' + (i?.id ?? i)"`, and `i?.id` (i is
//    the numeric loop index) fails vue-tsc — the dyn path (lowercase
//    <component :is>, no auto key) sidesteps it. lucide-vue-next is
//    available in the engine tree (the other widgets import icons from it
//    directly).

export { computeMenuPosition } from '../composables/useMenuBounds'

import { Check } from 'lucide-vue-next'

export function codeBlockCheckIcon(): unknown {
  return Check
}

export interface CodeBlockLanguage {
  id: string
  label: string
  aliases: string[]
}

// The original's static language list (id/label/aliases), unchanged apart
// from the explicit empty `aliases` arrays (see the header comment).
export const CODE_BLOCK_LANGUAGES: CodeBlockLanguage[] = [
  { id: 'text', label: 'Text', aliases: [] },
  { id: 'bash', label: 'Bash', aliases: ['sh', 'shell', 'zsh'] },
  { id: 'c', label: 'C', aliases: [] },
  { id: 'cpp', label: 'C++', aliases: ['c++', 'cxx'] },
  { id: 'csharp', label: 'C#', aliases: ['c#', 'cs'] },
  { id: 'css', label: 'CSS', aliases: [] },
  { id: 'dockerfile', label: 'Dockerfile', aliases: ['docker'] },
  { id: 'go', label: 'Go', aliases: ['golang'] },
  { id: 'html', label: 'HTML', aliases: [] },
  { id: 'java', label: 'Java', aliases: [] },
  { id: 'javascript', label: 'JavaScript', aliases: ['js'] },
  { id: 'json', label: 'JSON', aliases: [] },
  { id: 'kotlin', label: 'Kotlin', aliases: ['kt'] },
  { id: 'lua', label: 'Lua', aliases: [] },
  { id: 'markdown', label: 'Markdown', aliases: ['md'] },
  { id: 'php', label: 'PHP', aliases: [] },
  { id: 'python', label: 'Python', aliases: ['py'] },
  { id: 'r', label: 'R', aliases: [] },
  { id: 'ruby', label: 'Ruby', aliases: ['rb'] },
  { id: 'rust', label: 'Rust', aliases: ['rs'] },
  { id: 'scss', label: 'SCSS', aliases: ['sass'] },
  { id: 'sql', label: 'SQL', aliases: [] },
  { id: 'swift', label: 'Swift', aliases: [] },
  { id: 'toml', label: 'TOML', aliases: [] },
  { id: 'typescript', label: 'TypeScript', aliases: ['ts', 'tsx'] },
  { id: 'xml', label: 'XML', aliases: [] },
  { id: 'yaml', label: 'YAML', aliases: ['yml'] },
]

// Exposed through a function (not a const re-export) so the widget's filter
// computed calls it: `use { fn }` only imports functions.
export function codeBlockLanguages(): CodeBlockLanguage[] {
  return CODE_BLOCK_LANGUAGES
}
