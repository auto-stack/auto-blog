// selection-adapter headless contract (plan 036 T2): the default engine
// test env has no DOM — the adapter must no-op safely (same semantics the
// old dom-marks showed headless: no host slot → false / null everywhere).

import { describe, expect, it } from 'vitest'
import { Mark } from '../../parser/block-model'
import {
  domSelectionAdapter,
  getFocusedRichHost,
  setFocusedRichHost,
  toggleMark,
} from '../engine/selection-adapter'

describe('headless (no window) contract safety', () => {
  it('window is genuinely undefined in this env', () => {
    expect(typeof window).toBe('undefined')
  })

  it('registration slot stays null; verbs and reads no-op', () => {
    setFocusedRichHost(null)
    expect(getFocusedRichHost()).toBeNull()
    expect(domSelectionAdapter.getSelection()).toBeNull()
    expect(domSelectionAdapter.isActive(Mark.Strong)).toBe(false)
    expect(domSelectionAdapter.applyMark(Mark.Strong)).toBe(false)
    expect(domSelectionAdapter.applyMark(Mark.Link, 'http://x')).toBe(false)
    expect(domSelectionAdapter.removeMark(Mark.Link)).toBe(false)
    expect(toggleMark(domSelectionAdapter, Mark.Em)).toBe(false)
  })
})
