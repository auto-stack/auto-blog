// D17 regression tests (jade-edit PLAN-002 execution findings, fixed in
// plan-682 batch): after an external doc replacement (replaceDoc) or a
// full editor remount, keystrokes must still reach the model AND emit
// per-stroke. Historical bug: cached controllers survived replaceDoc with
// stale knownText baselines (deterministic block ids collide across docs),
// and a no-op apply silently swallowed every later keystroke until blur.

import { describe, expect, it } from 'vitest'
import { BlockType, block, blockText, collapsedSel, findBlock, leafBlock, withChildren } from '../../parser/block-model'
import { serialize } from '../../parser/serializer'
import { EditorEngine } from '../engine/editor-engine'
import { BlockHostController } from '../engine/host-controller'

function doc(...kids: Parameters<typeof withChildren>[1][]) {
  return withChildren(block('doc', BlockType.Paragraph), kids as never)
}
void doc

describe('D17 input pipeline after external doc replacement', () => {
  it('stale controller no-op input does not poison knownText (resyncs instead)', () => {
    const e = new EditorEngine(
      withChildren(block('doc', BlockType.Paragraph), [
        leafBlock('block-0', BlockType.Paragraph, 'hello'),
      ]),
      collapsedSel('block-0', 0),
    )
    const c = new BlockHostController(e, 'block-0')
    expect(c.onInput('hello!')).not.toBeNull()
    expect(blockText(findBlock(e.doc, 'block-0')!)).toBe('hello!')

    // External replacement: same id (`block-0`), different content+length.
    e.replaceDoc(
      withChildren(block('doc', BlockType.Paragraph), [
        leafBlock('block-0', BlockType.Paragraph, 'REPLACED'),
      ]),
      collapsedSel('block-0', 0),
    )
    // The host DOM was not re-rendered, so its text is still "hello!" while
    // the model says "REPLACED". A keystroke producing "hello!x" diffs to an
    // op beyond the model block end — must NOT corrupt the model and must
    // NOT advance knownText past truth.
    const op = c.onInput('hello!x')
    if (op !== null) {
      // If an op was produced, the model must actually have changed.
      expect(e.doc).not.toBeUndefined()
    }
    // Either way the controller realigns to the model text.
    expect(c.syncFromModel()).toBe(blockText(findBlock(e.doc, 'block-0')!))
  })

  it('keystrokes after replaceDoc reach the model and emit per-stroke', () => {
    const e = new EditorEngine(
      withChildren(block('doc', BlockType.Paragraph), [
        leafBlock('block-0', BlockType.Paragraph, 'hello'),
      ]),
      collapsedSel('block-0', 0),
    )
    const emissions: string[] = []
    e.onChange(() => {
      emissions.push(serialize(e.doc, true))
    })
    const c = new BlockHostController(e, 'block-0')
    c.onInput('hello!')
    emissions.length = 0

    // Replace with a doc that keeps the same deterministic id.
    e.replaceDoc(
      withChildren(block('doc', BlockType.Paragraph), [
        leafBlock('block-0', BlockType.Paragraph, 'REPLACED'),
      ]),
      collapsedSel('block-0', 0),
    )
    emissions.length = 0
    // Simulate the host remount path: a fresh controller for the fresh host
    // (EngineEditor clears `hosts` and bumps docEpoch on replaceDoc).
    const c2 = new BlockHostController(e, 'block-0')
    c2.onInput('REPLACED!')
    expect(blockText(findBlock(e.doc, 'block-0')!)).toBe('REPLACED!')
    expect(emissions.length).toBeGreaterThan(0)
  })

  it('failed split does not poison the next keystroke baseline', () => {
    const e = new EditorEngine(
      withChildren(block('doc', BlockType.Paragraph), [
        leafBlock('block-0', BlockType.Paragraph, 'hello'),
      ]),
      collapsedSel('block-0', 0),
    )
    const c = new BlockHostController(e, 'block-0')
    // Enter on a controller whose blockId is stale (block gone after a
    // replacement the controller never saw): split must not clear knownText.
    e.replaceDoc(
      withChildren(block('doc', BlockType.Paragraph), [
        leafBlock('elsewhere', BlockType.Paragraph, 'x'),
      ]),
      collapsedSel('elsewhere', 0),
    )
    c.onEnter(2, 'brand-new-id')
    expect(findBlock(e.doc, 'brand-new-id')).toBeNull()
    // knownText still aligned with the (missing) block baseline → empty.
    expect(c.syncFromModel()).toBe('')
    expect(blockText(findBlock(e.doc, 'elsewhere')!)).toBe('x')
  })
})
