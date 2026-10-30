// Parity test: generated (Auto -> TS) vs legacy hand-written implementation
// of the streaming document segmentation (plan 008, Phase 1 acceptance).
//
// Both modules keep their own stickyPropsCache module state; every scan below
// feeds the SAME input sequence to both, so the caches must also evolve
// identically (that is the point of the streaming-prefix scans).

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildSegments as legacyBuildSegments } from './legacy-streaming'
import { buildSegments } from '../streaming.generated'

const here = dirname(fileURLToPath(import.meta.url))

/** Assert generated === legacy on one input, with a compact diff context. */
function expectParity(input: string, note = '') {
  const fromGenerated = buildSegments(input)
  const fromLegacy = legacyBuildSegments(input)
  expect(fromGenerated, note || JSON.stringify(input.slice(0, 80))).toStrictEqual(fromLegacy)
  return fromGenerated
}

/** Feed every character prefix of `text` to both implementations. */
function scanPrefixes(text: string, note: string) {
  for (let end = 0; end <= text.length; end++) {
    const prefix = text.slice(0, end)
    const fromGenerated = buildSegments(prefix)
    const fromLegacy = legacyBuildSegments(prefix)
    expect(
      fromGenerated,
      `${note} prefix len=${end}: ${JSON.stringify(prefix.slice(-30))}`
    ).toStrictEqual(fromLegacy)
  }
}

describe('buildSegments parity — directed cases', () => {
  it('empty and plain text', () => {
    expect(buildSegments('')).toStrictEqual([])
    expectParity('plain text, no fences')
    expectParity('```json\n', 'bare open fence, no content')
  })

  it('closed component block becomes a final component segment', () => {
    const segs = expectParity(
      'before\n```json\n{"type": "table", "columns": ["a", "b"], "rows": [{"a": 1, "b": 2}]}\n```\nafter'
    )
    expect(segs).toHaveLength(3)
    expect(segs[0]).toEqual({ type: 'markdown', text: 'before\n' })
    expect(segs[1]).toEqual({
      type: 'component',
      componentType: 'table',
      props: { columns: ['a', 'b'], rows: [{ a: 1, b: 2 }] },
      final: true,
    })
    expect(segs[2]).toEqual({ type: 'markdown', text: '\nafter' })
  })

  it('unclosed block with repairable JSON renders non-final component', () => {
    const segs = expectParity('```\nintro\n```json\n{"type": "table", "columns": ["a"')
    const comp = segs.find((s) => s.type === 'component') as any
    expect(comp.componentType).toBe('table')
    expect(comp.final).toBe(false)
    // repair completes the object: columns value survived
    expect(comp.props.columns).toEqual(['a'])
  })

  it('partial "type" value with closing quote is prefix-matched to component', () => {
    // the closing quote of the type value must have arrived for the
    // "type"\s*:\s*"([^"]*)" pattern to match at all
    const unclosed = expectParity('```json\n{"type": "tabl')
    expect(unclosed[0].type).toBe('markdown')

    const closed = expectParity('```json\n{"type": "tabl"')
    expect(closed[0].type).toBe('component')
    expect((closed[0] as any).componentType).toBe('table')
  })

  it('unrecognized type falls back to markdown fence', () => {
    const segs = expectParity('```json\n{"type": "chart", "x": 1}\n```')
    expect(segs).toEqual([{ type: 'markdown', text: '```json\n{"type": "chart", "x": 1}\n```' }])
  })

  it('valid JSON that is not a component falls back to markdown', () => {
    expectParity('```json\n{"foo": 1}\n```')
    expectParity('```json\n[1, 2, 3]\n```')
    expectParity('```json\nnull\n```')
    expectParity('```json\n0\n```')
  })

  it('multiple blocks with interleaved markdown', () => {
    expectParity(
      'a\n```json\n{"type": "table", "columns": []}\n```\nb\n```json\n{"type": "table", "columns": ["z"]}\n```\nc'
    )
  })

  it('escaped quotes inside JSON strings', () => {
    expectParity(
      '```json\n{"type": "table", "columns": ["a\\"b", "c"]}\n```'
    )
  })

  it('mismatched closing brackets do not pop the stack', () => {
    expectParity('```json\n{"rows": [1, 2]}\n```')
    expectParity('```json\n{"a": [1, {"b": ]\n```')
  })

  it('falsy repaired values on the hinted path (sticky/truthiness parity)', () => {
    // 0 / "" / false as block content: hinted type absent -> markdown;
    // with a hinted type but falsy value the legacy truthiness check skips
    // the cache write — generated must match via isTruthy.
    expectParity('```json\n{"type": "table", "rows": 0')
    expectParity('```json\n{"type": "table", "rows": ""')
    expectParity('```json\n{"type": "table", "rows": false')
  })
})

describe('buildSegments parity — streaming prefix scans', () => {
  const fixtures = [
    'edge-blocks.md',
    'empty.md',
    'plan-report.md',
    'spec-overview.md',
    'streaming-prefix.md',
  ] as const

  for (const name of fixtures) {
    it(`musk fixture scan: ${name}`, () => {
      const text = readFileSync(join(here, 'fixtures', name), 'utf8')
      scanPrefixes(text, name)
    })
  }

  it('synthetic stream with a table component block', () => {
    const text =
      '# Header\n\nparagraph with `code`.\n\n' +
      '```json\n{"type": "table", "columns": ["col a", "col b"], ' +
      '"rows": [{"col a": 1, "col b": "x"}, {"col a": 2, "col b": null}]}\n' +
      '```\n\ntrailing text'
    scanPrefixes(text, 'table-stream')
  })

  it('synthetic stream with two component blocks and a non-component block', () => {
    const text =
      'intro\n\n```json\n{"type": "table", "columns": ["a"]}\n```\n\n' +
      '```json\n{"type": "unknown", "k": "v"}\n```\n\n' +
      '```json\n{"type": "table", "columns": ["b"], "rows": []}\n```'
    scanPrefixes(text, 'multi-block-stream')
  })

  it('sticky cache: value flips valid -> invalid -> valid keeps earlier props', () => {
    // Same block position, evolving content. When repair fails, the sticky
    // cache from the earlier successful parse must be reused by both sides.
    const steps = [
      '```json\n{"type": "table", "columns": ["a"], "x": 1}\n```',
      '```json\n{"type": "table", "columns": ["a"], "x": tru',
      '```json\n{"type": "table", "columns": ["a"], "x": true}\n```',
    ]
    for (const step of steps) {
      const fromGenerated = buildSegments(step)
      const fromLegacy = legacyBuildSegments(step)
      expect(fromGenerated).toStrictEqual(fromLegacy)
    }
  })
})

// normalizeTableProps retired with streaming-table.generated.ts (plan 037
// T5): its nullish-normalization semantics moved into the table family
// widget's ext bridge (streamHeader/streamBody — `?? []`) and are pinned by
// src/editor/__tests__/table-block-widget.test.ts (the 待澄清 #1 归并).
