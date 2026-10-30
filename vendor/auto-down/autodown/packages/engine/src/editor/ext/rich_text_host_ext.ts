// rich_text_host_ext.ts — Hand-written TS extension for the RichTextHost
// widget (../rich_text_host.at, plan 034). Carries ALL of the retired
// BlockHost.vue's platform wiring, migrated line-for-line (semantic comments
// preserved); the widget owns only the chrome and the event face. The gen
// pipeline copies this file into the transient gen project (never
// type-checked there) and deploys it verbatim to
// src/editor/ext/rich_text_host_ext.ts; the generated RichTextHost.vue
// imports it from ../ext/rich_text_host_ext (gen.mjs E1 rewrite).
//
// What genuinely cannot be expressed in the widget DSL (T1 probe verdicts):
// - mount HTML injection: `html:` on a dyn root emits a :html ATTRIBUTE
//   binding, not v-html — the mount snapshot is written via $el here;
// - the root element: `ref:` on a dyn root emits no const declaration —
//   mountHost grabs it through getCurrentInstance().$el (the
//   auto_down_editor_ext.ts idiom) and event handlers receive e.target;
// - str() has no DSL builtin — the host-face computation (hostTag/hostCls,
//   absorbed from engine/host-face.ts) lives here;
// - Selection/Range/caret math and window.prompt are imperative by nature.
//
// Everything below is engine-side logic only — zero auto-lang dependency.

import { getCurrentInstance, onBeforeUnmount } from 'vue'
import type { BlockHostController } from '../engine/host-controller'
import { dispatchSlashState, slashQueryAt } from '../engine/tiptap-adapter'
import { spansToHtml } from '../engine/rich-html'
import { setFocusedRichHost, getFocusedRichHost, domSelectionAdapter, toggleMark } from '../engine/selection-adapter'
import { placeCaretAtPoint, takeClickCaret } from '../engine/click-caret'
import { Mark } from '../../parser/block-model'

// -- semantic host face (absorbed from engine/host-face.ts, plan 029) ------------
//
// The focused edit host renders the view-side tag/class (Heading →
// h1-h6.heading-node, Paragraph → p.paragraph-node) so the editor CSS hits
// the host exactly like the preview — WYSIWYG parity, pinned by the
// wysiwyg-typography e2e computed-style assertions. Every other editable
// kind keeps the bare div of old.

export function hostTag(kind: string, level?: number): string {
  return hostFaceFor(kind, level).tag
}

/** Full class chain incl. the base autodown-block-host (BlockHost rendered
 *  ['autodown-block-host', face.cls] — same computed DOM as one string). */
export function hostCls(kind: string, level?: number): string {
  const face = hostFaceFor(kind, level)
  return face.cls ? `autodown-block-host ${face.cls}` : 'autodown-block-host'
}

function hostFaceFor(kind: string, level?: number): { tag: string; cls: string } {
  if (kind === 'Heading') {
    const l = Math.min(6, Math.max(1, level ?? 1))
    return { tag: `h${l}`, cls: `heading-node heading-${l}` }
  }
  if (kind === 'Paragraph') return { tag: 'p', cls: 'paragraph-node' }
  return { tag: 'div', cls: '' }
}

// -- mount / unmount ----------------------------------------------------------------

/** Live-mounted host elements (per-instance liveness). The retired
 *  BlockHost keyed its blur/focus guards off the template ref (el.value),
 *  which Vue nulls when the component starts unmounting — that is what
 *  neutralized the blur Chromium fires while a focused host is being
 *  REMOUNTED (Enter-split kind flip, input-rule flip, undo/redo epoch hop):
 *  the old element's late blur would otherwise flush its stale DOM text
 *  back into the just-restored model and drag the selection back with it
 *  (found live in the demo, plan 034 T7). The WeakSet reproduces exactly
 *  that lifetime: set at mount, cleared in the same unmount phase the
 *  template ref was nulled in. */
const liveHosts = new WeakSet<HTMLElement>()

