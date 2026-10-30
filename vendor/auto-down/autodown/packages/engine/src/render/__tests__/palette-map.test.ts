// Palette map + panel registry tests (plan 017 Phase 2): the generated
// mapping is total, the vocabulary matches PANEL-ALIGNMENT.md, extension
// slots are pluggable and degrade when unregistered.

import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import {
  builtinPanelKinds,
  extensionPanelKinds,
  isExtensionPanel,
  panelHeading,
  panelOfBlock,
} from '../palette-map.generated'
import {
  clearPanelRegistry,
  registerPanel,
  specForNode,
  unregisterPanel,
} from '../panel-registry'
import { renderNodes } from '../render-node'

async function renderBlock(node: any): Promise<string> {
  const app = createSSRApp({ render: () => h('div', renderNodes([node], true)) })
  return renderToString(app)
}

describe('palette map (auto/palette_map.at)', () => {
  it('maps builtin block types to the aligned panel vocabulary', () => {
    expect(panelOfBlock('paragraph').kind).toBe('Text')
    expect(panelOfBlock('text').kind).toBe('Text')
    expect(panelOfBlock('thematic_break').kind).toBe('Separator')
    expect(panelOfBlock('code_block').kind).toBe('Codeblock')
    expect(panelOfBlock('blockquote').kind).toBe('Quote')
    expect(panelOfBlock('list').kind).toBe('List')
    expect(panelOfBlock('table').kind).toBe('Table')
  })

  it('records the registry counterparts that exist today', () => {
    expect(panelOfBlock('paragraph').registry).toBe('Text')
    expect(panelOfBlock('thematic_break').registry).toBe('Separator')
    expect(panelOfBlock('mermaid').registry).toBe('Mermaid')
    // plan 450 (auto-lang) registered the panel family — names now resolve
    expect(panelOfBlock('heading').registry).toBe('Heading')
    expect(panelOfBlock('code_block').registry).toBe('Codeblock')
    expect(panelOfBlock('list').registry).toBe('List')
    expect(panelOfBlock('table').registry).toBe('Table')
  })

  it('is total: unknown types degrade to the Unknown panel', () => {
    expect(panelOfBlock('no_such_block').kind).toBe('Unknown')
    expect(panelOfBlock('no_such_block').class_token).toBe('unknown-node')
  })

  it('splits headings into H1..H6 with level clamping', () => {
    expect(panelHeading(2).kind).toBe('H2')
    expect(panelHeading(2).tag).toBe('h2')
    expect(panelHeading(0).kind).toBe('H1')
    expect(panelHeading(9).kind).toBe('H6')
    expect(specForNode({ type: 'heading', level: 3 }).kind).toBe('H3')
  })

  it('keeps builtin and extension vocabularies disjoint', () => {
    for (const kind of builtinPanelKinds()) expect(isExtensionPanel(kind)).toBe(false)
    for (const kind of extensionPanelKinds()) expect(isExtensionPanel(kind)).toBe(true)
  })
})

describe('panel registry (plan 017 Phase 2)', () => {
  it('extension panels are consumer-pluggable and degrade when absent', async () => {
    // plan 030: Callout gained a builtin renderer — the degrade slot is
    // exercised through a still-unregistered extension kind (query)
    const node = { type: 'query', children: [] }
    // unregistered extension slot -> degraded unknown-node
    const degraded = await renderBlock(node)
    expect(degraded).toContain('unknown-node')

    registerPanel('Query', ({ renderInlineChildren, node: n, final }) =>
      h('aside', { class: 'query-node' }, renderInlineChildren(n.children, final))
    )
    try {
      const custom = await renderBlock(node)
      expect(custom).toContain('query-node')
      expect(custom).toContain('data-node-type="query"')
      expect(custom).not.toContain('unknown-node')
    } finally {
      unregisterPanel('Query')
    }

    // back to degraded after unregister
    expect(await renderBlock(node)).toContain('unknown-node')
  })

  it('callout renders through its builtin panel since plan 030', async () => {
    const html = await renderBlock({ type: 'callout', language: 'note', title: 'T', children: [] })
    expect(html).toContain('callout-node')
    expect(html).toContain('data-callout-type="note"')
    expect(html).not.toContain('unknown-node')
  })

  it('custom registration overrides a builtin panel renderer', async () => {
    registerPanel('Separator', () => h('hr', { class: 'my-separator' }))
    try {
      const html = await renderBlock({ type: 'thematic_break' })
      expect(html).toContain('my-separator')
      expect(html).not.toContain('hr-node')
    } finally {
      clearPanelRegistry()
    }
    expect(await renderBlock({ type: 'thematic_break' })).toContain('hr-node')
  })
})
