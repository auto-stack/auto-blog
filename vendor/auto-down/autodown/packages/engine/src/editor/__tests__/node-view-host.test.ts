// node-view host bridge tests (plan 026 P1T1): nodeViewProps fabricates the
// tiptap-shaped props the seven generated NodeView widgets declare
// (node/updateAttributes/deleteNode/getPos/selected/editor/extension/
// decorations), backed by the real engine model — updateAttributes goes
// through setBlockAttrs (ONE undo step), deleteNode removes the block.

import { describe, expect, it } from 'vitest'
import {
  Attr,
  BlockNode,
  BlockType,
  Value,
  attrSet,
  attrGetStr,
  attrGetBool,
  blockText,
  findBlock,
  leafBlock,
  block,
  withChildren,
  collapsedSel,
} from '../../parser/block-model'
import { serialize } from '../../parser/serializer'
import { EditorEngine } from '../engine/editor-engine'
import { nodeViewProps, pushNodeViewHost, popNodeViewHost, currentNodeViewHost } from '../engine/node-view-host'

function doc(...kids: BlockNode[]): BlockNode {
  return withChildren(block('doc', BlockType.Paragraph), kids)
}

function detailsNode(): BlockNode {
  const n = block('d1', BlockType.Details)
  n.attrs = attrSet(n.attrs, 'summary', Value.Str('S'))
  n.attrs = attrSet(n.attrs, 'open', Value.Bool(false))
  return withChildren(n, [leafBlock('d1-p', BlockType.Paragraph, 'body')])
}

describe('nodeViewProps', () => {
  it('fabricates the tiptap-shaped props the widgets declare', () => {
    const e = new EditorEngine(doc(detailsNode()), collapsedSel('d1-p', 0))
    const props = nodeViewProps(detailsNode(), e, false)
    expect(props.node.attrs).toEqual({ summary: 'S', open: false })
    expect(props.node.textContent).toBe('') // container block: no own inline text
    expect(props.selected).toBe(false)
    expect(typeof props.updateAttributes).toBe('function')
    expect(typeof props.deleteNode).toBe('function')
    expect(typeof props.getPos).toBe('function')
    expect(Array.isArray(props.decorations)).toBe(true)
    // the query/embed widgets read extension.options before every run — the
    // data-loader slot (plan 038 T2); unregistered reads as the empty shape
    expect(props.extension).toEqual({ options: {} })
    expect(props.extension.options.runQuery).toBeUndefined()
    expect(props.extension.options.loadBlock).toBeUndefined()
  })

  it('carries textContent for leaf source blocks (math/mermaid read it)', () => {
    const math = leafBlock('m1', BlockType.MathBlock, 'E = mc^2')
    const e = new EditorEngine(doc(math), collapsedSel('m1', 0))
    const props = nodeViewProps(math, e, false)
    expect(props.node.textContent).toBe('E = mc^2')
  })

  it('updateAttributes patches attrs through ONE undo step', () => {
    const node = detailsNode()
    const e = new EditorEngine(doc(node), collapsedSel('d1-p', 0))
    const props = nodeViewProps(node, e, false)
    props.updateAttributes({ open: true, summary: 'changed' })
    const after = findBlock(e.doc, 'd1')!
    expect(attrGetBool(after.attrs, 'open', false)).toBe(true)
    expect(attrGetStr(after.attrs, 'summary', '')).toBe('changed')
    // one undo restores both patches
    e.undo()
    const restored = findBlock(e.doc, 'd1')!
    expect(attrGetBool(restored.attrs, 'open', false)).toBe(false)
    expect(attrGetStr(restored.attrs, 'summary', '')).toBe('S')
  })

  it('deleteNode removes the block', () => {
    const e = new EditorEngine(doc(detailsNode(), leafBlock('p1', BlockType.Paragraph, 'x')), collapsedSel('p1', 0))
    const props = nodeViewProps(findBlock(e.doc, 'd1')!, e, false)
    props.deleteNode()
    expect(findBlock(e.doc, 'd1')).toBeNull()
    e.undo()
    expect(findBlock(e.doc, 'd1')).toBeTruthy()
  })

  it('getPos returns the child index within the parent', () => {
    const e = new EditorEngine(doc(leafBlock('p0', BlockType.Paragraph, 'a'), detailsNode()), collapsedSel('p0', 0))
    const props = nodeViewProps(findBlock(e.doc, 'd1')!, e, false)
    expect(props.getPos()).toBe(1)
  })

  it('without an engine the props render statically (no writeback)', () => {
    const node = detailsNode()
    const props = nodeViewProps(node, undefined, false)
    expect(() => {
      props.updateAttributes({ open: true })
      props.deleteNode()
      props.getPos()
    }).not.toThrow()
    expect(attrGetBool(node.attrs, 'open', false)).toBe(false)
  })
})

describe('node-view host scope', () => {
  it('push/pop exposes the current host during a synchronous render window', () => {
    const e = new EditorEngine(doc(detailsNode()), collapsedSel('d1-p', 0))
    expect(currentNodeViewHost()).toBeUndefined()
    pushNodeViewHost({ engine: e })
    expect(currentNodeViewHost()?.engine).toBe(e)
    popNodeViewHost()
    expect(currentNodeViewHost()).toBeUndefined()
  })

  it('nested pushes unwind in order (concurrent editors)', () => {
    const e1 = new EditorEngine(doc(detailsNode()), collapsedSel('d1-p', 0))
    const e2 = new EditorEngine(doc(detailsNode()), collapsedSel('d1-p', 0))
    pushNodeViewHost({ engine: e1 })
    pushNodeViewHost({ engine: e2 })
    expect(currentNodeViewHost()?.engine).toBe(e2)
    popNodeViewHost()
    expect(currentNodeViewHost()?.engine).toBe(e1)
    popNodeViewHost()
  })
})