/** Mount: when the host mounts it IS the newly focused block — inject the
 *  rich snapshot (spansToHtml of the model inlines, evaluated once by the
 *  assembler — the engine is not Vue-reactive, so it never invalidates
 *  under the user's caret), take DOM focus, and register the unmount
 *  deregistration of the focused-rich-host slot (BlockHost's
 *  onBeforeUnmount).
 *
 *  Caret: a pending click-caret handoff (the preview face's click) is
 *  re-resolved against THIS face's glyphs — the faces are layout-identical,
 *  so the browser lands the caret exactly where the user pointed. Every
 *  other mount path (keyboard focus, history remount, programmatic select,
 *  append-at-end flows, Ctrl+End parity) keeps the end-of-text default. */
export function mountHost(initialHtml: string, blockId?: string): void {
  const inst = getCurrentInstance()
  const node = (inst?.proxy?.$el as HTMLElement | undefined) ?? null
  if (!node) return
  liveHosts.add(node)
  node.innerHTML = initialHtml
  node.focus()
  const entry = blockId ? takeClickCaret(blockId) : null
  if (!entry || !placeCaretAtPoint(node, entry)) caretToEnd(node)
  onBeforeUnmount(() => {
    liveHosts.delete(node)
    if (getFocusedRichHost() === node) setFocusedRichHost(null)
  })
}

function caretToEnd(node: HTMLElement): void {
  const range = document.createRange()
  range.selectNodeContents(node)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

/** Place the collapsed caret at a text-code-unit offset within the host
 *  (plan-062 T-03) — the inverse of caretOffset. Falls back to end-of-text
 *  when the offset overshoots (clamped model edits). */
export function caretToOffset(node: HTMLElement, offset: number): void {
  const walker = node.ownerDocument.createTreeWalker(node, NodeFilter.SHOW_TEXT)
  let remaining = Math.max(0, offset)
  let current: Text | null = null
  let placed = false
  while ((current = walker.nextNode() as Text | null)) {
    const len = current.data.length
    if (remaining <= len) {
      const range = document.createRange()
      // Boundary at the exact end of a STYLED node's text: place the caret
      // AFTER the styled element (plan-062 AC-02) — setting it inside would
      // make new typing inherit the mark.
      if (remaining === len) {
        const parent = current.parentElement
        if (parent && parent !== node) {
          // ZWSP caret anchor (stripped by hostText): a bare element-
          // boundary caret gets canonicalized by Chromium INTO the inline,
          // so typing would extend the mark — the anchor keeps it outside.
          const zwsp = node.ownerDocument.createTextNode(ZWSP_ANCHOR)
          parent.after(zwsp)
          range.setStart(zwsp, 1)
          range.collapse(true)
          const sel = window.getSelection()
          sel?.removeAllRanges()
          sel?.addRange(range)
          placed = true
          break
        }
      }
      range.setStart(current, remaining)
      range.collapse(true)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      placed = true
      break
    }
    remaining -= len
  }
  if (!placed) caretToEnd(node)
}

// -- text/caret math -----------------------------------------------------------------

/** Chromium renders a trailing space in contenteditable as U+00A0 —
 *  normalize at the DOM boundary or the "- "/"# " input-rule markers never
 *  match and the model collects nbsp pollution. */
const ZWSP_ANCHOR = '​'

export function hostText(el: HTMLElement): string {
  return (el.textContent ?? '').replace(/\u00A0/g, ' ').replace(/\u200B/g, '')
}

/** Caret offset in text-code-unit terms (Range math over the host subtree). */
export function caretOffset(el: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return 0
  const range = sel.getRangeAt(0).cloneRange()
  range.selectNodeContents(el)
  range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset)
  return range.toString().length
}

// -- cross-block vertical navigation geometry -----------------------------------

/** Tops of the non-zero-height line boxes a range occupies, in document
 *  order (empty without layout — jsdom / detached hosts). */
function lineTops(range: Range): number[] {
  const rects = range.getClientRects()
  const tops: number[] = []
  for (let i = 0; i < rects.length; i++) {
    if (rects[i].height > 0) tops.push(rects[i].top)
  }
  return tops
}

