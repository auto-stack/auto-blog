// Data-loader channel tests (plan 038 T1/T2): the module-level loader slot
// the EngineEditor props watch feeds and the node-view bridge reads — the P1
// leg of the Query/Embed data-loading hookup (DEBTS 026①). Semantics:
// registration replaces the whole slot object, the un-set state reads as
// undefined loaders (the "No query runner configured" placeholder), a
// scoped run restores the previous registration on exit, and the
// nodeViewProps fabricator carries the slot into extension.options (the
// former constant-empty point, plan 026's documented gap).

// @vitest-environment happy-dom

import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getDataLoaders,
  setDataLoaders,
  withDataLoaders,
  type EmbeddedBlock,
  type QueryResultEnvelope,
} from '../engine/data-loaders'
import { nodeViewProps } from '../engine/node-view-host'
import { BlockType, block } from '../../parser/block-model'
import EngineEditor from '../components/EngineEditor.vue'

describe('data-loaders module slot (plan 038 T1)', () => {
  afterEach(() => {
    setDataLoaders({})
  })

  it('reads undefined loaders before any registration (placeholder semantics)', () => {
    const slot = getDataLoaders()
    expect(slot.runQuery).toBeUndefined()
    expect(slot.loadBlock).toBeUndefined()
  })

  it('setDataLoaders registers both loaders and getDataLoaders reads them back', async () => {
    const runQuery = async (q: string): Promise<QueryResultEnvelope> => ({
      results: [{ marker: '§', content: q }],
    })
    const loadBlock = async (id: string): Promise<EmbeddedBlock | null> => ({
      title: 'Other',
      content: `#${id}`,
    })
    setDataLoaders({ runQuery, loadBlock })
    const slot = getDataLoaders()
    expect(slot.runQuery).toBe(runQuery)
    expect(slot.loadBlock).toBe(loadBlock)
    const envelope = await slot.runQuery!('table tasks')
    expect(envelope.results[0]!.content).toBe('table tasks')
    const block = await slot.loadBlock!('abc123')
    expect(block?.title).toBe('Other')
  })

  it('partial registration keeps the other loader slot undefined', () => {
    const runQuery = async () => ({ results: [] })
    setDataLoaders({ runQuery })
    const slot = getDataLoaders()
    expect(slot.runQuery).toBe(runQuery)
    expect(slot.loadBlock).toBeUndefined()
  })

  it('setDataLoaders({}) resets to the un-set state (EngineEditor unmount shape)', () => {
    setDataLoaders({ runQuery: async () => ({ results: [] }) })
    setDataLoaders({})
    const slot = getDataLoaders()
    expect(slot.runQuery).toBeUndefined()
    expect(slot.loadBlock).toBeUndefined()
  })

  it('withDataLoaders scopes a registration and restores the previous one', async () => {
    const outer = async () => ({ results: [] })
    setDataLoaders({ runQuery: outer })
    const inner = async (id: string): Promise<EmbeddedBlock | null> => ({ content: id })
    const out = withDataLoaders({ loadBlock: inner }, () => {
      const slot = getDataLoaders()
      // the scoped object REPLACES the slot wholesale (props-watch shape),
      // not merges — outer is invisible inside the window
      expect(slot.runQuery).toBeUndefined()
      expect(slot.loadBlock).toBe(inner)
      return 42
    })
    expect(out).toBe(42)
    expect(getDataLoaders().runQuery).toBe(outer)
    expect(getDataLoaders().loadBlock).toBeUndefined()
  })
})

describe('nodeViewProps extension.options injection (plan 038 T2)', () => {
  afterEach(() => {
    setDataLoaders({})
  })

  it('carries the registered loaders into extension.options (the former constant-empty point)', () => {
    const runQuery = async (q: string): Promise<QueryResultEnvelope> => ({ results: [{ content: q }] })
    const loadBlock = async (id: string): Promise<EmbeddedBlock | null> => ({ content: id })
    setDataLoaders({ runQuery, loadBlock })
    const q = block('q1', BlockType.QueryBlock)
    const props = nodeViewProps(q)
    expect(props.extension.options.runQuery).toBe(runQuery)
    expect(props.extension.options.loadBlock).toBe(loadBlock)
  })

  it('undefined loaders read back undefined (widget placeholder semantics)', () => {
    const props = nodeViewProps(block('q1', BlockType.QueryBlock))
    expect(props.extension.options.runQuery).toBeUndefined()
    expect(props.extension.options.loadBlock).toBeUndefined()
  })
})

describe('EngineEditor props watch → setDataLoaders (plan 038 T2)', () => {
  afterEach(() => {
    setDataLoaders({})
  })

  function mountEditor(props: Record<string, unknown> = {}) {
    const host = createApp(defineComponent({ render: () => h(EngineEditor, props) }))
    const el = document.createElement('div')
    document.body.appendChild(el)
    host.mount(el)
    return host
  }

  it('declares runQuery/loadBlock props and registers them immediately (jade pass-through lights up)', async () => {
    const runQuery = async (q: string): Promise<QueryResultEnvelope> => ({ results: [{ content: q }] })
    const loadBlock = async (id: string): Promise<EmbeddedBlock | null> => ({ content: id })
    const host = mountEditor({ modelValue: '$query(a)', runQuery, loadBlock })
    expect(getDataLoaders().runQuery).toBe(runQuery)
    expect(getDataLoaders().loadBlock).toBe(loadBlock)
    host.unmount()
    expect(getDataLoaders().runQuery).toBeUndefined()
    expect(getDataLoaders().loadBlock).toBeUndefined()
  })

  it('unpassed props keep the placeholder fallback (undefined loaders)', async () => {
    const host = mountEditor({ modelValue: '$query(a)' })
    expect(getDataLoaders().runQuery).toBeUndefined()
    expect(getDataLoaders().loadBlock).toBeUndefined()
    host.unmount()
  })

  it('a prop-less editor never clobbers an existing registration (T7: demo mock loaders + prop-less editor)', async () => {
    const external = async (): Promise<QueryResultEnvelope> => ({ results: [] })
    setDataLoaders({ runQuery: external })
    const host = mountEditor({ modelValue: '$query(a)' })
    expect(getDataLoaders().runQuery).toBe(external)
    host.unmount()
    // the prop-less editor did not own the slot — the registration survives
    expect(getDataLoaders().runQuery).toBe(external)
  })

  it('a prop change re-registers through the watch', async () => {
    const runA = async (): Promise<QueryResultEnvelope> => ({ results: [] })
    const runB = async (): Promise<QueryResultEnvelope> => ({ results: [] })
    const prop = ref(runA)
    const host = createApp(
      defineComponent({ render: () => h(EngineEditor, { modelValue: '$query(a)', runQuery: prop.value }) })
    )
    const el = document.createElement('div')
    document.body.appendChild(el)
    host.mount(el)
    expect(getDataLoaders().runQuery).toBe(runA)
    prop.value = runB
    await nextTick()
    expect(getDataLoaders().runQuery).toBe(runB)
    host.unmount()
    expect(getDataLoaders().runQuery).toBeUndefined()
  })
})
