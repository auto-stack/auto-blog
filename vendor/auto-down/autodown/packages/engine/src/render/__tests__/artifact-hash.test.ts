// Rendered-artifact cache key tests (plan 031 D6): the artifactHash key
// shape + invariants, and the cross-target parity golden generator — this
// file rewrites the golden consumed by the rust crate's
// tests/artifact_hash_parity.rs on every engine `pnpm test`; green on both
// sides = the TS and rust emissions of auto/render/artifact_hash.at have
// not drifted (same corpus, same keys).

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { artifactHash } from '../artifact-key'

// Probe corpus — keep in lockstep with rust tests/artifact_hash_parity.rs
// (the golden itself enforces it: adding a probe here without regenerating
// fails there). ≥8 cases with CJK / astral emoji / multiline / empty /
// backslash-heavy sources — the unit sequences where UTF-16 vs scalar
// divergence would show up if either side drifted.
const CORPUS: ReadonlyArray<readonly [string, string]> = [
  ['MathBlock', 'e = mc^2'],
  ['MathBlock', '\\frac{1}{2} + \\sqrt{x}'],
  ['MathBlock', ''],
  ['Mermaid', 'graph TD; A-->B;'],
  ['Mermaid', 'graph LR;\n A[开始] --> B[结束];\n B --> C{判定?};\n'],
  // astral emoji = surrogate pairs (UTF-16 len 2 per emoji, 1 scalar — the
  // sharpest divergence probe)
  ['Mermaid', 'flowchart TD\nA[😀] --> B[🎉]\n'],
  ['Mermaid', 'sequenceDiagram\nparticipant 中方\n中方->>美方: 你好 world 🌏\n'],
  ['MathBlock', '\\sum_{i=1}^{n} a_i ≠ 0 ⇒ ∀ε>0'],
  // same source under the other kind — kind mixing probe
  ['MathBlock', 'graph TD; A-->B;'],
  ['Mermaid', 'graph TD;\n A["quoted \\"label\\""]-->B;\n'],
]

const KEY_RE = /^(MathBlock|Mermaid):(\d+):[0-9a-f]{8}$/

describe('artifactHash key shape + invariants', () => {
  it('produces kind:<utf16-len>:<8-hex> keys', () => {
    expect(artifactHash('MathBlock', 'e = mc^2')).toMatch(KEY_RE)
    expect(artifactHash('Mermaid', 'graph TD; A-->B;')).toMatch(KEY_RE)
    expect(artifactHash('MathBlock', '')).toMatch(KEY_RE)
  })

  it('len is the UTF-16 length of the source (astral emoji = 2 units each)', () => {
    expect(artifactHash('Mermaid', 'A😀B').split(':')[1]).toBe('4')
    expect(artifactHash('MathBlock', '').split(':')[1]).toBe('0')
    expect(artifactHash('MathBlock', '中文三字').split(':')[1]).toBe('4')
  })

  it('is deterministic and kind-mixed (same source, different kind -> different key)', () => {
    const a1 = artifactHash('Mermaid', 'graph TD; A-->B;')
    const a2 = artifactHash('Mermaid', 'graph TD; A-->B;')
    expect(a1).toBe(a2)
    const math = artifactHash('MathBlock', 'graph TD; A-->B;')
    expect(math).not.toBe(a1)
  })

  it('different sources produce different keys across the corpus', () => {
    const keys = new Set<string>()
    for (const [k, s] of CORPUS) keys.add(artifactHash(k, s))
    // the corpus has one intentional same-source/different-kind pair, so
    // unique (kind, source) pairs = CORPUS.length
    expect(keys.size).toBe(CORPUS.length)
  })

  it('pins fixed hex on anchor corpus entries (cross-run stability)', () => {
    // If these change, the hash algorithm changed — the rust golden and
    // every persisted cache key change with it; update both consciously.
    expect(artifactHash('MathBlock', 'e = mc^2')).toBe('MathBlock:8:079c89ac')
    expect(artifactHash('Mermaid', 'graph TD; A-->B;')).toBe('Mermaid:16:061b15d9')
  })
})

describe('artifact-hash TS↔Rust parity golden (对拍)', () => {
  it('rewrites the golden and keeps it sane', () => {
    const lines: string[] = []
    for (let i = 0; i < CORPUS.length; i++) {
      const [kind, source] = CORPUS[i]
      lines.push(`${i} ${artifactHash(kind, source)}`)
    }

    // Invariants — a broken hash must never reach the golden file.
    expect(lines).toHaveLength(CORPUS.length)
    for (const l of lines) {
      const [idx, key] = l.split(' ')
      expect(idx).toMatch(/^\d+$/)
      expect(key).toMatch(KEY_RE)
    }

    const goldenPath = join(
      dirname(fileURLToPath(import.meta.url)),
      '../../../rust/tests/golden/artifact-hash.golden.txt'
    )
    const header = [
      '# artifact-hash cross-target parity golden (plan 031 D5).',
      '# Rewritten by engine src/render/__tests__/artifact-hash.test.ts on',
      '# every `pnpm test`; asserted by rust tests/artifact_hash_parity.rs.',
      '# Format: <corpus index> <kind>:<utf16 len>:<8-hex FNV-1a>.',
      '# The corpus lives in BOTH tests (kept in lockstep by the golden:',
      '# adding an entry there without regenerating fails here and vice versa).',
      '# Do not edit.',
      '',
    ]
    writeFileSync(goldenPath, [...header, ...lines, ''].join('\n'))
  })
})