/** Line boxes before vs after the collapsed caret (in host text order). */
function prePostLineTops(el: HTMLElement): { preTops: number[]; postTops: number[] } {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return { preTops: [], postTops: [] }
  const caret = sel.getRangeAt(0)
  if (!caret.collapsed) return { preTops: [], postTops: [] }
  const pre = document.createRange()
  pre.selectNodeContents(el)
  pre.setEnd(caret.startContainer, caret.startOffset)
  const post = document.createRange()
  post.selectNodeContents(el)
  post.setStart(caret.startContainer, caret.startOffset)
  return { preTops: lineTops(pre), postTops: lineTops(post) }
}

/** Is the collapsed caret on the host's FIRST visual line? The caret's
 *  drawn line sits between the last preceding box and the first following
 *  box (affinity); ↑ takes the LATER bound as the caret's line — the
 *  conservative reading that keeps native in-block movement alive. No
 *  preceding box at all means first line (offset 0 / empty host). */
export function caretOnFirstLine(el: HTMLElement): boolean {
  const { preTops, postTops } = prePostLineTops(el)
  const caretLine = postTops.length > 0 ? postTops[0] : preTops[preTops.length - 1]
  if (caretLine == null) return true
  return !preTops.some((t) => t < caretLine - 1)
}

/** Is the collapsed caret on the host's LAST visual line? Mirror of
 *  caretOnFirstLine: ↓ takes the EARLIER bound (the last preceding box's
 *  line) as the caret's line. No following box means last line. */
export function caretOnLastLine(el: HTMLElement): boolean {
  const { preTops, postTops } = prePostLineTops(el)
  const caretLine = preTops.length > 0 ? preTops[preTops.length - 1] : postTops[0]
  if (caretLine == null) return true
  return !postTops.some((t) => t > caretLine + 1)
}

/** Place the DOM caret at a block host's start (offset 0), after the
 *  reactive remount has mounted that block's live host (mountHost defaults
 *  the caret to the block end — the ↓ contract is the NEXT block's first
 *  position). Macrotask timing rides after Vue's microtask flush. */
