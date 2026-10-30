// Tiptap chain adapter (plan 018 余量批次) — lets the 30-item slash
// manifest (auto_down_editor_ext.ts getSlashItems) run UNCHANGED on the
// self-built engine: item.command({ editor, range }) receives this adapter
// as `editor`. Covers exactly the API surface the manifest uses:
// chain().focus().{setHeading|setParagraph|setCodeBlock|setMathBlock|
// setMermaidBlock|setCallout|setDetails|setImage|setHorizontalRule|
// toggleBulletList|toggleOrderedList|toggleTaskList|toggleBlockquote|
// insertContent}().run(), plus the storage['slash-command'] handshake and
// the __engine back-reference (engine-native manifest readers, plan 021
// Phase 2).
//
// Block-level only (v1): inline mark chains (bold/italic bubbles) come with
// the inline-mark op extension in Phase 4.

import {
  withChildren,
  BlockNode,
  attrSet,
  collapsedSel,
  replaceNode,
  Attr,
  BlockType,
  BlockPos,
  Mark,
  Selection,
  Value,
  attrGet,
  blockText,
  childIndex,
  findBlock,
  hasMark,
  leafBlock,
  parentOf,
} from '../../parser/block-model'
import { parse_blocks } from '../../parser/markdown-parser'

import { ref } from 'vue'
import type { EditorEngine } from './editor-engine'
import { marksInRange, tableAddRowTree, tableAddColumnAtTree, tableDeleteColumnAtTree } from './commands'
import { activeMarksAtCaret, domSelectionAdapter, getFocusedRichHost, toggleMark } from './selection-adapter'
import { blockRangeToDomRange } from './selection-map'

const KIND_COMMANDS: Record<string, BlockType> = {
  setParagraph: BlockType.Paragraph,
  setMathBlock: BlockType.MathBlock,
  setMermaidBlock: BlockType.Mermaid,
  setHorizontalRule: BlockType.ThematicBreak,
  toggleBulletList: BlockType.ListItem,
  toggleOrderedList: BlockType.ListItem,
  toggleBlockquote: BlockType.Blockquote,
}

/** tiptap mark names → engine Marks (plan 024 P3T1). Underline has no Mark
 *  representation — the bubble button is clipped at the .at source. */
const MARK_BY_NAME: Record<string, Mark> = {
  bold: Mark.Strong,
  strong: Mark.Strong,
  italic: Mark.Em,
  em: Mark.Em,
  strike: Mark.Del,
  strikethrough: Mark.Del,
  underline: Mark.Underline,
  code: Mark.Code,
  link: Mark.Link,
}

/** tiptap block names → engine BlockTypes (plan 026 P0T2): isActive /
 *  getAttributes resolve the name against the focused block's FAMILY — the
 *  block itself plus every ancestor (a caret in a cell is "in a table"). */
const BLOCK_BY_NAME: Record<string, BlockType> = {
  table: BlockType.Table,
  codeBlock: BlockType.Fence,
  fence: BlockType.Fence,
  blockquote: BlockType.Blockquote,
  bulletList: BlockType.ListBlock,
  orderedList: BlockType.ListBlock,
  listItem: BlockType.ListItem,
  heading: BlockType.Heading,
  details: BlockType.Details,
  callout: BlockType.Callout,
  mathBlock: BlockType.MathBlock,
  mermaid: BlockType.Mermaid,
  queryBlock: BlockType.QueryBlock,
  blockEmbed: BlockType.BlockEmbed,
}

/** Ancestor chain of `id` (inclusive), collected root-ward while unwinding;
 *  `out` receives every kind on the doc→block path. */
function collectFamilyKinds(node: BlockNode, id: string, out: Set<BlockType>): boolean {
  if (node.id === id) {
    out.add(node.kind)
    return true
  }
  for (const c of node.children) {
    if (collectFamilyKinds(c, id, out)) {
      out.add(node.kind)
      return true
    }
  }
  return false
}

/** Attr list → plain object (Str/Int/Bool unwrap; structural values null). */
function attrsToObject(attrs: Attr[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const a of attrs) {
    const v = a.value as Value
    out[a.key] = v != null && (v._tag === 'Str' || v._tag === 'Int' || v._tag === 'Bool') ? v.value : null
  }
  return out
}

