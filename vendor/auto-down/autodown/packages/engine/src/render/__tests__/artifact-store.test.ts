// Artifact store registration (plan 031 T8): enableArtifactStore + the
// recordArtifact put choke point. Pinned here: put fires exactly once per
// SUCCESSFUL final render with the double-source artifactHash key shape;
// failures never put; an unregistered host observes zero side effects
// (pre-031 behavior byte for byte); clearOptionalCapabilities detaches the
// store; the node-view bridges (the panel/streaming final render path)
// land artifacts through the same choke point.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { artifactFor, recordArtifact, type RenderedArtifact } from '../preview'
import {
  clearOptionalCapabilities,
  enableArtifactStore,
  getArtifactStore,
  type ArtifactStore,
} from '../optional-capabilities'
import { artifactHash } from '../artifact-key'
// the deployed family-widget bridge (editor side of the final-render put —
// the math render bridge moved from node_view_ext in plan 033 T3)
import { renderMathBlockPreview } from '../../editor/ext/math_block_widget_ext'

function spyStore(): ArtifactStore & { puts: Array<[string, RenderedArtifact]> } {
  const puts: Array<[string, RenderedArtifact]> = []
  const map = new Map<string, RenderedArtifact>()
  return {
    puts,
    get: (key) => map.get(key),
    put: (key, artifact) => {
      puts.push([key, artifact])
      map.set(key, artifact)
    },
  }
}

afterEach(() => {
  clearOptionalCapabilities()
})

describe('enableArtifactStore (D6 contract)', () => {
  it('unregistered: renders succeed with zero side effects', async () => {
    expect(getArtifactStore()).toBeNull()
    const a = await artifactFor('MathBlock', 'e = mc^2')
    expect(a.error).toBe('') // the render itself is unaffected
    expect(getArtifactStore()).toBeNull()
    // recordArtifact direct: no-op, no throw
    expect(() => recordArtifact('MathBlock', 'e = mc^2', a)).not.toThrow()
  })

  it('registered: one successful final render -> exactly one put, key shape pinned', async () => {
    const store = spyStore()
    enableArtifactStore(store)
    const a = await artifactFor('MathBlock', 'e = mc^2')
    expect(a.error).toBe('')
    expect(store.puts).toHaveLength(1)
    const [key, artifact] = store.puts[0]
    expect(key).toBe(artifactHash('MathBlock', 'e = mc^2'))
    expect(key).toMatch(/^MathBlock:\d+:[0-9a-f]{8}$/)
    expect(artifact.kind).toBe('html')
    expect(artifact.body).toContain('katex')
  })

  it('failed renders never put', async () => {
    const store = spyStore()
    enableArtifactStore(store)
    const a = await artifactFor('MathBlock', '\\frac{1{')
    expect(a.error).not.toBe('')
    expect(store.puts).toHaveLength(0)
  })

  it('idempotent keys: repeated final renders rewrite the same key harmlessly', async () => {
    const store = spyStore()
    enableArtifactStore(store)
    await artifactFor('MathBlock', 'e = mc^2')
    await artifactFor('MathBlock', 'e = mc^2')
    expect(store.puts).toHaveLength(2)
    expect(store.puts[0][0]).toBe(store.puts[1][0])
    expect(store.get(store.puts[0][0])?.body).toContain('katex')
  })

  it('clearOptionalCapabilities detaches the store', async () => {
    const store = spyStore()
    enableArtifactStore(store)
    clearOptionalCapabilities()
    expect(getArtifactStore()).toBeNull()
    await artifactFor('MathBlock', 'e = mc^2')
    expect(store.puts).toHaveLength(0)
  })

  it('mermaid artifacts land as svg-kind under a Mermaid key on success (env-permitting)', async () => {
    const store = spyStore()
    enableArtifactStore(store)
    const a = await artifactFor('Mermaid', 'graph TD; A-->B;')
    if (a.error === '') {
      // a DOM-present runtime (browser/e2e): the svg is persisted
      expect(store.puts).toHaveLength(1)
      expect(store.puts[0][0]).toMatch(/^Mermaid:\d+:[0-9a-f]{8}$/)
      expect(store.puts[0][1].kind).toBe('svg')
    } else {
      // node runtime: mermaid needs a DOM — nothing may be persisted
      expect(store.puts).toHaveLength(0)
    }
  })
})

describe('node-view bridge final renders (the panel/streaming put site)', () => {
  it('renderMathBlockPreview records the artifact on success', () => {
    const store = spyStore()
    enableArtifactStore(store)
    const res = renderMathBlockPreview('e = mc^2')
    expect(res.error).toBe('')
    expect(store.puts).toHaveLength(1)
    expect(store.puts[0][0]).toBe(artifactHash('MathBlock', 'e = mc^2'))
  })

  it('renderMathBlockPreview failure records nothing', () => {
    const store = spyStore()
    enableArtifactStore(store)
    const res = renderMathBlockPreview('\\frac{1{')
    expect(res.error).not.toBe('')
    expect(store.puts).toHaveLength(0)
  })

  it('vi-mode double check: put is not called when unregistered (bridge no-op)', () => {
    const res = renderMathBlockPreview('e = mc^2')
    expect(res.error).toBe('')
    expect(getArtifactStore()).toBeNull()
  })
})
