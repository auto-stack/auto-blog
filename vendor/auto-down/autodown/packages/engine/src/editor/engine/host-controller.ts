// Block host controller (plan 018 Phase 2) — the UI-free logic behind a
// per-leaf-block contenteditable host. The Vue shell (BlockHost.vue) wires
// DOM events to these methods; everything here is headless-testable.
//
// Host protocol:
// - input (outside composition): diff known text → diffToOp → engine.apply
// - Enter at offset: SplitBlock (new block focused)
// - Backspace at offset 0 with previous sibling: MergeBlocks
// - after each input, the input-rule matcher gets a chance to fire
// - composition: CompositionSession (preedit staged in DOM, commit = one op)

import {
  BlockNode,
  BlockPos,
  BlockType,
  InlineSpan,
  Mark,
  MergeBlocksOp,
  Op,
  Selection,
  SplitBlockOp,
  blockText,
  findBlock,
  hasMark,
  parentOf,
  replaceNode,
  withChildren,
  withInlines,
} from '../../parser/block-model'
import { parse_blocks } from '../../parser/markdown-parser'
import { inlinesMd } from '../../parser/serializer'
import { EditorEngine } from './editor-engine'
import { CompositionSession } from './composition'
import { diffToOp } from './text-diff'
import { fireRuleOn } from './input-rules'
import { fireInlineRuleOn } from './inline-input-rules'
import { backspaceAtItemStart, enterInItem, enterInQuote, indentItem, outdentItem } from './list-commands'
import { domRootToSpans } from './rich-html'

export class BlockHostController {
  private engine: EditorEngine
  private blockId: string
  private knownText: string
  readonly composition = new CompositionSession()

  constructor(engine: EditorEngine, blockId: string) {
    this.engine = engine
    this.blockId = blockId
    const found = findBlock(engine.doc, blockId)
    this.knownText = found ? blockText(found) : ''
  }

  get id(): string {
    return this.blockId
  }

  get text(): string {
    return this.knownText
  }

  /** The block's inline spans (rich host mount render — plan 024 P2T1). */
  get inlines(): InlineSpan[] {
    const found = findBlock(this.engine.doc, this.blockId)
    return found ? found.inlines : []
  }

  /** Where the DOM caret should sit after a model-side rewrite: the engine
   *  selection when it targets this block (inline input rules park it after
   *  the mark), else null → the resync falls back to end-of-text. */
  desiredCaretOffset(): number | null {
    const sel = this.engine.selection
    return sel.anchor.blockId === this.blockId ? sel.anchor.offset : null
  }

  /** The host was (re)rendered from the engine — re-sync the known text
   *  (history changes repaint the host). */
  syncFromModel(): string {
    const found = findBlock(this.engine.doc, this.blockId)
    this.knownText = found ? blockText(found) : ''
    return this.knownText
  }

  /** `input` DOM event outside composition: old→new text becomes one op.
   *  D17 fix: `knownText` only advances when the op actually mutated the
   *  model. After an external doc replacement a cached controller can hold
   *  a blockId that no longer exists (deterministic ids collide across
   *  docs) — `apply` then no-ops, and unconditionally advancing knownText
   *  desynced it from the model so every later keystroke diffed to nothing
   *  (keystrokes reached the DOM but never the model until blur). On a
   *  no-op we resync from the model instead, so the host DOM is pulled
   *  back to truth on the next input event. */
  onInput(newText: string): Op | null {
    if (this.composition.composing) return null // preedit stays in the DOM
    const op = diffToOp(this.blockId, this.knownText, newText)
    if (!op) return null
    const treeBefore = this.engine.doc
    this.engine.apply(op)
    if (this.engine.doc === treeBefore) {
      // op silently no-op'd (block vanished / offsets invalid): realign.
      this.syncFromModel()
      return null
    }
    this.knownText = newText
    // give the input rules a chance (marker just completed): block rules
    // first (`***` whole-block), then the inline paired-marker rules
    // (plan-062 T-03) — block-level wins so `***` never double-fires.
    if (!fireRuleOn(this.engine, this.blockId)) {
      fireInlineRuleOn(this.engine, this.blockId)
    }
    this.syncFromModel()
    return op
  }

