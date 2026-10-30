// code_block_widget_ext.ts — platform bridge for the CodeBlockWidget (plan
// 033 T2): the fence family's three-mode widget. Absorbs
// code_editor_block_ext.ts whole (the edit face's DOM helpers + overlay
// highlight) and adds what the family wrappers hand over: the wrapper
// contract passes the model node + edit ctx, so the flat chrome reads
// (language / code / loading / readonly / blockId) live here as typed
// readers over the wide props — the DSL has no casts and no optional
// chaining.
//
// 1. renderViewHighlight — the VIEW/STREAM face's highlight, byte-identical
//    to the builtin panel's resolveHighlighter: capability gate first
//    (highlight off = the plain-text path), bound impl, lowlight fallback,
//    '' sentinel for "no highlight" (the widget branches on it).
// 2. renderCodeHighlight — the EDIT overlay's highlight (always resolves,
//    escaped-plain-text fallback so the transparent-text textarea always
//    has visible text under it). Verbatim from code_editor_block_ext.ts.
// 3. focusCodeArea / resizeCodeArea / syncCodeHighlight — verbatim.
// 4. nodeLanguage / nodeText / nodeLoading / ctxReadonly / ctxBlockId —
//    typed readers over the family's wide node/ctx props.
// 5. codeController — the CodeEditorController factory for the edit face;
//    constructed ONCE per widget instance (model init), null in
//    view/stream modes where no ctx exists.
//
// Deployed verbatim to src/editor/ext/code_block_widget_ext.ts by gen.mjs
// (assert-editor-gen guards the byte sync).

import { getHighlightImpl } from '../../render/highlight'
import { lowlightHighlighter } from '../../render/highlight-lowlight'
import { isCapabilityEnabled } from '../../render/optional-capabilities'
import { attrGetBool, attrGetStr, blockText, type BlockNode } from '../../parser/block-model'
import { CodeEditorController } from '../engine/code-editor-controller'
import { clearClickCaret, setClickCaret, takeClickCaret } from '../engine/click-caret'
import type { EditorEngine } from '../engine/editor-engine'

// -- view/stream face ------------------------------------------------------------

/** Highlight HTML for the view face — the builtin panel's resolution order
 *  verbatim (capability gate → bound impl → lowlight), '' when the pipeline
 *  yields nothing so the plain-text branch applies. */
export function renderViewHighlight(code: string, language: string): string {
  if (!isCapabilityEnabled('highlight')) return ''
  const impl = getHighlightImpl() ?? lowlightHighlighter
  return impl(code, language) ?? ''
}

/** Escaped text for a v-html binding — the DSL's `text` emits a
 *  <span>{{}}</span> wrapper, but the builtin panel's byte contract pins
 *  bare text children (render.test's pre>code regex among them). */
export function htmlText(s: string): string {
  return escapeHtml(s)
}

/** The view pre's complete <code> child as one markup string — the two
 *  builtin branches byte-for-byte (highlighted: innerHTML + data-highlighted
 *  in the builtin's attr order; plain: escaped text child). <code> is not
 *  in the DSL element table and html: on a dyn element does not compile to
 *  v-html, so the string is the only byte-exact route. */
export function viewCodeInner(code: string, language: string): string {
  const html = renderViewHighlight(code, language)
  if (html !== '') {
    return `<code translate="no" data-highlighted="${escapeAttr(language)}">${html}</code>`
  }
  return `<code translate="no">${escapeHtml(code)}</code>`
}

/** The shared root's data-language: present on the edit wrapper (the
 *  CodeBlockMenu host contract), omitted in view modes (the builtin panel
 *  root carries none — undefined drops the attr). */
export function rootDataLanguage(mode: string, language: string): string | undefined {
  return mode === 'edit' ? language : undefined
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;')
}

// -- edit face (verbatim from code_editor_block_ext.ts, plan 023 P1T7) ------------

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Highlight HTML for the overlay pre: the render pipeline's highlight
 *  bridge with the Vue-layer lowlight fallback, degrading to escaped plain
 *  text so the transparent-text textarea always has visible text under it. */
export function renderCodeHighlight(code: string, language: string): string {
  const impl = getHighlightImpl() ?? lowlightHighlighter
  const html = impl(code, language)
  if (html !== undefined) return html
  return escapeHtml(code)
}

/** The edit overlay pre's complete inner markup (plan 039 T9): the
 *  highlighted spans wrapped in a <code> element, mirroring viewCodeInner.
 *  The token color rules chain through `pre code .hljs-*` — bare spans
 *  under the pre (the old renderCodeHighlight contract) never matched and
 *  the edit face read as unhighlighted. Wrapped like the view face, the
 *  same selectors color both. */
export function editCodeInner(code: string, language: string): string {
  const html = renderCodeHighlight(code, language)
  if (html !== escapeHtml(code)) {
    return `<code translate="no" data-highlighted="${escapeAttr(language)}">${html}</code>`
  }
  return `<code translate="no">${escapeHtml(code)}</code>`
}

/** The edit face's textarea draft: the model text with the closed-fence
 *  representation newline (the parser stores one trailing "\n" on every
 *  closed fence body) collapsed, so the caret-bearing edit face doesn't
 *  grow a phantom empty last line the preview never showed. The controller
 *  re-adds it on commit — representation, not content. */
export function draftCodeOf(node: BlockNode | undefined): string {
  const code = nodeText(node)
  return code.endsWith('\n') ? code.slice(0, -1) : code
}

