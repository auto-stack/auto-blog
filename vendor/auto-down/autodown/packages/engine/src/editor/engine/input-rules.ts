// Input rule engine (plan 018 Phase 1): markdown shortcut rules as a pure
// data table + matcher. A rule fires when the block content is exactly the
// marker (just typed) — the engine then deletes the marker and converts the
// block kind. Heading level rides the 'level' attr (see serializer).
//
// Container rules (plan 025 Phase 0): "- "/"> " no longer convert the block
// into a bare ListItem/Blockquote leaf (a bare ListItem serializes to "" and
// has no render panel). Instead the marker-op sequence is followed by a wrap
// transform — ListBlock>ListItem>paragraph or Blockquote>paragraph — keeping
// the typed paragraph (and the selection) in place, one undo step.
//
// L1 (.at 单源) deferral note: the table is deliberately plain TS for v1 —
// it is 10 lines of data, the rust editor (019) has its own input stack
// (CodeEditorCore), so dual-target emission would buy nothing today. If a
// second target ever consumes this table, move it to auto/ via the
// palette_map.at pattern.

import {
  Attr,
  BlockPos,
  BlockNode,
  BlockType,
  Op,
  ReplaceRangeOp,
  Selection,
  SetBlockTypeOp,
  Value,
  attrSet,
  block,
  blockText,
  findBlock,
  hasIdDeep,
  replaceNode,
  withChildren,
  withKind,
} from '../../parser/block-model'

function levelAttr(level: number): Attr {
  return { key: 'level', value: Value.Int(level) }
}

export interface InputRule {
  /** exact marker that triggers (typed at block start, whole-block) */
  marker: string
  kind: BlockType
  /** attr patch applied with the kind change (e.g. heading level) */
  level?: number
  /** container semantics: wrap instead of converting the kind — ListBlock
   *  wraps as ListBlock>ListItem>block, Blockquote as Blockquote>block */
  wrap?: BlockType.ListBlock | BlockType.Blockquote
}

export const INPUT_RULES: InputRule[] = [
  { marker: '# ', kind: BlockType.Heading, level: 1 },
  { marker: '## ', kind: BlockType.Heading, level: 2 },
  { marker: '### ', kind: BlockType.Heading, level: 3 },
  { marker: '- ', kind: BlockType.ListItem, wrap: BlockType.ListBlock },
  { marker: '* ', kind: BlockType.ListItem, wrap: BlockType.ListBlock },
  { marker: '+ ', kind: BlockType.ListItem, wrap: BlockType.ListBlock },
  { marker: '> ', kind: BlockType.Blockquote, wrap: BlockType.Blockquote },
  { marker: '``` ', kind: BlockType.Fence },
  { marker: '---', kind: BlockType.ThematicBreak },
  { marker: '***', kind: BlockType.ThematicBreak },
]

/** Match a rule against the current block text (whole-block exact marker). */
export function matchInputRule(text: string): InputRule | null {
  for (const rule of INPUT_RULES) {
    if (text === rule.marker) return rule
  }
  return null
}

export interface InputRuleResult {
  /** op sequence for the engine: delete the marker, then convert the kind
   *  (container rules stop at the marker delete — the wrap is the after fn) */
  ops: Op[]
  /** attr patch applied after the ops (heading level etc.) */
  rule: InputRule
}

/** Build the op sequence for a fired rule on the given block. */
export function inputRuleOps(tree: BlockNode, blockId: string, rule: InputRule): InputRuleResult | null {
  const found = findBlock(tree, blockId)
  if (!found) return null
  const text = blockText(found)
  if (text !== rule.marker) return null
  const sel = new Selection(new BlockPos(blockId, 0), new BlockPos(blockId, text.length))
  const ops: Op[] = [Op.ReplaceRange(new ReplaceRangeOp(sel, ''))]
  if (!rule.wrap) ops.push(Op.SetBlockType(new SetBlockTypeOp(blockId, rule.kind)))
  return { ops, rule }
}

/** Apply the attr patch after the ops ran (heading level etc.). */
export function applyRuleAttrs(tree: BlockNode, blockId: string, rule: InputRule): BlockNode {
  if (rule.level == null) return tree
  const found = findBlock(tree, blockId)
  if (!found) return tree
  return replaceNode(tree, blockId, [withKind({ ...found, attrs: attrSet(found.attrs, 'level', Value.Int(rule.level)) }, found.kind)])
}

/** Fresh container ids that never collide with the live tree. */
function freshIds(tree: BlockNode, count: number, prefix: string): string[] {
  const out: string[] = []
  while (out.length < count) {
    const id = `${prefix}-${Math.random().toString(36).slice(2, 8)}`
    if (!hasIdDeep(tree, id) && !out.includes(id)) out.push(id)
  }
  return out
}

/** Container wrap for a fired rule: paragraph → ListBlock>ListItem>paragraph
 *  (list markers) or Blockquote>paragraph (quote marker). The block id and
 *  its inline text are preserved — the host keeps editing the same block. */
export function applyRuleWrap(tree: BlockNode, blockId: string, rule: InputRule, ids: string[]): BlockNode {
  const found = findBlock(tree, blockId)
  if (!found || !rule.wrap) return tree
  if (rule.wrap === BlockType.ListBlock) {
    const [listId, itemId] = ids
    const item = withChildren(block(itemId ?? 'li-x', BlockType.ListItem), [found])
    return replaceNode(tree, blockId, [withChildren(block(listId ?? 'lb-x', BlockType.ListBlock), [item])])
  }
  return replaceNode(tree, blockId, [withChildren(block(ids[0] ?? 'bq-x', BlockType.Blockquote), [found])])
}

/** Convenience orchestrator: fire the matching rule on the engine block as
 *  ONE undo step (marker ops + wrap/heading-level attr patch via tree fn). */
export function fireRuleOn(engine: { applyGroup(ops: Op[], after?: (tree: import('../../parser/block-model').BlockNode) => import('../../parser/block-model').BlockNode): void; doc: import('../../parser/block-model').BlockNode }, blockId: string): boolean {
  const found = findBlock(engine.doc, blockId)
  if (!found) return false
  const rule = matchInputRule(blockText(found))
  if (!rule) return false
  const res = inputRuleOps(engine.doc, blockId, rule)
  if (!res) return false
  const wrapIds = rule.wrap ? freshIds(engine.doc, rule.wrap === BlockType.ListBlock ? 2 : 1, 'b') : []
  engine.applyGroup(res.ops, (tree) => applyRuleAttrs(applyRuleWrap(tree, blockId, rule, wrapIds), blockId, rule))
  return true
}
