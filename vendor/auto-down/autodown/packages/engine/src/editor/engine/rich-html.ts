// Rich host HTML (plan 024 Phase 2) — mount-time inline rendering for the
// focused text-leaf host: InlineSpan marks become real elements
// (strong/em/del/code/a). Text is always escaped; anchors render
// contenteditable=false so editing never follows the link. Image-marked
// spans fall back to plain text (v1: the blur walk skips blocks that
// contain them — no data loss, no in-place image editing).

import { Attr, InlineSpan, Mark, Value, addMark, attrGetStr, hasMark } from '../../parser/block-model'
import { normalizeSpans } from './marks'

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;')
}

/** The focused host's initial inner HTML. The v1 mark set is exactly the
 *  five inline elements; anything else renders as escaped plain text.
 *  Trailing spaces become &nbsp; — a collapsible trailing space in a
 *  contenteditable gets normalized away by the browser on the next edit
 *  (Chromium drops it mid-typing); nbsp keeps it until the blur walk
 *  normalizes back (plan 025 P2T1). */
export function spansToHtml(spans: InlineSpan[]): string {
  let out = ''
  for (const s of spans) {
    let inner = escapeHtml(s.text)
    // inline wikilink/math (plan 036 T6): the attr-carrying spans mount as
    // atomic non-editable labels at the TEXT level (marks still wrap around
    // them — the spansToHtml mirror of spanMd's text-level emission). The
    // wikilink label is byte-aligned with the retired 020 decorator's DOM
    // contract; math shows the source literal (D4 v1) carried by
    // data-math-src for the blur walk.
    const wiki = attrGetStr(s.attrs, 'wikilink', '')
    if (wiki !== '') {
      const hash = wiki.indexOf('#')
      const title = (hash >= 0 ? wiki.slice(0, hash) : wiki).trim()
      inner = `<span class="autodown-wikilink-label" data-wikilink-title="${escapeAttr(title)}" contenteditable="false">${escapeHtml(wiki)}</span>`
    }
    const math = attrGetStr(s.attrs, 'math_inline', '')
    if (math !== '') {
      inner = `<span class="autodown-math-inline" data-math-src="${escapeAttr(math)}" contenteditable="false">${escapeHtml(math)}</span>`
    }
    if (hasMark(s.marks, Mark.Code)) inner = `<code>${inner}</code>`
    if (hasMark(s.marks, Mark.Strong)) inner = `<strong>${inner}</strong>`
    if (hasMark(s.marks, Mark.Em)) inner = `<em>${inner}</em>`
    if (hasMark(s.marks, Mark.Underline)) inner = `<u>${inner}</u>`
    if (hasMark(s.marks, Mark.Del)) inner = `<del>${inner}</del>`
    if (hasMark(s.marks, Mark.Link)) {
      const href = escapeAttr(attrGetStr(s.attrs, 'href', ''))
      const title = attrGetStr(s.attrs, 'title', '')
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : ''
      inner = `<a href="${href}"${titleAttr} contenteditable="false" data-autodown-link>${inner}</a>`
    }
    out += inner
  }
  return out.replace(/ +$/, (run) => '&nbsp;'.repeat(run.length))
}

// -- blur walk: rich DOM → spans (the spansToHtml inverse) -----------------------

/** Injected node description of a rich host subtree (headless-testable). */
export interface RichNode {
  tag?: string
  text?: string
  children?: RichNode[]
  attrs?: Record<string, string>
}

function markForTag(tag: string): Mark | null {
  const t = tag.toUpperCase()
  if (t === 'STRONG' || t === 'B') return Mark.Strong
  if (t === 'EM' || t === 'I') return Mark.Em
  if (t === 'DEL' || t === 'S') return Mark.Del
  if (t === 'U') return Mark.Underline
  if (t === 'CODE') return Mark.Code
  return null
}

/** Flattened text of a rich-node subtree (nbsp-normalized like text runs). */
function richTextOf(nodes: RichNode[] | undefined): string {
  let out = ''
  for (const n of nodes ?? []) {
    if (n.text !== undefined) out += n.text.replace(/\u00A0/g, ' ')
    else out += richTextOf(n.children)
  }
  return out
}

/** Walk a rich-node tree collecting (text, marks, attrs) runs; adjacent
 *  same-format runs merge (normalizeSpans). Structure-only elements (br)
 *  contribute nothing. */
export function richTreeToSpans(root: RichNode): InlineSpan[] {
  const out: InlineSpan[] = []
  const walk = (n: RichNode, marks: Mark[], attrs: Attr[]): void => {
    if (n.text !== undefined) {
      // DOM boundary hygiene: Chromium leaves U+00A0 for typed spaces in
      // contenteditable — normalize or the model/serializer collect nbsp
      // that the parser later drops (plan 025 P2T1)
      const text = n.text.replace(/\u00A0/g, ' ')
      if (text !== '') out.push(new InlineSpan(text, marks, attrs))
      return
    }
    // blur recycle of the atomic inline spans (plan 036 T6): the wikilink
    // label and the math literal recover whole — the subtree text becomes
    // the span text and the discriminator attr rides along; marks that
    // wrapped the element (e.g. Strong) survive on the span.
    const cls = n.attrs?.class ?? ''
    if (cls.includes('autodown-wikilink-label')) {
      const text = richTextOf(n.children)
      if (text !== '') out.push(new InlineSpan(text, marks, [new Attr('wikilink', Value.Str(text))]))
      return
    }
    if (cls.includes('autodown-math-inline')) {
      const text = n.attrs?.['data-math-src'] ?? richTextOf(n.children)
      if (text !== '') out.push(new InlineSpan(text, marks, [new Attr('math_inline', Value.Str(text))]))
      return
    }
    let m = marks
    let a = attrs
    const tagMark = markForTag(n.tag ?? '')
    if (tagMark !== null) m = addMark(m, tagMark)
    if ((n.tag ?? '').toUpperCase() === 'A' && n.attrs?.href !== undefined) {
      m = addMark(m, Mark.Link)
      a = [new Attr('href', Value.Str(n.attrs.href))]
      if (n.attrs.title !== undefined) a.push(new Attr('title', Value.Str(n.attrs.title)))
    }
    for (const c of n.children ?? []) walk(c, m, a)
  }
  walk(root, [], [])
  return normalizeSpans(out)
}

/** Real-DOM adapter for richTreeToSpans (e2e-pinned). */
export function domRootToSpans(root: HTMLElement): InlineSpan[] {
  const conv = (n: Node): RichNode => {
    if (n.nodeType === 3) return { text: n.textContent ?? '' }
    const el = n as HTMLElement
    const attrs: Record<string, string> = {}
    const href = el.getAttribute?.('href')
    if (href != null) attrs.href = href
    const title = el.getAttribute?.('title')
    if (title != null) attrs.title = title
    const cls = el.getAttribute?.('class')
    if (cls != null) attrs.class = cls
    const wikiTitle = el.getAttribute?.('data-wikilink-title')
    if (wikiTitle != null) attrs['data-wikilink-title'] = wikiTitle
    const mathSrc = el.getAttribute?.('data-math-src')
    if (mathSrc != null) attrs['data-math-src'] = mathSrc
    return { tag: el.tagName ?? '', children: Array.from(n.childNodes).map(conv), attrs }
  }
  return richTreeToSpans(conv(root))
}
