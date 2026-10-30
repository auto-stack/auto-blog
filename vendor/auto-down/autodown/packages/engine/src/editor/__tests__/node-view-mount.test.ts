// Node-view preview mount tests (plan 026 P1T2/P1T3): the panel-registry
// registrations the EngineEditor assembly performs mount the generated
// NodeView widgets on the preview side — SSR asserts the data-node-view DOM
// markers and attrs-driven rendering; the writeback assertion drives the
// mounted widget's updateAttributes (the Details toggle channel) into the
// model and the serializer.

import { createSSRApp, h, type VNode } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import {
  BlockNode,
  BlockType,
  Value,
  attrSet,
  block,
  findBlock,
  leafBlock,
  withChildren,
  collapsedSel,
} from '../../parser/block-model'
import { serialize } from '../../parser/serializer'
import { renderNodes } from '../../render/render-node'
import { blockNodesToWNodes, blockOfWNode } from '../../render/block-wnode'
import { EditorEngine } from '../engine/editor-engine'
import { setBlockAttrs } from '../engine/commands'
import { pushNodeViewHost, popNodeViewHost } from '../engine/node-view-host'
import { queryNode } from '../../parser/markdown-parser'
import DetailsBlockWidget from '../components/DetailsBlockWidget.vue'
// importing the assembly performs the module-scope panel registrations
import '../components/EngineEditor.vue'

function doc(...kids: BlockNode[]): BlockNode {
  return withChildren(block('doc', BlockType.Paragraph), kids)
}

function detailsNode(open = false): BlockNode {
  const n = block('d1', BlockType.Details)
  n.attrs = attrSet(n.attrs, 'summary', Value.Str('Hint'))
  n.attrs = attrSet(n.attrs, 'open', Value.Bool(open))
  return withChildren(n, [leafBlock('d1-p', BlockType.Paragraph, 'hidden body')])
}

/** SSR-render one model block through the preview pipeline (the same
 *  blockNodesToWNodes -> renderNodes leg EngineEditor.previewVNodeOf uses). */
async function ssrPreview(node: BlockNode, engine?: EditorEngine): Promise<string> {
  let vnode: VNode
  if (engine) {
    pushNodeViewHost({ engine })
    try {
      vnode = renderNodes(blockNodesToWNodes([node]), true)[0]!
    } finally {
      popNodeViewHost()
    }
  } else {
    vnode = renderNodes(blockNodesToWNodes([node]), true)[0]!
  }
  const app = createSSRApp({ render: () => h('div', [vnode]) })
  return (await renderToString(app)).replace(/<!--.*?-->/g, '')
}

/** Walk a vnode tree for the component vnode of `type`. */
function findComponentVNode(vnode: any, type: unknown): VNode | null {
  if (!vnode || typeof vnode !== 'object') return null
  if (vnode.type === type) return vnode
  const kids = vnode.component ? null : vnode.children
  if (Array.isArray(kids)) {
    for (const k of kids) {
      const found = findComponentVNode(k, type)
      if (found) return found
    }
  } else if (kids && typeof kids === 'object') {
    // slot object (pre-mount component vnode): search the default slot's
    // return — a vnode, a fragment, or an array
    const d = (kids as any).default
    if (typeof d === 'function') return findComponentVNode(d(), type)
  }
  return null
}

describe('Math/Mermaid/Query/Embed preview mounts (plan 026 P1T3; family widgets since plans 033/038)', () => {
  it('math block mounts the MathBlockWidget view face (no unknown-node degrade)', async () => {
    const html = await ssrPreview(leafBlock('m1', BlockType.MathBlock, 'E = mc^2'))
    expect(html).toContain('autodown-math-block')
    expect(html).toContain('data-math-block')
    expect(html).not.toContain('unknown-node')
  })

  it('mermaid block mounts the MermaidBlockWidget view face', async () => {
    const html = await ssrPreview(leafBlock('mm1', BlockType.Mermaid, 'graph TD\nA-->B'))
    expect(html).toContain('autodown-mermaid-block')
    expect(html).toContain('data-mermaid-block')
    expect(html).not.toContain('unknown-node')
  })

  it('query block mounts the QueryBlockWidget family view face with its query text (plan 038 T6)', async () => {
    const q = block('q1', BlockType.QueryBlock)
    q.attrs = attrSet(q.attrs, 'query', Value.Str('table tasks where done'))
    const html = await ssrPreview(q)
    expect(html).toContain('autodown-query-block')
    expect(html).toMatch(/data-query-block(?:="")?/)
    expect(html).toContain('table tasks where done')
    expect(html).not.toContain('unknown-node')
  })

  it('block embed mounts the EmbedBlockWidget family view face (plan 038 T6)', async () => {
    const emb = block('e1', BlockType.BlockEmbed)
    emb.attrs = attrSet(emb.attrs, 'src', Value.Str('../other.ad'))
    const html = await ssrPreview(emb)
    expect(html).toContain('autodown-block-embed')
    expect(html).not.toContain('unknown-node')
  })
  // The retired query attrs writeback test (updateAttributes through the
  // node-view props bridge) went with the QueryBlockNodeView in plan 038
  // T6 — query/embed are non-editable leaves v1 (no writeback face); the
  // Details toggle test below still pins the model writeback channel.
})

