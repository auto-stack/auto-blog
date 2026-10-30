// BlockChildren hole (plan 035 T1 / D1): the composition primitive that
// lets an .at container widget mount recursively-assembled child blocks.
// children_slot is a () => VNode[] closure built by the assembly layer
// (EngineEditor's childrenOf adapter — node.children.map(ch => childSlot(ch,
// ctx))), so the recursion and ALL its runtime state (epoch remounts 029,
// host registry, focus path) stay at the single assembly point; the hole is
// render-thin and owns none of it. These tests pin the closure contract:
// per-render evaluation, wrapper-free fragment output, epoch-driven
// remounts flowing through the closure's vnode keys, and clean teardown.

// @vitest-environment happy-dom

import { createApp, createSSRApp, defineComponent, h, nextTick, onMounted, onUnmounted, ref, type VNode } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { BlockChildren } from '../../editor/components/BlockChildren'

async function ssr(vnode: unknown): Promise<string> {
  const app = createSSRApp({ render: () => h({ render: () => vnode } as any) })
  return (await renderToString(app)).replace(/<!--.*?-->/g, '')
}

function mountToHost(vnode: () => VNode): { host: HTMLElement; unmount: () => void } {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp({ render: () => vnode() })
  app.mount(host)
  return { host, unmount: () => { app.unmount(); host.remove() } }
}

describe('closure evaluation (render-time, wrapper-free)', () => {
  it('renders the closure vnode list as a bare fragment — no wrapper element of its own', async () => {
    const html = await ssr(h(BlockChildren, {
      children_slot: () => [h('p', { key: 'a' }, 'a'), h('p', { key: 'b' }, 'b')],
    }))
    expect(html).toBe('<p>a</p><p>b</p>')
  })

  it('evaluates the closure on EVERY render — reactive deps read inside it re-run the hole', async () => {
    let calls = 0
    const tick = ref(0)
    const children_slot = (): VNode[] => {
      void tick.value // the closure's captured ctx is reactive by construction
      calls++
      return [h('p', { key: 'k' }, `n${calls}`)]
    }
    const { host, unmount } = mountToHost(() => h(BlockChildren, { children_slot }))
    expect(calls).toBe(1)
    expect(host.textContent).toBe('n1')
    tick.value++
    await nextTick()
    expect(calls).toBe(2)
    expect(host.textContent).toBe('n2')
    unmount()
  })

  it('a fresh closure prop (new identity per assembly) re-renders the child list', async () => {
    const tick = ref(0)
    let n = 0
    const { host, unmount } = mountToHost(() => {
      void tick.value
      n++
      return h(BlockChildren, { children_slot: () => [h('p', { key: 'k' }, `assembly${n}`)] })
    })
    expect(host.textContent).toBe('assembly1')
    tick.value++
    await nextTick()
    expect(host.textContent).toBe('assembly2')
    unmount()
  })
})

describe('epoch remount (the 029 key mechanism flows through the hole)', () => {
  it('epoch-keyed children remount — the hole never defeats keyed reconciliation', async () => {
    const events: string[] = []
    const Child = defineComponent({
      props: { tag: { type: String, required: true } },
      setup(p) {
        onMounted(() => events.push(`mount:${p.tag}`))
        onUnmounted(() => events.push(`unmount:${p.tag}`))
        return () => h('li', { class: 'child' }, p.tag)
      },
    })
    const epoch = ref(0)
    // the assembly adapter's shape: the closure captures the epoch-bearing
    // ctx and embeds it in the child keys (EngineEditor's `edit:${id}:${epoch}`)
    const children_slot = () => [h(Child, { key: `child:${epoch.value}`, tag: `v${epoch.value}` })]
    const { host, unmount } = mountToHost(() => h(BlockChildren, { children_slot }))
    expect(host.textContent).toBe('v0')
    expect(events).toEqual(['mount:v0'])
    epoch.value++
    await nextTick()
    expect(host.textContent).toBe('v1')
    expect(events).toEqual(['mount:v0', 'unmount:v0', 'mount:v1'])
    unmount()
  })
})

describe('teardown', () => {
  it('unmounting the hole unmounts every child exactly once and empties the host', () => {
    const unmounted: string[] = []
    const Child = defineComponent({
      props: { tag: { type: String, required: true } },
      setup(p) {
        onUnmounted(() => unmounted.push(p.tag))
        return () => h('li', p.tag)
      },
    })
    const children_slot = () => [
      h(Child, { key: 'x', tag: 'x' }),
      h(Child, { key: 'y', tag: 'y' }),
    ]
    const { host, unmount } = mountToHost(() => h(BlockChildren, { children_slot }))
    expect(host.querySelectorAll('li')).toHaveLength(2)
    unmount()
    expect(unmounted.sort()).toEqual(['x', 'y'])
    expect(host.innerHTML).toBe('')
  })
})