  /** Enter key at caret offset → split the block. Nested paragraphs dispatch
   *  on the parent kind first (plan 025 P1T3): a ListItem parent splits the
   *  ITEM, a Blockquote parent continues the quote; only top-level leaves
   *  take the bare SplitBlock path. */
  onEnter(offset: number, newId: string): void {
    const parent = parentOf(this.engine.doc, this.blockId)
    if (parent?.kind === BlockType.ListItem) {
      enterInItem(this.engine, this.blockId, offset)
      this.syncFromModel()
      return
    }
    if (parent?.kind === BlockType.Blockquote) {
      enterInQuote(this.engine, this.blockId, offset)
      this.syncFromModel()
      return
    }
    this.engine.apply(Op.SplitBlock(new SplitBlockOp(new BlockPos(this.blockId, offset), newId)))
    // D17 fix: only reset the diff baseline when the split actually landed.
    // A no-op split (stale blockId) previously cleared knownText, poisoning
    // the next keystroke's diff (giant offset-0 insert).
    if (findBlock(this.engine.doc, newId)) {
      this.knownText = ''
    } else {
      this.syncFromModel()
    }
  }

  /** Backspace at offset 0 → merge with the previous sibling (if any). In a
   *  list item the structural command owns the semantics (merge into the
   *  previous ITEM / lift the first item out); elsewhere the merge target
   *  must be an editable leaf of the same container — a container sibling
   *  (nested list subtree) never merges. */
  onBackspaceAtStart(previousSiblingId: string | null): boolean {
    const parent = parentOf(this.engine.doc, this.blockId)
    if (parent?.kind === BlockType.ListItem) {
      backspaceAtItemStart(this.engine, this.blockId)
      this.syncFromModel()
      return true
    }
    if (!previousSiblingId) return false
    const prev = findBlock(this.engine.doc, previousSiblingId)
    if (!prev || !isEditableLeaf(prev)) return false
    this.engine.apply(Op.MergeBlocks(new MergeBlocksOp(previousSiblingId, this.blockId)))
    this.syncFromModel()
    return true
  }

  /** Previous mergeable sibling of this block, resolved MODEL-side. The
   *  deployed host DOM nests the contenteditable inside per-block slot
   *  wrappers (node-slot > node-content), so a previousElementSibling lookup
   *  is always null and the DOM route never fired the merge. Returns null at
   *  the first child position or when the previous sibling is not an
   *  editable leaf (containers and attr-only blocks never merge) — the same
   *  guard onBackspaceAtStart applies, so a non-null result guarantees the
   *  op will land. */
  prevSiblingId(): string | null {
    const parent = parentOf(this.engine.doc, this.blockId)
    if (!parent) return null
    const idx = parent.children.findIndex((c) => c.id === this.blockId)
    if (idx <= 0) return null
    const prev = parent.children[idx - 1]
    return isEditableLeaf(prev) ? prev.id : null
  }

  /** Next mergeable sibling of this block, mirror of prevSiblingId. */
  nextSiblingId(): string | null {
    const parent = parentOf(this.engine.doc, this.blockId)
    if (!parent) return null
    const idx = parent.children.findIndex((c) => c.id === this.blockId)
    if (idx < 0 || idx + 1 >= parent.children.length) return null
    const next = parent.children[idx + 1]
    return isEditableLeaf(next) ? next.id : null
  }

  /** Cross-block vertical navigation, ↑ at the host's first visual line:
   *  select the previous editable-leaf sibling with the caret at its END
   *  (the reactive remount then mounts that block's host, whose mount
   *  focus lands the caret at the block end — exactly the contract).
   *  Returns the target block id, or null when there is nothing to
   *  navigate to (first block / container siblings stay out of v1). */
  navigateUp(): string | null {
    const prev = this.prevSiblingId()
    if (!prev) return null
    const found = findBlock(this.engine.doc, prev)
    if (!found) return null
    const end = blockText(found).length
    const sel = new Selection(new BlockPos(prev, end), new BlockPos(prev, end))
    this.engine.select(sel)
    return prev
  }