// keep Details describe anchored after the new suite

describe('query text through the model→WNode bridge (plan 038 T3)', () => {
  it('the bridge carries attrs.query into the WNode content slot (mirrors parser queryNode)', () => {
    const q = block('q1', BlockType.QueryBlock)
    q.attrs = attrSet(q.attrs, 'query', Value.Str('table tasks where done'))
    const [w] = blockNodesToWNodes([q])
    expect(w!.type).toBe('query')
    expect(w!.content).toBe('table tasks where done')
  })

  it('a missing query attr bridges as the empty string (parser default shape)', () => {
    const [w] = blockNodesToWNodes([block('q1', BlockType.QueryBlock)])
    expect(w!.content).toBe('')
  })

  it('parse-side WNodes (static render, no back-link) reach the widget with the same value', async () => {
    // the parser-produced WNode — MarkdownRender / streaming path shape
    const w = queryNode('list open tabs')
    const vnode = renderNodes([w], true)[0]!
    const app = createSSRApp({ render: () => h('div', [vnode]) })
    const html = (await renderToString(app)).replace(/<!--.*?-->/g, '')
    expect(html).toContain('autodown-query-block')
    expect(html).toContain('list open tabs')
    expect(html).not.toContain('unknown-node')
  })
})

describe('Details preview mount (plan 026 P1T2)', () => {
  it('renders the Details family widget with attrs and body (plan 035: the node-view markers retired with DetailsNodeView)', async () => {
    const html = await ssrPreview(detailsNode(false))
    expect(html).toContain('autodown-details')
    expect(html).toContain('data-open="false"')
    expect(html).toContain('Hint')
    // the BlockChildren hole renders the body
    expect(html).toContain('hidden body')
    expect(html).not.toContain('data-node-view-wrapper')
    expect(html).not.toContain('data-node-view-content')
  })

  it('open=true renders expanded (data-open="true")', async () => {
    const html = await ssrPreview(detailsNode(true))
    expect(html).toContain('data-open="true"')
  })

  it('the mounted widget toggle writes back through the model and serializes (plan 035: the ctx.engine channel)', async () => {
    const e = new EditorEngine(doc(detailsNode(false)), collapsedSel('d1-p', 0))
    let vnode: VNode
    pushNodeViewHost({ engine: e })
    try {
      vnode = renderNodes(blockNodesToWNodes([findBlock(e.doc, 'd1')!]), true)[0]!
    } finally {
      popNodeViewHost()
    }
    const widget = findComponentVNode(vnode, DetailsBlockWidget)
    expect(widget).toBeTruthy()
    // the widget's ToggleOpen channel: toggleDetailsOpen(ctx.engine, ...) —
    // one setBlockAttrs step, the same writeback the node view did
    const engine = (widget!.props as any).ctx.engine
    setBlockAttrs(engine, 'd1', [{ key: 'open', value: Value.Bool(true) }])
    expect(serialize(e.doc, false)).toContain('$details(summary: "Hint", open: true)')
  })

  it('the WNode bridge carries the model block for the panel props', () => {
    const node = detailsNode(true)
    const [w] = blockNodesToWNodes([node])
    expect(w!.type).toBe('details')
    expect(blockOfWNode(w!)!).toBe(node)
  })

  it('renders statically without a host engine (MarkdownRender path)', async () => {
    const html = await ssrPreview(detailsNode(false))
    expect(html).toContain('autodown-details')
    expect(html).toContain('data-open="false"')
  })
})
