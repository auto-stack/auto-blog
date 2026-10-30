// Undo/redo keydown wiring (plan 028 P0T1) — the headless half of the
// Ctrl+Z / Ctrl+Y shortcuts: which combos map to a history action, and the
// post-hop host realignment. Kept out of EngineEditor.vue so the routing
// table and the re-sync semantics are unit-testable without the Vue shell.
//
// The Vue side additionally (a) passes the key through while any host is
// composing (IME owns the key stream) and (b) remounts the focused edit face
// after a hop — its draft DOM (BlockHost v-html / CodeEditorBlock textarea)
// is deliberately non-reactive to protect the user's caret.

import type { BlockHostController } from './host-controller'
import type { EditorEngine } from './editor-engine'

export type HistoryAction = 'undo' | 'redo' | null

/** The history half of a keydown: Ctrl/Cmd+Z (Shift variant → redo) and
 *  Ctrl/Cmd+Y → redo. Everything else (including the mark shortcuts and
 *  Ctrl+End navigation) returns null and keeps bubbling untouched. */
export function historyActionOf(e: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'key'>): HistoryAction {
  if (!e.ctrlKey && !e.metaKey) return null
  const k = e.key.toLowerCase()
  if (k === 'z') return e.shiftKey ? 'redo' : 'undo'
  if (k === 'y') return 'redo'
  return null
}

/** Run one history hop and realign EVERY cached host's knownText with the
 *  restored tree — undo can revert any block, and a stale knownText would
 *  baseline the host's next diffToOp against ghost text. Returns false
 *  (touching nothing) when the stack is empty. */
export function runHistory(
  engine: EditorEngine,
  hosts: Iterable<BlockHostController>,
  action: Exclude<HistoryAction, null>,
): boolean {
  const did = action === 'undo' ? engine.undo() : engine.redo()
  if (did) for (const c of hosts) c.syncFromModel()
  return did
}