export interface ChainLike {
  focus(): ChainLike
  setHeading(opts: { level: number }): ChainLike
  insertContent(content: string): ChainLike
  deleteRange(range: { from: number; to: number }): ChainLike
  insertTable(opts: unknown): ChainLike
  setImage(opts: Record<string, unknown>): ChainLike
  /** Inline mark toggles (plan 024 P3T1): wrap the focused host's live DOM;
   *  the model catches up on the blur writeback. No-op without a host. */
  toggleBold(): ChainLike
  toggleItalic(): ChainLike
  toggleStrike(): ChainLike
  toggleCode(): ChainLike
  toggleUnderline(): ChainLike
  setLink(opts: { href: string }): ChainLike
  unsetLink(): ChainLike
  /** Table verbs (plan 026 P0T3) — resolved against the focused cell. */
  addRowBefore(): ChainLike
  addRowAfter(): ChainLike
  deleteRow(): ChainLike
  addColumnBefore(): ChainLike
  addColumnAfter(): ChainLike
  deleteColumn(): ChainLike
  deleteTable(): ChainLike
  /** Code language channel (plan 026 P0T3): setBlockAttrs(language) IAL. */
  setCodeBlockLanguage(lang: string): ChainLike
  setCodeBlock(opts?: { language?: string }): ChainLike
  /** Slash Details template (plan 026 P2T3): kind + summary attr. */
  setDetails(opts?: { summary?: string }): ChainLike
  /** Slash Callout template (plan 030 T7): kind + type/title attrs. */
  setCallout(opts?: { type?: string; title?: string }): ChainLike
  /** Task list verb (plan 030 T7): focused ListItem toggles the checked
   *  attr (task ⇄ plain bullet); non-list converts like toggleBulletList. */
  toggleTaskList(): ChainLike
  run(): boolean
}

/** tiptap-shaped event callback (the mounted chrome subscribes with
 *  `editor.on('selectionUpdate', cb)` — payload unused by the widgets). */
export type AdapterListener = () => void

/** The view shim (plan 026 P0T2): the mounted chrome anchors its floating
 *  menus against `view.dom` (the editor content element) and, on the
 *  no-trigger fallback path, asks `nodeDOM(from)` for the focused block's
 *  element. Lazy + DOM-optional so headless/SSR consumers never touch
 *  `document`. */
export interface AdapterView {
  readonly dom: HTMLElement | null
  readonly state: { selection: { from: number; to: number } }
  nodeDOM(from: number): HTMLElement | null
  /** Caret viewport coords for the focused rich host's char offset
   *  (plan 028 P3T1) — the floating menus' positioning source. Optional on
   *  the frozen interface — createEditorAdapter always sets it. */
  coordsAtPos?(from: number): { top: number; left: number; right: number; bottom: number } | null
}

export interface EditorAdapter {
  storage: Record<string, any>
  chain(): ChainLike
  isActive(_name: string, _attrs?: any): boolean
  /** Focused-block attrs as a plain object (plan 026 P0T2); {} when the
   *  name does not match the focused block's family. Optional on the frozen
   *  interface — createEditorAdapter always sets it. */
  getAttributes?(_name: string): Record<string, unknown>
  /** Floating-menu anchor (plan 026 P0T2). Same optional-member rule. */
  view?: AdapterView
  isEditable: boolean
  /** Event surface (plan 026 P0T1): 'selectionUpdate' subscribers are
   *  notified when an engine change moves the selection. Optional on the
   *  frozen interface — createEditorAdapter always sets it. */
  on?(event: string, cb: AdapterListener): void
  off?(event: string, cb: AdapterListener): void
  /** The wrapped session — engine-native readers (slash-manifest's
   *  getCurrentBlockAnchor / ensureBlockAnchor) reach the model through it.
   *  Optional: createEditorAdapter always sets it, but the interface is on
   *  the 1.0.0 frozen surface (plan 020 Phase 4) — a required field would
   *  break external implementors. */
  __engine?: EditorEngine
  /** plan-062 T-04: reactive bump for caret-only moves (the engine emit
   *  fires on content changes; bare caret moves need their own tick so
   *  isActive-driven computeds re-evaluate). */
  __bump?: () => void
}

function sameSelection(a: Selection, b: Selection): boolean {
  return a.anchor.blockId === b.anchor.blockId && a.anchor.offset === b.anchor.offset && a.head.blockId === b.head.blockId && a.head.offset === b.head.offset
}

