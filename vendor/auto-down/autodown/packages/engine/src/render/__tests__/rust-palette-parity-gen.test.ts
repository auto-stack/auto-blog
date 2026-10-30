// Palette-map cross-target parity golden generator (plan 019 Phase 1 /
// auto-lang plan-450 批次五): rewrites the golden projection consumed by the
// rust crate's tests/palette_parity.rs on every engine `pnpm test`, then
// asserts a few invariants so a broken generation cannot write a "valid"
// golden. The rust side (packages/engine/rust/src/palette_map.rs — a2r emission
// of the same auto/render/palette_map.at) asserts this file byte for byte;
// green on both sides = the two emissions have not drifted.

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
    builtinPanelKinds,
    extensionPanelKinds,
    isExtensionPanel,
    panelHeading,
    panelOfBlock,
} from '../palette-map.generated'

// Probe sets — keep in lockstep with rust tests/palette_parity.rs (the golden
// itself enforces it: adding a probe here without regenerating fails there).
const BLOCK_TYPES = [
    'paragraph',
    'text',
    'heading',
    'thematic_break',
    'code_block',
    'blockquote',
    'list',
    'table',
    'callout',
    'details',
    'math_block',
    'mermaid',
    'query',
    'embed',
    'no_such_block',
    'future_panel',
]
const LEVELS = [-2, 0, 1, 2, 3, 4, 5, 6, 7, 100]
const EXTRA_KINDS = ['Unknown', 'NotAKind']

function projection(): string[] {
    const lines: string[] = []
    for (const bt of BLOCK_TYPES) {
        const s = panelOfBlock(bt)
        lines.push(`panelOfBlock ${[bt, s.kind, s.tag, s.class_token, s.registry, s.extension].join(' ')}`)
    }
    for (const l of LEVELS) {
        lines.push(`panelHeading ${l} ${panelHeading(l).kind}`)
    }
    const kinds = [...EXTRA_KINDS, ...builtinPanelKinds(), ...extensionPanelKinds()]
    for (const k of kinds) {
        lines.push(`isExtensionPanel ${k} ${isExtensionPanel(k)}`)
    }
    lines.push(`builtinPanelKinds ${builtinPanelKinds().join(',')}`)
    lines.push(`extensionPanelKinds ${extensionPanelKinds().join(',')}`)
    return lines
}

const goldenPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../rust/tests/golden/palette-map.golden.txt',
)

const header = [
    '# palette-map cross-target parity golden (plan 019 Phase 1 / auto-lang plan-450).',
    '# Rewritten by engine src/render/__tests__/rust-palette-parity-gen.test.ts on',
    '# every `pnpm test`; asserted by rust tests/palette_parity.rs. Do not edit.',
    '',
]

describe('palette-map TS↔Rust parity golden (对拍)', () => {
    it('rewrites the golden and keeps it sane', () => {
        const lines = projection()

        // Invariants — a broken map must never reach the golden file.
        expect(lines.filter((l) => l.startsWith('panelOfBlock'))).toHaveLength(BLOCK_TYPES.length)
        expect(panelOfBlock('no_such_block').kind).toBe('Unknown')
        expect(panelHeading(-2).kind).toBe('H1')
        expect(panelHeading(100).kind).toBe('H6')
        for (const k of builtinPanelKinds()) expect(isExtensionPanel(k)).toBe(false)

        writeFileSync(goldenPath, [...header, ...lines, ''].join('\n'))
    })
})
