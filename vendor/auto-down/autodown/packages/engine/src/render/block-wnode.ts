// BlockNode -> WNode bridge (plan 023 P0T1) — hand-written, never generated.
//
// The editing engine's document model (BlockNode: kind/inlines/attrs) and the
// render pipeline's node model (WNode: type/code/language, produced by
// parseDocument) are two shapes of the same tree. convertBlock
// (markdown-parser, generated) maps WNode -> BlockNode at parse time; the
// serializer maps BlockNode -> markdown. This module is the missing direct
// leg: BlockNode -> WNode, producing the same tree the old
// serialize -> parseDocument round trip produced, so the EngineEditor preview
// can feed engine.doc.children straight into renderNodes — one render
// pipeline, zero re-parse.
//
// Serializer conventions mirrored here (spanMd / tableMd):
// - a span whose text is exactly "\n" is a hard break (spanMd writes "  \n")
// - a table's children[0] is the header row (tableMd emits it + delimiter)

import {
  BlockNode,
  BlockType,
  InlineSpan,
  Mark,
  attrGet,
  attrGetBool,
  attrGetInt,
  attrGetStr,
  hasMark,
  spansText,
} from '../parser/block-model'
import {
  WNode,
  cellNode,
  codeNode,
  codeSpanNode,
  emNode,
  hardbreakNode,
  headingNode,
  imageNode,
  itemNode,
  linkNode,
  listNode,
  mathInlineNode,
  paraNode,
  quoteNode,
  rawTextNode,
  rowNode,
  strikeNode,
  strongNode,
  tableNode,
  thematicNode,
  underlineNode,
  wikilinkNode,
} from '../parser/markdown-parser'

// Model back-link (plan 026 P1T2): the node-view panels registered on the
// registry receive WNodes; this map carries the originating BlockNode so the
// node-view host bridge can fabricate attrs/writeback props. Populated by
// blockNodeToWNode, keyed per conversion (fresh WNode every render).
const wnodeBlock = new WeakMap<WNode, BlockNode>()

/** The model block a converted WNode came from (undefined for parse-side
 *  WNodes — static render, no writeback). */
export function blockOfWNode(w: WNode): BlockNode | undefined {
  return wnodeBlock.get(w)
}

export function blockNodesToWNodes(nodes: BlockNode[]): WNode[] {
  return (nodes ?? []).map(blockNodeToWNode)
}

export function blockNodeToWNode(node: BlockNode): WNode {
  const w = convertBlockNode(node)
  wnodeBlock.set(w, node)
  return w
}

function convertBlockNode(node: BlockNode): WNode {
  switch (node.kind) {
    case BlockType.Heading:
      return headingNode(attrGetInt(node.attrs, 'level', 1), inlineTree(node.inlines))
    case BlockType.Fence:
      return codeNode(
        attrGetStr(node.attrs, 'language', ''),
        spansText(node.inlines),
        attrGetBool(node.attrs, 'loading', false)
      )
    case BlockType.Blockquote:
      return quoteNode(node.children.map(blockNodeToWNode))
    case BlockType.ListBlock:
      return listNode(
        attrGetBool(node.attrs, 'ordered', false),
        attrGetInt(node.attrs, 'start', 1),
        node.children.map(blockNodeToWNode)
      )
    case BlockType.ListItem: {
      // task item (plan 030): a present `checked` attr rides the WNode slot
      const found = attrGet(node.attrs, 'checked')
      const checked = found == null ? null : attrGetBool(node.attrs, 'checked', false)
      return itemNode(node.children.map(blockNodeToWNode), checked)
    }
    case BlockType.Table: {
      const rows = node.children.map(tableRowToWNode)
      return tableNode(rows.length > 0 ? [rows[0]] : [], rows.slice(1), attrGetBool(node.attrs, 'loading', false))
    }
    case BlockType.ThematicBreak:
      return thematicNode()
    case BlockType.Callout: {
      // plan 030: parse-side slot layout — language = callout type,
      // title = title (the builtin renderCalloutPanel reads both)
      const w = new WNode(
        'callout', null, null, null, null, null,
        node.children.map(blockNodeToWNode),
        null, null, null, null, null, null, null, null, null, null, null, null, null, null
      )
      w.language = attrGetStr(node.attrs, 'type', '')
      w.title = attrGetStr(node.attrs, 'title', '')
      return w
    }
    case BlockType.Details:
      // extension panels (plan 026): the WNode type drives the palette spec
      // (panelOfBlock('details') -> Details); attrs ride the model back-link
      return new WNode(
        'details', null, null, null, null, null,
        node.children.map(blockNodeToWNode),
        null, null, null, null, null, null, null, null, null, null, null, null, null, null
      )
    case BlockType.MathBlock:
      return new WNode(
        'math_block', null, null, null, spansText(node.inlines), null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null
      )
    case BlockType.Mermaid:
      return new WNode(
        'mermaid', null, null, null, spansText(node.inlines), null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null
      )
    case BlockType.QueryBlock:
      // plan 038 T3: attrs.query rides the content slot — the parser's
      // queryNode shape, so parse-side WNodes and bridged WNodes carry the
      // query text identically (the static fallback reads w.content)
      return new WNode(
        'query', attrGetStr(node.attrs, 'query', ''), null, null, null, null,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null
      )
    case BlockType.BlockEmbed:
      return new WNode(
        'embed', null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null, null, null, attrGetStr(node.attrs, 'src', ''), null, null
      )
    default:
      // convertBlock maps every other WNode type to a Paragraph; the mirror
      // image keeps exotic engine blocks previewing exactly like the old
      // serialize->reparse path did.
      return paraNode(inlineTree(node.inlines))
  }
}