export function createEditorAdapter(engine: EditorEngine): EditorAdapter {
  // Reactive tick read inside isActive: consumers that evaluate isActive in
  // a Vue computed (the bubble's buttons) re-evaluate on every engine change
  // — the engine itself is not Vue-reactive (plan 024 P3T2).
  const selectionTick = ref(0)
  // Event-bus subscriptions (plan 026 P0T1): the mounted chrome (TableMenu)
  // subscribes by name; dispatch is gated on the selection actually moving.
  const listeners = new Map<string, Set<AdapterListener>>()
  let lastSel: Selection = engine.selection
  const dispatch = (event: string): void => {
    const subs = listeners.get(event)
    if (!subs) return
    for (const cb of [...subs]) cb()
  }
  engine.onChange((change) => {
    selectionTick.value++
    if (!sameSelection(change.selection, lastSel)) {
      lastSel = change.selection
      dispatch('selectionUpdate')
    }
  })
  const adapter: EditorAdapter = {
    storage: { 'slash-command': { query: '', range: null, handled: false } },
    isEditable: true,
    on: (event: string, cb: AdapterListener) => {
      let subs = listeners.get(event)
      if (!subs) {
        subs = new Set()
        listeners.set(event, subs)
      }
      subs.add(cb)
    },
    off: (event: string, cb: AdapterListener) => {
      listeners.get(event)?.delete(cb)
    },
    isActive: (name: string) => {
      void selectionTick.value
      const m = MARK_BY_NAME[name]
      if (m != null) {
        // plan-062 T-04: collapsed caret — the engine selection does not
        // track bare caret moves; the DOM caret's enclosing styled element
        // is the truth for the cancel-channel highlight.
        const live = activeMarksAtCaret()
        if (live.length > 0) return live.includes(m)
        return hasMark(marksInRange(engine, engine.selection), m)
      }
      const kind = BLOCK_BY_NAME[name]
      if (kind == null) return false
      const family = new Set<BlockType>()
      collectFamilyKinds(engine.doc, engine.selection.anchor.blockId, family)
      return family.has(kind)
    },
    getAttributes: (name: string) => {
      void selectionTick.value
      const kind = BLOCK_BY_NAME[name]
      if (kind == null) return {}
      const found = findBlock(engine.doc, engine.selection.anchor.blockId)
      if (found && found.kind === kind) return attrsToObject(found.attrs)
      // ancestor match (caret in a cell, attrs of the table)
      if (found) {
        const family = new Set<BlockType>()
        if (collectFamilyKinds(engine.doc, found.id, family) && family.has(kind)) {
          let node: BlockNode | null = found
          while (node) {
            if (node.kind === kind) return attrsToObject(node.attrs)
            node = parentOf(engine.doc, node.id) ?? null
          }
        }
      }
      return {}
    },
    view: {
      get dom(): HTMLElement | null {
        if (typeof document === 'undefined') return null
        return document.querySelector<HTMLElement>('.autodown-editor-content')
      },
      get state() {
        return {
          selection: {
            from: engine.selection.anchor.offset,
            to: engine.selection.head.offset,
          },
        }
      },
      nodeDOM(_from: number): HTMLElement | null {
        if (typeof document === 'undefined') return null
        const content = document.querySelector<HTMLElement>('.autodown-editor-content')
        if (!content) return null
        const id = engine.selection.anchor.blockId
        for (const el of content.querySelectorAll<HTMLElement>('[data-block-id]')) {
          if (el.dataset.blockId === id) return el
        }
        return null
      },
      /** Caret viewport coords (plan 028 P3T1, 021-F5): the focused rich
       *  host's char offset → blockRangeToDomRange → first client rect
       *  (whole-host rect fallback). ProseMirror coordsAtPos shape — the
       *  generated floating menus (SlashMenu two-stage positioning) consume
       *  it to open at the caret instead of the default corner. */
      coordsAtPos(from: number): { top: number; left: number; right: number; bottom: number } | null {
        if (typeof document === 'undefined') return null
        const blockId = engine.selection.anchor.blockId
        const hostEl =
          getFocusedRichHost() ??
          document.querySelector<HTMLElement>(`.autodown-block-host[data-block-id="${blockId}"]`)
        if (!hostEl) return null
        const range = blockRangeToDomRange(hostEl, from, from)
        const rects = range.getClientRects()
        const r = rects.length > 0 ? rects[0] : range.getBoundingClientRect()
        return { top: r.top, left: r.left, right: r.right, bottom: r.bottom }
      },
    },
    chain: () => createChain(engine),
    __engine: engine,
    __bump: () => {
      selectionTick.value++
    },
  }
  return adapter
}

