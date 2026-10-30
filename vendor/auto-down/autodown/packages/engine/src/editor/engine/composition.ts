// IME composition session (plan 018 Phase 1) — the host protocol for
// contenteditable composition. Preedit updates are staged in the host DOM
// and NEVER enter the op stack; commit diffs the pre-edit baseline against
// the final composed text into a single op (undo removes the whole
// composition in one step — pinned by semantics.test.ts).

import { InsertTextOp, Op, BlockPos, ReplaceRangeOp, Selection } from '../../parser/block-model'

export class CompositionSession {
  private active = false
  private baseline = ''
  private blockId = ''
  private baselineOffset = 0

  get composing(): boolean {
    return this.active
  }

  /** compositionstart — record the pre-edit state of the focused block. */
  begin(blockId: string, baseline: string, offset: number): void {
    this.active = true
    this.blockId = blockId
    this.baseline = baseline
    this.baselineOffset = offset
  }

  /** compositionupdate — staged preedit; produces NO op by contract. */
  update(_preedit: string): Op | null {
    return this.active ? null : null
  }

  /** compositionend — diff baseline → final text into one op. */
  commit(finalText: string): Op | null {
    if (!this.active) return null
    this.active = false
    if (this.baseline.length === 0 && finalText.length > 0) {
      return Op.InsertText(new InsertTextOp(new BlockPos(this.blockId, this.baselineOffset), finalText))
    }
    if (finalText === this.baseline) return null
    const sel = new Selection(
      new BlockPos(this.blockId, this.baselineOffset),
      new BlockPos(this.blockId, this.baselineOffset + this.baseline.length)
    )
    return Op.ReplaceRange(new ReplaceRangeOp(sel, finalText))
  }

  /** composition cancelled — nothing happened, by contract. */
  cancel(): Op | null {
    this.active = false
    return null
  }
}
