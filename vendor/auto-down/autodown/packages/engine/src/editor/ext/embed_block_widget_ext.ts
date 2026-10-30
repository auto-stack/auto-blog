// embed_block_widget_ext.ts — platform bridge for the EmbedBlockWidget
// (plan 038 T5): the embed family's view/stream widget, absorbing the
// retired BlockEmbedNodeView's ext surface (errorMessage came from
// node_view_ext.ts) plus the src-semantics readers:
//
// 1. parseEmbedSrc — the three-form embed src ruling (plan 038 待澄清③):
//      "title"           page-level reference       → { title, blockId: null }
//      "title#^blockId"  block anchor inside page   → { title, blockId }
//      "^blockId"        current-page block anchor  → { title: '', blockId }
//    blockId strips the ^ (the loader channel takes the bare id — jade's
//    /api/blocks/{id}); the pure-anchor form's title is completed by
//    context (v1: the display falls back to the anchor id alone).
//    attrs.src stays canonical — the roundtrip never rewrites it; only the
//    display/loading layers consume the parse (the siyuan-era
//    raw/title/blockId attr shape is retired with the node view).
// 2. embedSrcOf / embedTitle / embedBlockId — typed readers over the
//    family's wide node prop (three fns, one parse each: an
//    object-literal-returning computed is not expressible in the DSL).
// 3. blockLoader — the module-level data-loader slot read (plan 038 T1):
//    null when unconfigured, the widget's "No block loader configured"
//    placeholder branch.
// 4. errorMessage — the catch-branch extraction (no casts in the DSL).
//
// Deployed verbatim to src/editor/ext/embed_block_widget_ext.ts by gen.mjs
// (assert-editor-gen guards the byte sync).

import { attrGetStr, type BlockNode } from '../../parser/block-model'
import { getDataLoaders, type LoadBlockFn } from '../engine/data-loaders'

export interface EmbedSrcParsed {
  /** the page-reference part ('' for the pure-anchor form) */
  title: string
  /** the bare block anchor id, null for a page-level reference */
  blockId: string | null
}

// parseEmbedSrc — the three-form ruling (see the header comment). An empty
// or missing src parses as the empty page-level shape (no load, no label).
export function parseEmbedSrc(src: string): EmbedSrcParsed {
  if (src.startsWith('^')) {
    return { title: '', blockId: src.length > 1 ? src.slice(1) : null }
  }
  const hash = src.indexOf('#^')
  if (hash >= 0) {
    return { title: src.slice(0, hash), blockId: src.slice(hash + 2) || null }
  }
  return { title: src, blockId: null }
}

/** The family node prop's src attr ('' when absent). */
export function embedSrcOf(node: BlockNode | undefined): string {
  return attrGetStr(node?.attrs ?? [], 'src', '')
}

/** The parsed title part ('' for the pure-anchor form). */
export function embedTitle(node: BlockNode | undefined): string {
  return parseEmbedSrc(embedSrcOf(node)).title
}

/** The parsed bare block id (null for a page-level reference). */
export function embedBlockId(node: BlockNode | undefined): string | null {
  return parseEmbedSrc(embedSrcOf(node)).blockId
}

/** The registered block loader (null = the placeholder state — the
 *  EngineEditor loadBlock prop never arrived). */
export function blockLoader(): LoadBlockFn | null {
  return getDataLoaders().loadBlock ?? null
}

// errorMessage — the originals' `err.message || String(err)` catch-branch
// extraction. TS types the catch param `unknown` under strict mode (no
// annotation/cast syntax exists for it), and the DSL has no casts, so the
// narrowing lives here.
export function errorMessage(e: unknown): string {
  return (e as any)?.message || String(e)
}