/** The focused table context (plan 026 P0T3): cell selections carry their
 *  row/column; a table-level selection (focus stops at the table face —
 *  plan 023 semantics) leaves them null and the verbs take the table-ends
 *  defaults (append row/column, drop the last). */
interface TableTarget {
  tableId: string
  rowId: string | null
  rowIdx: number | null
  colIdx: number | null
}

function tableTarget(engine: EditorEngine): TableTarget | null {
  const id = engine.selection.anchor.blockId
  const found = findBlock(engine.doc, id)
  if (!found) return null
  if (found.kind === BlockType.Table) return { tableId: id, rowId: null, rowIdx: null, colIdx: null }
  if (found.kind !== BlockType.TableCell) return null
  const row = parentOf(engine.doc, id)
  if (!row || row.kind !== BlockType.TableRow) return null
  const table = parentOf(engine.doc, row.id)
  if (!table || table.kind !== BlockType.Table) return null
  return { tableId: table.id, rowId: row.id, rowIdx: childIndex(table, row.id), colIdx: childIndex(row, id) }
}

/** Row id a table verb inserts relative to: the focused row, else the table's
 *  last row (append) / none-before-first. */
function tableRows(engine: EditorEngine, tableId: string): BlockNode[] {
  return findBlock(engine.doc, tableId)?.children ?? []
}