function placeCaretAtBlockStart(blockId: string): void {
  setTimeout(() => {
    const host = document.querySelector(`.autodown-block-host[data-block-id="${blockId}"]`)
    if (!host) return
    const range = document.createRange()
    range.selectNodeContents(host)
    range.collapse(true)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, 0)
}

// -- event wiring (BlockHost.vue handlers, verbatim) --------------------------------

export function hostInput(el: HTMLElement, controller: BlockHostController): void {
  const text = hostText(el)
  controller.onInput(text)
  // An input rule may have consumed the marker in the model (kind change /
  // container wrap) while the DOM still shows it — resync the host DOM to
  // the model so the marker cannot leak back into the next keystroke diff
  // (plan 025 P2T1; also fixes the pre-existing heading-marker leak).
  // Skipped mid-composition: the preedit lives only in the DOM.
  if (!controller.composition.composing && hostText(el) !== controller.text) {
    el.innerHTML = spansToHtml(controller.inlines)
    // plan-062 T-03: an inline input rule parks the engine caret right
    // after the mark — place the DOM caret exactly there (end-of-text
    // fallback keeps the block-rule path as-is).
    const want = controller.desiredCaretOffset()
    if (want == null) caretToEnd(el)
    else caretToOffset(el, want)
  }
  if (typeof document !== 'undefined') {
    dispatchSlashState(slashQueryAt(controller.text, caretOffset(el)), controller.id, caretOffset(el))
  }
}

export function hostKeydown(e: KeyboardEvent, controller: BlockHostController): void {
  if (controller.composition.composing) return
  // currentTarget is the listener's element during real dispatch; direct
  // unit invocations only carry target — both are the host root here.
  const el = (e.currentTarget ?? e.target) as HTMLElement
  if (e.ctrlKey || e.metaKey) {
    const k = e.key.toLowerCase()
    // inline mark shortcuts (plan 024 P3T3; adapter-routed plan 036 T3):
    // wrap the live DOM in place through the SelectionAdapter — the model
    // catches up on blur. Overriding the browser's native <b> keeps the
    // DOM canonical (<strong>) for the blur walk.
    if (k === 'b') {
      e.preventDefault()
      toggleMark(domSelectionAdapter, Mark.Strong)
      return
    }
    if (k === 'i') {
      e.preventDefault()
      toggleMark(domSelectionAdapter, Mark.Em)
      return
    }
    if (k === 'u') {
      // plan-062 T-05: Ctrl/Cmd+U joins B/I (underline → Mark.Underline).
      e.preventDefault()
      toggleMark(domSelectionAdapter, Mark.Underline)
      return
    }
    if (k === 'k') {
      e.preventDefault()
      const url = window.prompt('Enter URL')
      if (url) domSelectionAdapter.applyMark(Mark.Link, url)
      return
    }
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    controller.onEnter(caretOffset(el), `b-${Math.random().toString(36).slice(2, 8)}`)
  } else if (e.key === 'Backspace' && caretOffset(el) === 0) {
    // Prev sibling resolves MODEL-side (controller.prevSiblingId): the
    // deployed host is an only child of its per-block slot wrapper
    // (node-slot > node-content), so the old previousElementSibling route
    // always returned null and this merge arm never fired. preventDefault
    // rides the op result — the browser default yields only when the model
    // took the op (list-item lift/merge included; there prev may
    // legitimately be null).
    const merged = controller.onBackspaceAtStart(controller.prevSiblingId())
    if (merged) e.preventDefault()
  } else if (e.key === 'ArrowUp' && caretOnFirstLine(el)) {
    // Cross-block vertical navigation (web parity with the VM shell's
    // navigate_vertical): ↑ from the host's FIRST visual line moves into
    // the previous editable-leaf block at its END — the geometry-exact
    // "directly above" landing needs glyph-hit plumbing the web track
    // deliberately defers (user ruling 2026-09-07: end position suffices).
    // Interior lines keep the native in-block behaviour untouched.
    if (controller.navigateUp()) e.preventDefault()
  } else if (e.key === 'ArrowDown' && caretOnLastLine(el)) {
    const target = controller.navigateDown()
    if (target) {
      e.preventDefault()
      placeCaretAtBlockStart(target)
    }
  } else if (e.key === 'Tab') {
    // list indent / outdent (plan 025 P1T3); outside a list the browser
    // default (focus move) is untouched
    if (controller.onTab(e.shiftKey)) e.preventDefault()
  }
}

export function hostPaste(ev: ClipboardEvent, controller: BlockHostController): void {
  const text = ev.clipboardData?.getData('text/plain') ?? ''
  if (!text) return
  ev.preventDefault()
  const md = text.trim()
  if (!md.includes('\n') && !/^[#>*`\-\d]/.test(md)) {
    controller.onInput(controller.text + md)
    return
  }
  controller.onPasteMarkdown(md)
}

export function hostCompositionBegin(
  el: HTMLElement,
  controller: BlockHostController
): void {
  controller.compositionBegin(controller.text, caretOffset(el))
}

export function hostCompositionUpdate(
  e: CompositionEvent,
  controller: BlockHostController
): void {
  controller.compositionUpdate(e.data ?? '')
}

export function hostCompositionCommit(
  el: HTMLElement,
  controller: BlockHostController
): void {
  controller.compositionCommit(hostText(el))
}

/** Register as the focused rich host so the adapter's mark chains can wrap
 *  this DOM in place (plan 024 P3T1). */
export function hostFocus(el: HTMLElement, _controller: BlockHostController): void {
  void _controller
  if (liveHosts.has(el)) setFocusedRichHost(el)
}

/** Focus leave: flush any pending plain-text diff first (the normal input
 *  path already committed each keystroke), then walk the rich structure back
 *  into the model as one undo step (plan 024 P2T2).
 *
 * Remount guard: replacing the focused host (Enter-split kind flip,
 * input-rule flip, undo/redo epoch hop) fires blur on the OLD element while
 * it still carries the pre-transition DOM — flushing then would re-insert
 * stale text into the just-restored model and drag the selection back. The
 * retired BlockHost guarded via its template ref (unmount nulls el.value);
 * the liveHosts WeakSet is that lifetime here. */
export function hostBlur(el: HTMLElement, controller: BlockHostController): void {
  setFocusedRichHost(null)
  if (!liveHosts.has(el)) return
  const text = hostText(el)
  if (text !== controller.text) controller.onInput(text)
  controller.onRichBlur(el)
}
