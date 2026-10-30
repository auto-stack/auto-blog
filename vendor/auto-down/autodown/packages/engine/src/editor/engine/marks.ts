// Mark span tools (plan 024 Phase 0) — the pure resplit core under the
// toggleMark/setLink commands. All offsets are character offsets into the
// concatenated span text (same coordinate space as spansInsert/Delete).
// Adjacent spans that end up with identical marks+attrs are merged so a
// toggle never shatters the model into splinters.

import { Attr, InlineSpan, Mark, Value, addMark, attrGetStr, delMark, hasMark, spansText } from '../../parser/block-model'

function sameMarks(a: Mark[], b: Mark[]): boolean {
  if (a.length !== b.length) return false
  for (const m of a) if (!hasMark(b, m)) return false
  return true
}

function sameValue(a: Value, b: Value): boolean {
  if (a._tag !== b._tag) return false
  if (!('value' in a) || !('value' in b)) return true
  return JSON.stringify(a.value) === JSON.stringify(b.value)
}

function sameAttrs(a: Attr[], b: Attr[]): boolean {
  if (a.length !== b.length) return false
  for (const x of a) {
    const y = b.find((c) => c.key === x.key)
    if (!y || !sameValue(x.value, y.value)) return false
  }
  return true
}

/** Merge adjacent spans with equal marks+attrs; drop empty fragments. */
export function normalizeSpans(spans: InlineSpan[]): InlineSpan[] {
  const out: InlineSpan[] = []
  for (const s of spans) {
    if (s.text === '') continue
    const last = out[out.length - 1]
    if (last && sameMarks(last.marks, s.marks) && sameAttrs(last.attrs, s.attrs)) {
      out[out.length - 1] = new InlineSpan(last.text + s.text, last.marks, last.attrs)
    } else {
      out.push(s)
    }
  }
  return out
}

/** Marks carried by every char of [lo, hi) — the isActive semantics source.
 *  A collapsed range reads the span enclosing the offset. */
export function marksAtRange(spans: InlineSpan[], lo: number, hi: number): Mark[] {
  if (spans.length === 0) return []
  const total = spansText(spans).length
  lo = Math.max(0, Math.min(lo, total))
  hi = Math.max(lo, Math.min(hi, total))
  let covered: InlineSpan[] = []
  let pos = 0
  let lastBefore: InlineSpan | null = null
  for (const s of spans) {
    const sHi = pos + s.text.length
    if (lo < sHi && hi > pos) covered.push(s)
    if (pos <= lo && sHi > lo) lastBefore = s
    if (sHi <= lo) lastBefore = s
    pos = sHi
  }
  if (covered.length === 0) covered = lastBefore ? [lastBefore] : [spans[spans.length - 1]]
  let out: Mark[] = [...covered[0].marks]
  for (const s of covered.slice(1)) out = out.filter((m) => hasMark(s.marks, m))
  return out
}

/** Resplit [lo, hi) applying (`add`) or stripping (`remove`) one mark. */
function applyMarkToRange(spans: InlineSpan[], lo: number, hi: number, mark: Mark, mode: 'add' | 'remove'): InlineSpan[] {
  const out: InlineSpan[] = []
  let pos = 0
  for (const s of spans) {
    const sLo = pos
    const sHi = pos + s.text.length
    const oLo = Math.max(lo, sLo)
    const oHi = Math.min(hi, sHi)
    if (oLo < oHi) {
      const at = oLo - sLo
      const end = oHi - sLo
      if (at > 0) out.push(new InlineSpan(s.text.slice(0, at), s.marks, s.attrs))
      out.push(new InlineSpan(s.text.slice(at, end), mode === 'add' ? addMark(s.marks, mark) : delMark(s.marks, mark), s.attrs))
      if (end < s.text.length) out.push(new InlineSpan(s.text.slice(end), s.marks, s.attrs))
    } else {
      out.push(s)
    }
    pos = sHi
  }
  return normalizeSpans(out)
}

/** Toggle a mark over [lo, hi): remove it when every char in range already
 *  has it, add it otherwise. Returns the input reference for a no-op range. */
export function toggleMarkOnSpans(spans: InlineSpan[], lo: number, hi: number, mark: Mark): InlineSpan[] {
  const total = spansText(spans).length
  lo = Math.max(0, lo)
  hi = Math.min(hi, total)
  if (lo >= hi) return spans
  const active = marksAtRange(spans, lo, hi)
  return applyMarkToRange(spans, lo, hi, mark, hasMark(active, mark) ? 'remove' : 'add')
}

/** Link [lo, hi): set the Link mark and (re)point href, keeping other marks. */
export function setLinkOnSpans(spans: InlineSpan[], lo: number, hi: number, href: string): InlineSpan[] {
  const total = spansText(spans).length
  lo = Math.max(0, lo)
  hi = Math.min(hi, total)
  if (lo >= hi) return spans
  const out: InlineSpan[] = []
  let pos = 0
  for (const s of spans) {
    const sLo = pos
    const sHi = pos + s.text.length
    const oLo = Math.max(lo, sLo)
    const oHi = Math.min(hi, sHi)
    if (oLo < oHi) {
      if (hasMark(s.marks, Mark.Link) && attrGetStr(s.attrs, 'href', '') === href) {
        out.push(s)
      } else {
        const at = oLo - sLo
        const end = oHi - sLo
        const linkAttrs = [new Attr('href', Value.Str(href))]
        if (at > 0) out.push(new InlineSpan(s.text.slice(0, at), s.marks, s.attrs))
        out.push(new InlineSpan(s.text.slice(at, end), addMark(s.marks, Mark.Link), linkAttrs))
        if (end < s.text.length) out.push(new InlineSpan(s.text.slice(end), s.marks, s.attrs))
      }
    } else {
      out.push(s)
    }
    pos = sHi
  }
  return normalizeSpans(out)
}