  /** ↓ at the last visual line: select the next editable-leaf sibling with
   *  the caret at its START. mountHost defaults the caret to the block end,
   *  so the ext re-places the caret at offset 0 once the remount has run. */
  navigateDown(): string | null {
    const next = this.nextSiblingId()
    if (!next) return null
    const sel = new Selection(new BlockPos(next, 0), new BlockPos(next, 0))
    this.engine.select(sel)
    return next
  }

  /** Tab / Shift+Tab inside a list item → indent / outdent (plan 025 P1T3).
   *  Returns false (browser default) when the block is not in a list. */
  onTab(shift: boolean): boolean {
    const parent = parentOf(this.engine.doc, this.blockId)
    if (parent?.kind !== BlockType.ListItem) return false
    if (shift) outdentItem(this.engine, this.blockId)
    else indentItem(this.engine, this.blockId)
    this.syncFromModel()
    return true
  }

  // -- composition delegates ------------------------------------------------------

  compositionBegin(baseline: string, offset: number): void {
    this.composition.begin(this.blockId, baseline, offset)
  }

  compositionUpdate(preedit: string): void {
    this.composition.update(preedit)
    // preedit is staged in the host DOM; knownText stays at the baseline
  }

  compositionCommit(finalText: string): Op | null {
    const op = this.composition.commit(finalText)
    if (op) {
      this.engine.apply(op, { coalesce: false })
      this.syncFromModel()
    }
    return op
  }

  compositionCancel(): void {
    this.composition.cancel()
  }

  /** Markdown / multiline paste: parse to blocks and insert after this one
   *  (plan 018 目标 5 — paste is v1-mandatory; HTML paste degrades to
   *  text/plain per 待澄清 5). */
  onPasteMarkdown(md: string): void {
    const parsed = parse_blocks(md, true)
    const kids = parsed.children.length > 0 ? parsed.children : []
    if (kids.length === 0) return
    const before = this.engine.doc
    const siblings = before.children
    const idx = siblings.findIndex((c) => c.id === this.blockId)
    const next = [...siblings.slice(0, idx + 1), ...kids, ...siblings.slice(idx + 1)]
    this.engine.applyTree(() => withChildren(before, next))
    this.syncFromModel()
  }

  // -- rich blur writeback (plan 024 P2T2) ----------------------------------------

  /** Focus-leave writeback of the rich host: DOM walk → spans → whole-block
   *  withInlines through applyTree — ONE undo step, CodeEditorBlock protocol.
   *  Returns true when a rewrite landed. */
  onRichBlur(domRoot: HTMLElement): boolean {
    return this.commitRichSpans(domRootToSpans(domRoot))
  }

  /** Headless core of onRichBlur (the walk itself is e2e-pinned). Blocks
   *  carrying Image marks are skipped: their marks are not rendered in the
   *  rich host, so a rewrite would silently drop them (v1 no-data-loss). */
  commitRichSpans(spans: InlineSpan[]): boolean {
    const found = findBlock(this.engine.doc, this.blockId)
    if (!found) return false
    if (this.inlines.some((s) => hasMark(s.marks, Mark.Image))) return false
    if (inlinesMd(found.inlines) === inlinesMd(spans)) return false
    this.engine.applyTree((tree) => {
      const b = findBlock(tree, this.blockId)
      return b ? replaceNode(tree, this.blockId, [withInlines(b, spans)]) : tree
    })
    this.syncFromModel()
    return true
  }
}

/** Is this block a leaf the host can edit (has inline text, no children)?
 *  Container kinds (Details/Callout — children-based) and attr-only blocks
 *  (Query/Embed — source lives in attrs) never host: typing into them
 *  serializes nowhere; their focus state is the preview-side node-view
 *  (plan 026 P2T3). Math/Mermaid stay hostable — their source IS inlines. */
export function isEditableLeaf(node: BlockNode): boolean {
  if (node.children.length !== 0) return false
  if (node.kind === BlockType.ThematicBreak) return false
  if (node.kind === BlockType.Details) return false
  if (node.kind === BlockType.Callout) return false
  if (node.kind === BlockType.QueryBlock) return false
  if (node.kind === BlockType.BlockEmbed) return false
  return true
}