function createChain(engine: EditorEngine): ChainLike {
  const pending: Array<(tree: BlockNode) => BlockNode> = []
  const chain: ChainLike = {
    focus: () => chain,
    run: () => {
      engine.applyTree((tree) => pending.reduce((t, fn) => fn(t), tree))
      // selection repair: a verb that removed the focused block (deleteRow on
      // the anchor's row, deleteTable) leaves a dangling anchor — collapse to
      // the first block so the editor never sits on a ghost id.
      if (!findBlock(engine.doc, engine.selection.anchor.blockId) && engine.doc.children[0]) {
        engine.select(collapsedSel(engine.doc.children[0].id, 0))
      }
      return true
    },
    setHeading: (opts: { level: number }) => {
      pending.push((tree) => setKind(tree, engine, BlockType.Heading, [{ key: 'level', value: Value.Int(opts?.level ?? 1) }]))
      return chain
    },
    insertContent: (content: string) => {
      const md = String(content ?? '')
      pending.push((tree) => {
        if (!md.includes('\n')) return insertMarkdown(tree, engine, md)
        // multiline template: parse to blocks, insert after the current one
        const parsed = parse_blocks(md, true)
        const kids = parsed.children
        if (kids.length === 0) return tree
        const id = currentBlockId(engine)
        const found = findBlock(tree, id)
        if (!found) return tree
        const siblings = tree.children
        const idx = siblings.findIndex((c) => c.id === id)
        const emptied = blockText(found) === '' ? [] : [found]
        const next = [...siblings.slice(0, idx), ...emptied, ...kids, ...siblings.slice(idx + 1)]
        return withChildren(tree, next)
      })
      return chain
    },
    deleteRange: (range: { from: number; to: number }) => {
      // v1 assumed the query sits at the block end; range-aware since plan
      // 026 P2T3 (the slash trigger fires at block start just as well)
      pending.push((tree) => {
        const id = currentBlockId(engine)
        const found = findBlock(tree, id)
        if (!found) return tree
        const text = blockText(found)
        const lo = Math.max(0, Math.min(range.from, text.length))
        const hi = Math.max(lo, Math.min(range.to, text.length))
        return replaceNode(tree, id, [leafBlock(id, found.kind, text.slice(0, lo) + text.slice(hi))])
      })
      return chain
    },
    insertTable: (_opts: unknown) => {
      pending.push((tree) => insertMarkdown(tree, engine, '| a | b |\n| --- | --- |\n|  |  |\n|  |  |'))
      return chain
    },
    setImage: (opts: Record<string, unknown>) => {
      const src = String(opts?.src ?? '')
      const alt = String((opts as any)?.alt ?? '')
      pending.push((tree) => insertMarkdown(tree, engine, `![${alt}](${src})`))
      return chain
    },
    // table verbs (plan 026 P0T3): forward to the commands.ts table transforms,
    // resolved against the focused cell (table-level focus takes the
    // table-ends defaults); tree-level so a chain stays ONE undo.
    addRowAfter: () => {
      const f = tableTarget(engine)
      if (!f) return chain
      const rows = tableRows(engine, f.tableId)
      const after = f.rowId ?? rows[rows.length - 1]?.id ?? null
      pending.push((tree) => tableAddRowTree(tree, f.tableId, after))
      return chain
    },
    addRowBefore: () => {
      const f = tableTarget(engine)
      if (!f) return chain
      const rows = tableRows(engine, f.tableId)
      const prevId = f.rowIdx != null && f.rowIdx > 0 ? rows[f.rowIdx - 1]!.id : null
      pending.push((tree) => tableAddRowTree(tree, f.tableId, prevId))
      return chain
    },
    deleteRow: () => {
      const f = tableTarget(engine)
      if (!f) return chain
      const rows = tableRows(engine, f.tableId)
      if (rows.length <= 1) return chain
      const victim = f.rowId ?? rows[rows.length - 1]!.id
      pending.push((tree) => replaceNode(tree, victim, []))
      return chain
    },
    addColumnBefore: () => {
      const f = tableTarget(engine)
      if (!f) return chain
      pending.push((tree) => tableAddColumnAtTree(tree, f.tableId, f.colIdx ?? 0))
      return chain
    },
    addColumnAfter: () => {
      const f = tableTarget(engine)
      if (!f) return chain
      const end = tableRows(engine, f.tableId)[0]?.children.length ?? 0
      pending.push((tree) => tableAddColumnAtTree(tree, f.tableId, f.colIdx != null ? f.colIdx + 1 : end))
      return chain
    },
    deleteColumn: () => {
      const f = tableTarget(engine)
      if (!f) return chain
      const rows = tableRows(engine, f.tableId)
      const last = Math.max(0, (rows[0]?.children.length ?? 1) - 1)
      pending.push((tree) => tableDeleteColumnAtTree(tree, f.tableId, f.colIdx ?? last))
      return chain
    },
    deleteTable: () => {
      const f = tableTarget(engine)
      if (f) pending.push((tree) => replaceNode(tree, f.tableId, []))
      return chain
    },
    // code language channel (plan 026 P0T3): setBlockAttrs on the focused
    // Fence (023's IAL ruling); converts the kind when not a Fence yet.
    setCodeBlockLanguage: (lang: string) => {
      pending.push((tree) => setKind(tree, engine, BlockType.Fence, [{ key: 'language', value: Value.Str(String(lang ?? '')) }]))
      return chain
    },
    setCodeBlock: (opts?: { language?: string }) => {
      if (opts?.language != null) return chain.setCodeBlockLanguage(opts.language)
      pending.push((tree) => setKind(tree, engine, BlockType.Fence))
      return chain
    },
    // slash manifest's Details template carries { summary } (plan 026 P2T3):
    // kind conversion + summary attr so the mounted node-view shows it.
    // Converting an inline leaf moves its text into a child paragraph — a
    // Details renders children, inlines would serialize away (data loss).
    setDetails: (opts?: { summary?: string }) => {
      pending.push((tree) => {
        const id = currentBlockId(engine)
        const found = findBlock(tree, id)
        if (!found) return tree
        const kids =
          found.children.length > 0
            ? found.children
            : blockText(found).length > 0
              ? [leafBlock(`${id}-p`, BlockType.Paragraph, blockText(found))]
              : []
        let next: BlockNode = { ...found, kind: BlockType.Details, children: kids }
        if (opts?.summary != null) next = { ...next, attrs: attrSet(next.attrs, 'summary', Value.Str(String(opts.summary))) }
        return replaceNode(tree, id, [next])
      })
      return chain
    },
    // slash Callout template carries { type, title } (plan 030 T7): same
    // conversion shape as setDetails — before this the kind-only KIND_COMMANDS
    // path silently dropped both attrs (the lost-title roundtrip break).
    setCallout: (opts?: { type?: string; title?: string }) => {
      pending.push((tree) => {
        const id = currentBlockId(engine)
        const found = findBlock(tree, id)
        if (!found) return tree
        const kids =
          found.children.length > 0
            ? found.children
            : blockText(found).length > 0
              ? [leafBlock(`${id}-p`, BlockType.Paragraph, blockText(found))]
              : []
        let next: BlockNode = { ...found, kind: BlockType.Callout, children: kids }
        if (opts?.type != null) next = { ...next, attrs: attrSet(next.attrs, 'type', Value.Str(String(opts.type))) }
        if (opts?.title != null) next = { ...next, attrs: attrSet(next.attrs, 'title', Value.Str(String(opts.title))) }
        return replaceNode(tree, id, [next])
      })
      return chain
    },
    // task list (plan 030 T7): a real verb distinct from toggleBulletList —
    // the focused ListItem (a caret usually sits on its child paragraph, so
    // resolve the ListItem ancestor first — the list-commands 选中定位
    // discipline) gains/loses the `checked` attr (task ⇄ plain bullet);
    // outside a list it converts like the bullet verb.
    toggleTaskList: () => {
      pending.push((tree) => {
        const id = currentBlockId(engine)
        let found: BlockNode | null = findBlock(tree, id)
        while (found != null && found.kind !== BlockType.ListItem) {
          found = parentOf(tree, found.id)
        }
        if (found == null) return setKind(tree, engine, BlockType.ListItem)
        const isTask = attrGet(found.attrs, 'checked') != null
        const attrs = isTask
          ? found.attrs.filter((a) => a.key !== 'checked')
          : attrSet(found.attrs, 'checked', Value.Bool(false))
        return replaceNode(tree, found.id, [{ ...found, attrs }])
      })
      return chain
    },
    // inline mark toggles (plan 024 P3T1; adapter-routed plan 036 T3): wrap
    // the FOCUSED host's live DOM through the SelectionAdapter — the model
    // catches up on the blur writeback. No focused host → no-op.
    toggleBold: () => {
      toggleMark(domSelectionAdapter, Mark.Strong)
      return chain
    },
    toggleItalic: () => {
      toggleMark(domSelectionAdapter, Mark.Em)
      return chain
    },
    toggleStrike: () => {
      toggleMark(domSelectionAdapter, Mark.Del)
      return chain
    },
    toggleCode: () => {
      toggleMark(domSelectionAdapter, Mark.Code)
      return chain
    },
    // underline (plan 028 P2T2): same DOM-wrap protocol as the others —
    // the model catches up on the blur writeback (u → Mark.Underline)
    toggleUnderline: () => {
      toggleMark(domSelectionAdapter, Mark.Underline)
      return chain
    },
    setLink: (opts: { href: string }) => {
      const href = String(opts?.href ?? '')
      if (href) domSelectionAdapter.applyMark(Mark.Link, href)
      else domSelectionAdapter.removeMark(Mark.Link)
      return chain
    },
    unsetLink: () => {
      domSelectionAdapter.removeMark(Mark.Link)
      return chain
    },
  }
  const dynamic = chain as any
  for (const [name, kind] of Object.entries(KIND_COMMANDS)) {
    dynamic[name] = () => {
      pending.push((tree) => setKind(tree, engine, kind))
      return chain
    }
  }
  return chain
}