function tableRowToWNode(row: BlockNode): WNode {
  return rowNode(row.children.map(tableCellToWNode))
}

function tableCellToWNode(cell: BlockNode): WNode {
  return cellNode(
    attrGetBool(cell.attrs, 'header', false),
    inlineTree(cell.inlines),
    attrGetStr(cell.attrs, 'align', 'left')
  )
}

// -- flat mark spans -> nested inline WNode tree -----------------------------------

// Marks peel outermost-first, in the order the serializer writes wrappers
// (spanMd: code `..` inside ** .. inside * .. inside __..__ inside ~~..~~
// inside [..](..)).
const PEEL_ORDER: Mark[] = [Mark.Strong, Mark.Em, Mark.Underline, Mark.Del, Mark.Link]

function inlineTree(spans: InlineSpan[]): WNode[] {
  return peel(spans, 0)
}

function peel(spans: InlineSpan[], depth: number): WNode[] {
  const mark = PEEL_ORDER[depth]
  if (mark === undefined) return leaves(spans)
  const out: WNode[] = []
  let run: InlineSpan[] = []
  const emitRun = () => {
    if (run.length === 0) return
    out.push(wrapMark(mark, run, peel(run, depth + 1)))
    run = []
  }
  for (const s of spans) {
    if (hasMark(s.marks, mark)) run.push(s)
    else {
      emitRun()
      out.push(...peel([s], depth + 1))
    }
  }
  emitRun()
  return out
}

function wrapMark(mark: Mark, run: InlineSpan[], kids: WNode[]): WNode {
  switch (mark) {
    case Mark.Strong:
      return strongNode(kids)
    case Mark.Em:
      return emNode(kids)
    case Mark.Underline:
      return underlineNode(kids)
    case Mark.Del:
      return strikeNode(kids)
    case Mark.Link: {
      const href = attrGetStr(run[0].attrs, 'href', '')
      const title = attrGetStr(run[0].attrs, 'title', '')
      return linkNode(href, title.length > 0 ? title : null, spansText(run), kids, false)
    }
    default:
      return kids[0]
  }
}

function leaves(spans: InlineSpan[]): WNode[] {
  const out: WNode[] = []
  for (const s of spans) {
    if (s.text === '\n') {
      out.push(hardbreakNode())
      continue
    }
    // inline wikilink (plan 036 T5): the attr-carrying span converts back
    // into the wikilink WNode (raw inner rides the title slot) so the
    // preview renders the label contract instead of bare text
    if (attrGetStr(s.attrs, 'wikilink', '') !== '') {
      out.push(wikilinkNode(s.text))
      continue
    }
    // inline math (plan 036 T6): same bridge, source rides the code slot
    if (attrGetStr(s.attrs, 'math_inline', '') !== '') {
      out.push(mathInlineNode(s.text))
      continue
    }
    if (hasMark(s.marks, Mark.Image)) {
      const img = imageNode(attrGetStr(s.attrs, 'src', ''), s.text)
      const title = attrGetStr(s.attrs, 'title', '')
      if (title.length > 0) img.title = title
      if (hasMark(s.marks, Mark.Link)) {
        const href = attrGetStr(s.attrs, 'href', '')
        out.push(linkNode(href, null, s.text, [img], false))
      } else {
        out.push(img)
      }
      continue
    }
    if (hasMark(s.marks, Mark.Code)) {
      out.push(codeSpanNode(s.text))
      continue
    }
    out.push(rawTextNode(s.text))
  }
  return out
}
