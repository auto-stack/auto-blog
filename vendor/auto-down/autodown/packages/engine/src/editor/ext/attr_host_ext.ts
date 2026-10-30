// attr_host_ext.ts — Hand-written TS extension for the AttrHost widget
// (../attr_host.at, plan 035 T2). Carries ALL of the retired hand-written
// AttrHost.vue's (plan 030 T7) platform wiring, migrated line-for-line
// (semantic comments preserved); the widget owns only the chrome. The gen
// pipeline copies this file into the transient gen project (never
// type-checked there) and deploys it verbatim to
// src/editor/ext/attr_host_ext.ts; the generated AttrHost.vue imports it
// from ../ext/attr_host_ext (gen.mjs E1 rewrite).
//
// What genuinely cannot be expressed in the widget DSL:
// - the model read (findBlock/attrGetStr) and the nbsp-normalizing text
//   extraction (regex literals);
// - setBlockAttrs (the command layer) — blur commits through it as ONE
//   undo step, the 023 command protocol;
// - document.activeElement focus checks.
//
// The controller prop is the engine passed wide-typed (the 033
// CodeBlockWidget fenceEditSlot idiom — controller = engine + blockId
// flat props), so every function here narrows it itself.

import { Value, attrGetStr, findBlock } from '../../parser/block-model'
import { setBlockAttrs } from '../engine/commands'
import type { EditorEngine } from '../engine/editor-engine'

/** The block's current attr text — the mounted/sync target. */
export function attrModelValue(controller: any, blockId: string, attrKey: string): string {
  const engine = controller as EditorEngine
  const found = findBlock(engine.doc, blockId)
  return found ? attrGetStr(found.attrs, attrKey, '') : ''
}

/** Mount: inject the model value as the host's text (the assembler passes
 *  it as the flat `value` prop — the engine is not Vue-reactive, so the
 *  snapshot never goes stale under the user's caret). */
export function mountAttrHost(el: unknown, value: string): void {
  const node = el as HTMLElement | null
  if (node) node.textContent = value
}

/** The version-watch sync (the retired AttrHost.vue watch verbatim): when
 *  the parent's repaint version moves and the host is NOT focused, re-sync
 *  the text from the model — never while focused, so the user's caret is
 *  never clobbered mid-edit. */
export function isFocused(el: unknown): boolean {
  return typeof document !== 'undefined' && document.activeElement === el
}

export function syncAttrFromModel(el: unknown, controller: any, blockId: string, attrKey: string): void {
  const node = el as HTMLElement | null
  if (node && !isFocused(node)) node.textContent = attrModelValue(controller, blockId, attrKey)
}

/** Blur commit (one undo step): nbsp from contentediting normalizes back to
 *  a plain space, an unchanged text skips the command, readonly (the
 *  stream→edit v1 gate) skips entirely. */
export function commitAttr(el: unknown, controller: any, blockId: string, attrKey: string, readonly: boolean): void {
  if (readonly) return
  const node = el as HTMLElement | null
  // nbsp from contentediting normalizes back to a plain space
  const text = (node?.textContent ?? '').replace(/\u00a0/g, ' ').trim()
  if (text === attrModelValue(controller, blockId, attrKey)) return
  setBlockAttrs(controller as EditorEngine, blockId, [{ key: attrKey, value: Value.Str(text) }])
}

/** Enter/Escape simply blur (commit) — preventDefault rides the DSL key
 *  modifiers (onkeydown.enter.prevent / .escape.prevent). */
export function blurAttrHost(el: unknown): void {
  const node = el as HTMLElement | null
  if (node) node.blur()
}
