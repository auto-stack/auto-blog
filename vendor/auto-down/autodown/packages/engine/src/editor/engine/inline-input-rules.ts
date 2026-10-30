// Inline markdown input rules (plan-062 T-02): paired markers typed as flow
// text transform into marked spans the moment the closing marker completes —
// `**agc**` becomes bold "agc" with the cursor landing AFTER the mark, which
// kills the toggle-continuation pain at the model level (new typing is plain).
//
// Split from input-rules.ts (block-level exact-match table) per plan-062 §5.1:
// the matcher here is a pure text scan — no engine access — so the matrix
// (hit / unclosed / no opener / longest-first / nesting / escape / crossline)
// is unit-testable without a host. The Code-mark guard needs the block's
// spans, so it lives in the wiring (fireInlineRuleOn).
//
// Escape policy (plan-062 T-01 decision): the parser has no inline `\*`
// escape (P056 covered table cells only), so the minimal guard is "a marker
// preceded by a backslash never opens or closes". Serializer-side escaping
// is registered as debt in the plan (§10.2).

import {
  BlockNode,
  BlockPos,
  Mark,
  Op,
  ReplaceRangeOp,
  Selection,
  findBlock,
  blockText,
  replaceNode,
  withInlines,
} from '../../parser/block-model'
import { InlineSpan } from '../../parser/block-model'
import { normalizeSpans, toggleMarkOnSpans } from './marks'
import type { EditorEngine } from './editor-engine'

export interface InlineRule {
  marker: string
  mark: Mark
}

/** Longest markers first: `**` must be tried before `*` so `**a**` fires as
 *  Strong, and `~~` before anything of its prefix family. Backtick has no
 *  prefix family (pairs are unambiguous). */
export const INLINE_INPUT_RULES: InlineRule[] = [
  { marker: '~~', mark: Mark.Del },
  { marker: '**', mark: Mark.Strong },
  { marker: '`', mark: Mark.Code },
  { marker: '*', mark: Mark.Em },
]

export interface InlineRuleMatch {
  /** [start, end) covers marker + inner + marker — the region to rewrite. */
  start: number
  end: number
  /** where the inner text lands after the markers are stripped */
  innerStart: number
  innerLen: number
  mark: Mark
  marker: string
}

function isEscaped(text: string, i: number): boolean {
  return i > 0 && text[i - 1] === '\\'
}

/** A candidate opener must not sit inside a longer same-character run:
 *  in "**a*" neither `*` of the `**` run may open an Em span (plan-062
 *  AC-04: the `*` rule must not poach mid-`**` typing), same for `~~` in
 *  `~~~`. Two-sided run check (left neighbor + right of the marker). */
function inRunOfSameChar(text: string, i: number, marker: string): boolean {
  const c = marker[0]
  if (i > 0 && text[i - 1] === c) return true
  return i + marker.length < text.length && text[i + marker.length] === c
}

/** Match the inline rule whose CLOSING marker just completed: the marker's
 *  last char sits at caret-1. Scan left for the last unescaped opener with
 *  non-empty inner and no newline in the region. Returns null otherwise. */
export function matchInlineRule(text: string, caret: number): InlineRuleMatch | null {
  if (caret <= 0 || caret > text.length) return null
  for (const rule of INLINE_INPUT_RULES) {
    const m = rule.marker
    const close = caret - m.length
    if (close < 0) continue
    if (text.slice(close, caret) !== m) continue
    if (isEscaped(text, close)) continue
    let open = -1
    for (let i = close - m.length; i >= 0; i--) {
      if (text[i] !== m[0]) continue
      if (text.slice(i, i + m.length) !== m) continue
      if (isEscaped(text, i)) continue
      if (inRunOfSameChar(text, i, m)) continue
      // plan §5.1: the middle must not contain the same marker — typing the
      // second "**" of "**a**b**" must not bold "a**b" around the first
      // pair's closer.
      if (text.slice(i + m.length, close).includes(m)) continue
      open = i
      break
    }
    if (open < 0) continue
    const innerLen = close - (open + m.length)
    if (innerLen <= 0) continue
    if (text.slice(open, caret).includes('\n')) continue
    return { start: open, end: caret, innerStart: open + m.length, innerLen, mark: rule.mark, marker: m }
  }
  return null
}

function applyMarkTree(tree: BlockNode, blockId: string, resplit: (spans: InlineSpan[]) => InlineSpan[]): BlockNode {
  const found = findBlock(tree, blockId)
  if (!found) return tree
  return replaceNode(tree, blockId, [withInlines(found, resplit(found.inlines))])
}

/** Fire the inline rule that just closed at the engine caret: strip both
 *  markers, mark the inner text, park the caret after the mark — all as ONE
 *  undo step that reverts to the typed-marker text (AC-03). Returns false
 *  when nothing matched or the Code guard rejects the region. */
export function fireInlineRuleOn(engine: EditorEngine, blockId: string): boolean {
  const found = findBlock(engine.doc, blockId)
  if (!found) return false
  const text = blockText(found)
  const sel = engine.selection
  const caret = sel.anchor.blockId === blockId ? sel.anchor.offset : text.length
  const m = matchInlineRule(text, caret)
  if (!m) return false
  // Code guard (plan-062 §5.1): ANY Code-marked char in the region → no
  // fire. marksAtRange's all-chars intersection would miss mixed regions
  // (code span + plain span), so walk the spans directly.
  {
    let pos = 0
    for (const sp of found.inlines) {
      const sHi = pos + sp.text.length
      if (pos < m.end && sHi > m.start && sp.marks.includes(Mark.Code)) return false
      pos = sHi
    }
  }
  const innerText = text.slice(m.innerStart, m.innerStart + m.innerLen)
  const region = new Selection(new BlockPos(blockId, m.start), new BlockPos(blockId, m.end))
  engine.applyGroup([Op.ReplaceRange(new ReplaceRangeOp(region, innerText))], (tree) =>
    applyMarkTree(tree, blockId, (spans) =>
      normalizeSpans(toggleMarkOnSpans(spans, m.start, m.start + m.innerLen, m.mark)),
    ),
  )
  // cursor OUT of the mark: new typing continues as plain text (AC-02).
  const pos = new BlockPos(blockId, m.start + m.innerLen)
  engine.select(new Selection(pos, pos))
  return true
}
