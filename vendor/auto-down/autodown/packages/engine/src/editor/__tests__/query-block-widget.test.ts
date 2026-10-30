// QueryBlockWidget (plan 038 T4): the query family's view/stream widget —
// absorbs the QueryBlockNodeView's four-state async load (loading / error /
// results / empty) with the loader read moved onto the module-level
// data-loader slot (queryRunner ext bridge) and the whole load gated on
// `final` (032 ruling A: an unclosed query stays a paragraph through the
// real pipes; a final=false mount renders the loading skeleton without
// loader work). SSR pins the chrome; happy-dom mounts drive the async
// states with mock loaders.

// @vitest-environment happy-dom

import { createApp, createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { afterEach, describe, expect, it } from 'vitest'
import { BlockType, Value, attrSet, block } from '../../parser/block-model'
import QueryBlockWidget from '../components/QueryBlockWidget.vue'
import { setDataLoaders, type QueryResultEnvelope } from '../engine/data-loaders'

function queryNode(query: string) {
  const n = block('q1', BlockType.QueryBlock)
  if (query !== '') n.attrs = attrSet(n.attrs, 'query', Value.Str(query))
  return n
}

async function ssr(props: Record<string, unknown>): Promise<string> {
  const app = createSSRApp({ render: () => h(QueryBlockWidget as any, props) })
  return (await renderToString(app)).replace(/<!--.*?-->/g, '')
}

function mountHtml(props: Record<string, unknown>): Promise<string> {
  return new Promise((resolve) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp({ render: () => h(QueryBlockWidget as any, props) })
    app.mount(host)
    // the widget's async load settles in microtasks; flush them plus a
    // paint tick before reading the DOM
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

describe('SSR chrome (Init-less first paint)', () => {
  it('root: autodown-query-block + data-query-block marker + query text header', async () => {
    const html = await ssr({ mode: 'view', node: queryNode('TAG #project'), ctx: null, final: true })
    expect(html).toContain('class="autodown-query-block"')
    expect(html).toMatch(/data-query-block(?:="")?/)
    expect(html).toContain('query-header')
    expect(html).toContain('TAG #project')
    // no node-view markers (the family root, math/mermaid precedent)
    expect(html).not.toContain('data-node-view-wrapper')
  })

  it('final=true SSR renders the empty branch (no loader work on server)', async () => {
    const html = await ssr({ mode: 'view', node: queryNode('anything'), ctx: null, final: true })
    expect(html).toContain('No results')
  })
})

describe('mounted four-state load (final=true, mock loaders)', () => {
  it('resolve with results: the .query-results chain with normalized fields', async () => {
    setDataLoaders({
      runQuery: async (): Promise<QueryResultEnvelope> => ({
        results: [
          { marker: '§', priority: 2, content: 'first row', title: 'Page A' },
          { marker: '¶', content: 'second row', page_path: 'docs/b.md' },
        ],
      }),
    })
    const html = await mountHtml({ mode: 'view', node: queryNode('TAG #project'), ctx: null, final: true })
    expect(html).toContain('class="query-results"')
    expect(html).toContain('first row')
    expect(html).toContain('second row')
    // normalizeQueryResults: source = title || page_path, priority_label = [#N]
    expect(html).toContain('Page A')
    expect(html).toContain('docs/b.md')
    expect(html).toContain('[#2]')
    expect(html).not.toContain('Loading query…')
    expect(html).not.toContain('No results')
  })

  it('resolve with an empty envelope: the empty state', async () => {
    setDataLoaders({ runQuery: async (): Promise<QueryResultEnvelope> => ({ results: [] }) })
    const html = await mountHtml({ mode: 'view', node: queryNode('nothing'), ctx: null, final: true })
    expect(html).toContain('No results')
    expect(html).not.toContain('query-results')
  })

  it('reject: the error state with the thrown message', async () => {
    setDataLoaders({
      runQuery: async () => {
        throw new Error('backend unreachable')
      },
    })
    const html = await mountHtml({ mode: 'view', node: queryNode('x'), ctx: null, final: true })
    expect(html).toContain('query-error')
    expect(html).toContain('backend unreachable')
    expect(html).not.toContain('query-results')
    expect(html).not.toContain('No results')
  })

  it('unconfigured runner: the placeholder error state', async () => {
    const html = await mountHtml({ mode: 'view', node: queryNode('x'), ctx: null, final: true })
    expect(html).toContain('No query runner configured')
  })
})

describe('final gating (032 ruling A)', () => {
  it('final=false renders the loading skeleton without loader work', async () => {
    let called = 0
    setDataLoaders({
      runQuery: async (): Promise<QueryResultEnvelope> => {
        called++
        return { results: [{ content: 'x' }] }
      },
    })
    const html = await mountHtml({ mode: 'stream', node: queryNode('TAG'), ctx: null, final: false })
    expect(html).toContain('Loading query…')
    expect(html).not.toContain('query-results')
    expect(called).toBe(0)
  })
})