function currentBlockId(engine: EditorEngine): string {
  return engine.selection.anchor.blockId || engine.doc.children[0]?.id || ''
}

function setKind(tree: BlockNode, engine: EditorEngine, kind: BlockType, attrs?: { key: string; value: any }[]): BlockNode {
  const id = currentBlockId(engine)
  const found = findBlock(tree, id)
  if (!found) return tree
  let next: BlockNode = { ...found, kind }
  if (attrs) {
    for (const a of attrs) next = { ...next, attrs: attrSet(next.attrs, a.key, a.value) }
  }
  return replaceNode(tree, id, [next])
}

function insertMarkdown(tree: BlockNode, engine: EditorEngine, md: string): BlockNode {
  // v1: single-block insertion into the current (focused) block; multi-block
  // templates should go through insertTemplate directly.
  const id = currentBlockId(engine)
  const found = findBlock(tree, id)
  if (!found) return tree
  const merged = blockText(found) + md
  return replaceNode(tree, id, [leafBlock(id, found.kind, merged)])
}

// -- slash trigger helper -----------------------------------------------------------

/** Derive the slash query from a host's text + caret: the '/' must sit at
 *  block start or after whitespace, with the query between it and the caret.
 *  Mirrors the Suggestion(char: '/') behavior closely enough for v1. */
export function slashQueryAt(text: string, offset: number): string | null {
  const before = text.slice(0, offset)
  const m = before.match(/(?:^|\s)\/([^\s/]*)$/)
  return m ? m[1] : null
}

/** Dispatch the slash CustomEvents for the current host state (the engine
 *  replacement for Tiptap Suggestion's onStart/onUpdate). */
export function dispatchSlashState(query: string | null, blockId: string, offset: number): void {
  if (query == null) {
    document.dispatchEvent(new CustomEvent('autodown:slash-close', { detail: {} }))
    return
  }
  const detail = {
    query,
    range: { from: offset - query.length - 1, to: offset },
    items: [],
    blockId,
  }
  document.dispatchEvent(new CustomEvent('autodown:slash-open', { detail }))
}