// -- click-caret handoff (view-face click → edit-face mount focus) ---------------
// The focus swap is a DOM replacement: the preview pre unmounts and the
// textarea mounts, so the browser cannot carry the caret across. The
// view-face click handler records the pointed-at text offset; the edit
// face's Init consumes it. The store is the shared click-caret channel
// (engine/click-caret.ts) — the fence contributes the plaintext-offset
// payload (its caret is a textarea string index, not a DOM range), the rich
// text hosts the point payload.

/** Text offset of a mouse point within the view pre's plain text, via the
 *  caret API (Chromium caretRangeFromPoint / standard caretPositionFromPoint).
 *  Range.toString() over the highlighted <code> concatenates the text nodes
 *  in order, so the length equals the plaintext offset the textarea expects.
 *  Null when the engine yields nothing (unit/SSR environments, odd targets). */
function codeCaretOffsetAtPoint(pre: HTMLElement, x: number, y: number): number | null {
  const doc = pre.ownerDocument
  let node: Node | null = null
  let offset = 0
  const cdp = (doc as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }).caretRangeFromPoint
  const cpf = (doc as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }).caretPositionFromPoint
  if (typeof cdp === 'function') {
    const range = cdp.call(doc, x, y)
    if (!range) return null
    node = range.startContainer
    offset = range.startOffset
  } else if (typeof cpf === 'function') {
    const pos = cpf.call(doc, x, y)
    if (!pos) return null
    node = pos.offsetNode
    offset = pos.offset
  } else {
    return null
  }
  const host = pre.querySelector('code') ?? pre
  const r = doc.createRange()
  r.selectNodeContents(host)
  try {
    r.setEnd(node, offset)
  } catch {
    return null
  }
  return r.toString().length
}

/** View/stream-face click on the code pre (bubble phase — runs before the
 *  node-slot chrome's selectBlock ancestor handler within the same event).
 *  Records the pointed-at offset for takePendingCodeCaret; a no-op without
 *  a block ctx (streaming pane) or when the point resolves nowhere. */
export function captureCodeClick(ev: MouseEvent, blockId: string): void {
  clearClickCaret()
  if (ev.button !== 0 || blockId === '') return
  const pre = ev.currentTarget as HTMLElement | null
  if (!pre) return
  const offset = codeCaretOffsetAtPoint(pre, ev.clientX, ev.clientY)
  if (offset == null) return
  setClickCaret({ blockId, at: Date.now(), offset })
}

/** The edit face's Init consumes (and clears) the pending offset — stale
 *  handoffs older than the channel's expiry (the click landed elsewhere,
 *  keyboard focus path) fall back to the end-of-text default. */
export function takePendingCodeCaret(blockId: string): number | null {
  return takeClickCaret(blockId)?.offset ?? null
}

export function focusCodeArea(el: HTMLElement | null, readonly: boolean, caret?: number | null): void {
  if (!el || readonly) return
  const area = el as HTMLTextAreaElement
  area.focus()
  const end = area.value.length
  const at = typeof caret === 'number' && caret >= 0 && caret <= end ? Math.round(caret) : end
  area.setSelectionRange(at, at)
  resizeCodeArea(area)
}

export function resizeCodeArea(el: HTMLElement | null): void {
  const area = el as HTMLTextAreaElement | null
  if (!area) return
  area.style.height = 'auto'
  area.style.height = `${area.scrollHeight}px`
}

/** Keep the overlay pre glued to the textarea: mirror its height and any
 *  scroll offsets (the textarea auto-resizes, but wrapping/zoom edges can
 *  still scroll transiently). */
export function syncCodeHighlight(areaEl: HTMLElement | null, preEl: HTMLElement | null): void {
  const area = areaEl as HTMLTextAreaElement | null
  if (!area || !preEl) return
  preEl.style.height = area.style.height || `${area.offsetHeight}px`
  preEl.scrollTop = area.scrollTop
  preEl.scrollLeft = area.scrollLeft
}

// -- family prop readers ----------------------------------------------------------

export function nodeLanguage(node: BlockNode | undefined): string {
  return attrGetStr(node?.attrs ?? [], 'language', '')
}

export function nodeText(node: BlockNode | undefined): string {
  return blockText(node ?? ({ inlines: [] } as unknown as BlockNode))
}

export function nodeLoading(node: BlockNode | undefined): boolean {
  return attrGetBool(node?.attrs ?? [], 'loading', false)
}

export function ctxReadonly(ctx: unknown): boolean {
  return (ctx as { readonly?: boolean } | null | undefined)?.readonly === true
}

export function ctxBlockId(ctx: unknown): string {
  const id = (ctx as { blockId?: string } | null | undefined)?.blockId
  return typeof id === 'string' ? id : ''
}

/** The block id straight off the model node — the view/stream faces carry
 *  ctx: null (block_id is ''), so the click-caret handoff keys on the node
 *  id, which is the SAME id the edit face's ctx.blockId carries. */
export function nodeIdOf(node: BlockNode | undefined): string {
  return node?.id ?? ''
}

/** The edit face's headless commit controller (whole-text blur commit, one
 *  undo step). Null when no ctx arrived (view/stream modes). */
export function codeController(ctx: unknown): CodeEditorController | null {
  if (ctx == null) return null
  const c = ctx as { engine: EditorEngine; blockId: string }
  return new CodeEditorController(c.engine, c.blockId)
}

// -- family root-attr helpers (shared by the math/mermaid widget bridges) --------

/** An attribute only the edit face carries (undefined drops the attr —
 *  view/stream roots must not grow stray empty markers). */
export function editOnlyAttr(mode: string, v: string): string | undefined {
  return mode === 'edit' ? v : undefined
}

/** A bare marker attribute only the view/stream faces carry (the node-view
 *  contract's data-*-block="" shape). */
export function viewMarker(mode: string): string | undefined {
  return mode === 'edit' ? undefined : ''
}
