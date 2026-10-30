// EmbedBlockWidget (plan 038 T5): the embed family's view/stream widget —
// absorbs the BlockEmbedNodeView with the src-semantics ruling (待澄清③):
// title/blockId derive from attrs.src (parseEmbedSrc three forms), the
// siyuan-era attrs.raw/title/blockId reads retired. The loader fires only
// on final AND only for an anchor src (jade's loader is block-id keyed);
// a page-level reference renders its label face without loader work.

// @vitest-environment happy-dom

import { createApp, createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { afterEach, describe, expect, it } from 'vitest'
import { BlockType, Value, attrSet, block } from '../../parser/block-model'
import EmbedBlockWidget from '../components/EmbedBlockWidget.vue'
import { parseEmbedSrc, embedSrcOf, embedTitle, embedBlockId } from '../ext/embed_block_widget_ext'
import { setDataLoaders, type EmbeddedBlock } from '../engine/data-loaders'

function embedNode(src: string) {
  const n = block('e1', BlockType.BlockEmbed)
  n.attrs = attrSet(n.attrs, 'src', Value.Str(src))
  return n
}

async function ssr(props: Record<string, unknown>): Promise<string> {
  const app = createSSRApp({ render: () => h(EmbedBlockWidget as any, props) })
  return (await renderToString(app)).replace(/<!--.*?-->/g, '')
}

function mountHtml(props: Record<string, unknown>): Promise<string> {
  return new Promise((resolve) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp({ render: () => h(EmbedBlockWidget as any, props) })
    app.mount(host)
    setTimeout(() => {
      const html = host.innerHTML
      app.unmount()
      host.remove()
      resolve(html)
    }, 20)
  })
}

afterEach(() => {
  setDataLoaders({})
})

describe('parseEmbedSrc — the three-form ruling (待澄清③)', () => {
  it('"title": a page-level reference (blockId null)', () => {
    expect(parseEmbedSrc('../other.ad')).toEqual({ title: '../other.ad', blockId: null })
  })

  it('"title#^id": a block anchor inside a page (bare id)', () => {
    expect(parseEmbedSrc('../other.ad#^abc123')).toEqual({ title: '../other.ad', blockId: 'abc123' })
  })

  it('"^id": a current-page block anchor (empty title — context completes)', () => {
    expect(parseEmbedSrc('^abc123')).toEqual({ title: '', blockId: 'abc123' })
  })

  it('edge shapes: empty src is the empty page-level form; dangling hashes degrade', () => {
    expect(parseEmbedSrc('')).toEqual({ title: '', blockId: null })
    expect(parseEmbedSrc('#^')).toEqual({ title: '', blockId: null })
    expect(parseEmbedSrc('^')).toEqual({ title: '', blockId: null })
  })

  it('the node readers thread attrs.src through the parse', () => {
    const n = embedNode('docs/guide.md#^anchor-9')
    expect(embedSrcOf(n)).toBe('docs/guide.md#^anchor-9')
    expect(embedTitle(n)).toBe('docs/guide.md')
    expect(embedBlockId(n)).toBe('anchor-9')
  })
})

describe('SSR chrome (Init-less first paint)', () => {
  it('root: autodown-block-embed + data-title, no block-map pollution', async () => {
    const html = await ssr({ mode: 'view', node: embedNode('../other.ad'), ctx: null, final: true })
    expect(html).toContain('class="autodown-block-embed"')
    expect(html).toContain('data-title="../other.ad"')
    // the derived anchor id never lands on the root (siyuan shape retired;
    // the editor's [data-block-id] namespace stays model-blocks-only)
    expect(html).not.toContain('data-block-id')
    expect(html).not.toContain('data-node-view-wrapper')
  })

  it('a page-level reference renders its label face without loader work', async () => {
    const html = await ssr({ mode: 'view', node: embedNode('../other.ad'), ctx: null, final: true })
    expect(html).toContain('embed-header')
    expect(html).toContain('../other.ad')
  })
})

describe('mounted three-state load (final=true, anchor srcs, mock loader)', () => {
  it('resolve with a block: header label + content', async () => {
    setDataLoaders({
      loadBlock: async (id): Promise<EmbeddedBlock | null> => ({ title: 'Guide', content: `body of ${id}` }),
    })
    const html = await mountHtml({ mode: 'view', node: embedNode('docs/guide.md#^anchor-9'), ctx: null, final: true })
    expect(html).toContain('embed-content')
    expect(html).toContain('body of anchor-9')
    // display label: title#blockId (the old `${title}#${blockId}` shape)
    expect(html).toContain('docs/guide.md#anchor-9')
    expect(html).not.toContain('embed-state')
  })

  it('resolve null: Block not found', async () => {
    setDataLoaders({ loadBlock: async (): Promise<EmbeddedBlock | null> => null })
    const html = await mountHtml({ mode: 'view', node: embedNode('^nope'), ctx: null, final: true })
    expect(html).toContain('embed-error')
    expect(html).toContain('Block not found')
  })

  it('reject: the error state with the thrown message', async () => {
    setDataLoaders({
      loadBlock: async () => {
        throw new Error('index unavailable')
      },
    })
    const html = await mountHtml({ mode: 'view', node: embedNode('^x'), ctx: null, final: true })
    expect(html).toContain('embed-error')
    expect(html).toContain('index unavailable')
  })

  it('unconfigured loader on an anchor src: the placeholder error state', async () => {
    const html = await mountHtml({ mode: 'view', node: embedNode('^x'), ctx: null, final: true })
    expect(html).toContain('No block loader configured')
  })

  it('the pure-anchor label is the bare id; the page-in-page label is title#id', async () => {
    setDataLoaders({
      loadBlock: async (id): Promise<EmbeddedBlock | null> => ({ content: id }),
    })
    const html = await mountHtml({ mode: 'view', node: embedNode('^solo-anchor'), ctx: null, final: true })
    expect(html).toContain('solo-anchor')
    expect(html).not.toContain('#solo-anchor')
  })
})

describe('final gating + loader discipline (032 ruling A)', () => {
  it('final=false renders the loading skeleton without loader work', async () => {
    let called = 0
    setDataLoaders({
      loadBlock: async (id): Promise<EmbeddedBlock | null> => {
        called++
        return { content: id }
      },
    })
    const html = await mountHtml({ mode: 'stream', node: embedNode('^anchor-1'), ctx: null, final: false })
    expect(html).toContain('embed-state')
    expect(html).toContain('Loading ')
    expect(called).toBe(0)
  })

  it('a page-level src never calls the loader (block-id keyed channel)', async () => {
    let called = 0
    setDataLoaders({
      loadBlock: async (id): Promise<EmbeddedBlock | null> => {
        called++
        return { content: id }
      },
    })
    const html = await mountHtml({ mode: 'view', node: embedNode('../other.ad'), ctx: null, final: true })
    expect(html).toContain('../other.ad')
    expect(html).not.toContain('embed-state')
    expect(called).toBe(0)
  })
})
