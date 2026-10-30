// CodeEditorController (plan 023 P1T4) — the headless logic behind
// CodeEditorBlock.vue (BlockHost pattern: logic here, DOM wiring in the SFC).
//
// Commit protocol: while the textarea is focused it owns its text; on blur
// the WHOLE code text is written back as one undo step (applyTree over
// replaceNode + withInlines). Whole-text commit because code is multi-line —
// a character diff op would thread "\n" through the text-op kernel, which
// the host protocol only ever sees for single-line leaf blocks.

import { BlockNode, blockText, findBlock, replaceNode, span, withInlines } from '../../parser/block-model'
import type { EditorEngine } from './editor-engine'

export class CodeEditorController {
  private engine: EditorEngine
  private blockId: string
  private knownCode: string

  constructor(engine: EditorEngine, blockId: string) {
    this.engine = engine
    this.blockId = blockId
    this.knownCode = this.readModel()
  }

  get id(): string {
    return this.blockId
  }

  get code(): string {
    return this.knownCode
  }

  /** The live block (attrs included) — the SFC reads the language from it. */
  node(): BlockNode | null {
    return findBlock(this.engine.doc, this.blockId)
  }

  /** The engine repaints after history changes / external edits — re-sync. */
  syncFromModel(): string {
    this.knownCode = this.readModel()
    return this.knownCode
  }

  /** Write the edited code text back; false = no change or block gone. */
  commit(newCode: string): boolean {
    if (newCode === this.knownCode) return false
    const found = findBlock(this.engine.doc, this.blockId)
    if (!found) return false
    this.engine.applyTree((tree) => replaceNode(tree, this.blockId, [withInlines(found, [span(newCode)])]))
    this.syncFromModel()
    return true
  }

  /** The code widget's commit: the edit face drafts the COLLAPSED text
   *  (draftCodeOf strips the closed-fence representation newline), so the
   *  model representation is restored here before the compare+write — an
   *  untouched blur stays a no-op, a real edit always wins, and a trailing
   *  newline the user actually typed becomes model content on top of the
   *  representation. Math/mermaid draft the model text verbatim and keep
   *  using commit. */
  commitDraft(newCode: string): boolean {
    if (this.knownCode.endsWith('\n')) {
      newCode = newCode + '\n'
    }
    return this.commit(newCode)
  }

  private readModel(): string {
    const found = findBlock(this.engine.doc, this.blockId)
    return found ? blockText(found) : ''
  }
}
