// artifactFor (plan 031 T7): the persistable artifact contract — math ->
// katex HTML, mermaid -> SVG, errors as data. renderKatexPreview /
// renderMermaidPreview themselves stay pinned by the node-view tests; what
// is pinned HERE is the artifact projection (kind mapping + error
// passthrough), the seam the artifact store (T8) hooks into.

import { describe, expect, it } from 'vitest'
import { artifactFor } from '../preview'

describe('artifactFor (RenderedArtifact contract)', () => {
  it('math produces a katex html artifact', async () => {
    const a = await artifactFor('MathBlock', 'e = mc^2')
    expect(a.kind).toBe('html')
    expect(a.error).toBe('')
    expect(a.body).toContain('katex')
  })

  it('math error passthrough: invalid source -> empty body, message as data', async () => {
    const a = await artifactFor('MathBlock', '\\frac{1{')
    expect(a.kind).toBe('html')
    expect(a.body).toBe('')
    expect(a.error).not.toBe('')
  })

  it('mermaid produces an svg-kind artifact (body/error as the env settles them)', async () => {
    const a = await artifactFor('Mermaid', 'graph TD; A-->B;')
    expect(a.kind).toBe('svg')
    // mermaid needs a DOM; under the node test runtime it may settle either
    // way — but never both: success carries the svg, failure carries the
    // message as data (the preview-bridge idiom).
    expect(a.error === '' || a.body === '').toBe(true)
    if (a.error === '') expect(a.body).toContain('<svg')
  })

  it('empty math source still renders (katex tolerates it) with html kind', async () => {
    const a = await artifactFor('MathBlock', '')
    expect(a.kind).toBe('html')
  })
})
