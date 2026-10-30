// Undo wiring tests (plan 028 P0T1) — the headless half of Ctrl+Z/Y: the
// keydown → history-action routing table, and the post-hop host re-sync
// (every cached host's knownText realigns with the restored tree — a stale
// knownText would baseline the next diffToOp against ghost text). The Vue
// keydown branch, the IME passthrough, and the focused-face remount are
// e2e-pinned (demo/e2e/undo.spec.ts).

import { describe, expect, it } from 'vitest'
import { parse_blocks } from '../../parser/markdown-parser'
import { blockText, findBlock } from '../../parser/block-model'
import { EditorEngine } from '../engine/editor-engine'
import { BlockHostController } from '../engine/host-controller'
import { historyActionOf, runHistory } from '../engine/undo-wiring'

type KeyFields = Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'key'>

function key(e: Partial<KeyFields>): KeyFields {
  return { ctrlKey: false, metaKey: false, shiftKey: false, key: '', ...e }
}

describe('historyActionOf routing', () => {
  it('Ctrl/Cmd+Z → undo; Shift variant and Ctrl/Cmd+Y → redo', () => {
    expect(historyActionOf(key({ ctrlKey: true, key: 'z' }))).toBe('undo')
    expect(historyActionOf(key({ metaKey: true, key: 'z' }))).toBe('undo')
    // caps-lock Z (uppercase without shift) is still undo
    expect(historyActionOf(key({ ctrlKey: true, key: 'Z' }))).toBe('undo')
    expect(historyActionOf(key({ ctrlKey: true, shiftKey: true, key: 'Z' }))).toBe('redo')
    expect(historyActionOf(key({ ctrlKey: true, shiftKey: true, key: 'z' }))).toBe('redo')
    expect(historyActionOf(key({ ctrlKey: true, key: 'y' }))).toBe('redo')
    expect(historyActionOf(key({ metaKey: true, key: 'y' }))).toBe('redo')
  })

  it('everything else passes through (null)', () => {
    expect(historyActionOf(key({ key: 'z' }))).toBeNull()
    expect(historyActionOf(key({ shiftKey: true, key: 'Z' }))).toBeNull()
    expect(historyActionOf(key({ ctrlKey: true, key: 'b' }))).toBeNull()
    expect(historyActionOf(key({ metaKey: true, key: 'k' }))).toBeNull()
    expect(historyActionOf(key({ ctrlKey: true, key: 'End' }))).toBeNull()
    expect(historyActionOf(key({ ctrlKey: true, key: 'y', shiftKey: true }))).toBe('redo') // shift+y degenerates to redo
  })
})

describe('runHistory host re-sync', () => {
  function twoBlockEngine() {
    const doc = parse_blocks('alpha\n\nbeta', true)
    const engine = new EditorEngine(doc)
    const ids = doc.children.map((n) => n.id)
    const hosts = ids.map((id) => new BlockHostController(engine, id))
    return { engine, ids, hosts }
  }

  it('undo restores the tree and re-syncs every cached host knownText', () => {
    const { engine, ids, hosts } = twoBlockEngine()
    hosts[0].onInput('alpha!')
    hosts[1].onInput('beta!')
    expect(runHistory(engine, hosts, 'undo')).toBe(true)
    expect(blockText(findBlock(engine.doc, ids[1])!)).toBe('beta')
    // the edited-then-undone host follows the restored tree; the untouched
    // host keeps its (still-current) text
    expect(hosts[1].text).toBe('beta')
    expect(hosts[0].text).toBe('alpha!')
    expect(runHistory(engine, hosts, 'undo')).toBe(true)
    expect(blockText(findBlock(engine.doc, ids[0])!)).toBe('alpha')
    expect(hosts[0].text).toBe('alpha')
  })

  it('redo replays the step and hosts follow', () => {
    const { engine, ids, hosts } = twoBlockEngine()
    hosts[1].onInput('beta!')
    expect(runHistory(engine, hosts, 'undo')).toBe(true)
    expect(runHistory(engine, hosts, 'redo')).toBe(true)
    expect(blockText(findBlock(engine.doc, ids[1])!)).toBe('beta!')
    expect(hosts[1].text).toBe('beta!')
  })

  it('an empty history stack returns false and touches nothing', () => {
    const { engine, hosts } = twoBlockEngine()
    expect(runHistory(engine, hosts, 'undo')).toBe(false)
    expect(runHistory(engine, hosts, 'redo')).toBe(false)
    expect(hosts[0].text).toBe('alpha')
    expect(hosts[1].text).toBe('beta')
  })
})
