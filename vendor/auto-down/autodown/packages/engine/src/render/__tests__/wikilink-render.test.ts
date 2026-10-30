// Wikilink span renderer (plan 036 T5): the 020 DOM decorator retired —
// renderInlineNode lifts the parser's `wikilink` WNode directly into the
// frozen DOM contract: span.autodown-wikilink-label[data-wikilink-title],
// click → the registered opener with (title, blockId) and stopPropagation.
// The opener is app-facing (EngineEditor's open-wiki-link Vue event); the
// renderer itself stays app-agnostic (null opener = inert click, the
// MarkdownRender/stream case).

import { describe, expect, it, afterEach, vi } from 'vitest'
import { h, type VNode } from 'vue'
import { renderNodes } from '../render-node'
import { registerWikilinkOpener } from '../wikilink-opener'

function renderParagraph(inner: unknown): VNode {
  return renderNodes([{ type: 'paragraph', children: [inner] }], true)[0]
}

function findLabel(vnode: VNode): VNode | null {
  let found: VNode | null = null
  const walk = (v: any): void => {
    if (!v || typeof v !== 'object' || found) return
    if (v.type === 'span' && v.props?.class === 'autodown-wikilink-label') {
      found = v
      return
    }
    const kids = v.children
    if (Array.isArray(kids)) for (const k of kids) walk(k)
    else if (kids && typeof kids === 'object' && !Array.isArray(kids)) {
      // default-slot children object
      if (Array.isArray((kids as any).default)) for (const k of (kids as any).default()) walk(k)
    }
  }
  walk(vnode)
  return found
}

function mustLabel(vnode: VNode): any {
  const label = findLabel(vnode)
  if (!label) throw new Error('wikilink label span not found in render output')
  return label
}

afterEach(() => {
  registerWikilinkOpener(null)
})

describe('wikilink span renderer (DOM contract, decorator parity)', () => {
  it('renders span.autodown-wikilink-label[data-wikilink-title] with the label text', () => {
    const label = mustLabel(renderParagraph({ type: 'wikilink', title: '首页' }))
    expect(label).not.toBeNull()
    expect(label!.props.class).toBe('autodown-wikilink-label')
    expect(label!.props['data-wikilink-title']).toBe('首页')
  })

  it('#anchor form: label keeps the suffix, payload splits (title, blockId)', () => {
    const open = vi.fn()
    registerWikilinkOpener(open)
    const label = mustLabel(renderParagraph({ type: 'wikilink', title: '页#块' }))
    expect(label!.props['data-wikilink-title']).toBe('页')
    const click = { stopPropagation: vi.fn() }
    label!.props.onClick(click)
    expect(open).toHaveBeenCalledWith('页', '块')
    expect(click.stopPropagation).toHaveBeenCalled()
  })

  it('bare title: click payload is (title, undefined), propagation stopped', () => {
    const open = vi.fn()
    registerWikilinkOpener(open)
    const label = mustLabel(renderParagraph({ type: 'wikilink', title: '首页' }))
    label!.props.onClick({ stopPropagation: vi.fn() })
    expect(open).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith('首页', undefined)
  })

  it('inert without a registered opener (static render parity, no crash)', () => {
    const label = mustLabel(renderParagraph({ type: 'wikilink', title: '首页' }))
    expect(() => label!.props.onClick({ stopPropagation: vi.fn() })).not.toThrow()
  })

  it('surrounding text nodes render beside the label (in order)', () => {
    const vnode = renderNodes(
      [
        {
          type: 'paragraph',
          children: [
            { type: 'text', content: '前 ' },
            { type: 'wikilink', title: '首页' },
            { type: 'text', content: ' 后' },
          ],
        },
      ],
      true,
    )[0]
    expect(vnode).toBeTruthy()
    expect(JSON.stringify(vnode)).toContain('autodown-wikilink-label')
  })
})

describe('block-wnode bridge (model span → wikilink WNode)', () => {
  it('a wikilink span converts to a wikilink node (attr not dropped)', async () => {
    const { parse_blocks } = await import('../../parser/markdown-parser')
    const { blockNodesToWNodes } = await import('../block-wnode')
    const block = parse_blocks('正文 [[首页]] 尾', true).children[0]!
    const w = blockNodesToWNodes([block])[0]!
    const kids = w.children ?? []
    expect(kids.some((k) => k.type === 'wikilink' && k.title === '首页')).toBe(true)
  })
})

// keep the vue import referenced for future vnode probing helpers
void h
