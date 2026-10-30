// BlockComponent contract tests (plan 023 P1T2): the three-mode registry —
// resolution priority (registered component > builtin fallback), mode
// defaults (view always present; stream/edit undefined unless registered),
// canonical kind mapping, and the public export surface.

import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BlockType,
  Value,
  attrSet,
  leafBlock,
} from '../../parser/block-model'
import {
  canonicalKind,
  clearBlockComponents,
  registerBlockComponent,
  resolveBlockComponent,
  type BlockComponent,
  type BlockEditCtx,
} from '../block-component'
import * as renderExports from '../index'

async function ssr(view: (node: any, final: boolean) => any, node: any): Promise<string> {
  const app = createSSRApp({ render: () => h({ render: () => view(node, true) } as any) })
  return renderToString(app)
}

function clean(html: string): string {
  return html.replace(/<!--.*?-->/g, '')
}

afterEach(() => {
  clearBlockComponents()
})

describe('BlockComponent registry', () => {
  it('unregistered kinds fall back to the builtin view (panel pipeline), no stream/edit', async () => {
    const comp = resolveBlockComponent('Paragraph')
    expect(typeof comp.view).toBe('function')
    expect(comp.stream).toBeUndefined()
    expect(comp.edit).toBeUndefined()

    const para = leafBlock('p1', BlockType.Paragraph, 'hello world')
    const html = clean(await ssr(comp.view, para))
    expect(html).toContain('data-node-type="paragraph"')
    expect(html).toContain('hello world')
  })

  it('builtin view renders a Fence through the code panel', async () => {
    let fence = leafBlock('f1', BlockType.Fence, 'const x = 1')
    fence = { ...fence, attrs: attrSet(fence.attrs, 'language', Value.Str('js')) }
    const html = clean(await ssr(resolveBlockComponent('Fence').view, fence))
    expect(html).toContain('data-node-type="code_block"')
    expect(html).toContain('code-block-container')
    expect(html).toContain('const x = 1')
  })

  it('registered edit slot merges with the builtin view (P1T5 shape)', () => {
    const edit = (node: any, ctx: BlockEditCtx) => h('div', { class: 'fake-edit' }, ctx.blockId)
    registerBlockComponent('Fence', { edit })
    const comp = resolveBlockComponent('Fence')
    expect(comp.edit).toBe(edit)
    expect(typeof comp.view).toBe('function') // builtin view kept
    expect(comp.stream).toBeUndefined()
  })

  it('registered view/stream override the builtin', () => {
    const view = () => h('div', { class: 'custom-view' })
    const stream = () => h('div', { class: 'custom-stream' })
    registerBlockComponent('Table', { view, stream })
    const comp = resolveBlockComponent('Table')
    expect(comp.view).toBe(view)
    expect(comp.stream).toBe(stream)
  })

  it('resolve returns an independent fallback per call for unregistered kinds', () => {
    const a = resolveBlockComponent('MathBlock')
    const b = resolveBlockComponent('MathBlock')
    expect(typeof a.view).toBe('function')
    expect(typeof b.view).toBe('function')
    expect(a.edit).toBeUndefined()
  })

  it('canonicalKind normalizes render-model type strings to registry keys', () => {
    expect(canonicalKind('table')).toBe('Table')
    expect(canonicalKind('code_block')).toBe('CodeBlock')
    expect(canonicalKind('details')).toBe('Details')
    expect(canonicalKind('Fence')).toBe('Fence')
  })

  it('register/resolve both canonicalize, so streaming keys find engine registrations', () => {
    const edit = () => h('div')
    registerBlockComponent('code_block', { edit })
    expect(resolveBlockComponent('CodeBlock').edit).toBe(edit)
    expect(resolveBlockComponent('code_block').edit).toBe(edit)
  })
})

describe('export surface (src/render/index.ts)', () => {
  it('exposes the contract + registry API from @autodown/engine/render', () => {
    for (const name of [
      'registerBlockComponent',
      'resolveBlockComponent',
      'unregisterBlockComponent',
      'clearBlockComponents',
      'canonicalKind',
    ]) {
      expect(typeof (renderExports as any)[name]).toBe('function')
    }
  })

  it('registered components resolve through the index re-export (same registry)', () => {
    const edit = () => h('div')
    renderExports.registerBlockComponent('Quote', { edit })
    expect(renderExports.resolveBlockComponent('Quote').edit).toBe(edit)
  })
})

describe('BlockComponent type shape', () => {
  it('accepts a full three-mode component', () => {
    const comp: BlockComponent = {
      view: () => h('div'),
      stream: () => h('div'),
      edit: (node, ctx) => h('div', [ctx.readonly ? 'ro' : 'rw', node.id]),
    }
    expect(comp).toBeTruthy()
  })
})
