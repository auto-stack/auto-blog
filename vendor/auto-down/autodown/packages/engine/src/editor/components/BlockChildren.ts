// BlockChildren (plan 035 T1 / D1) — the composition primitive for .at
// container widgets: the recursive child-mount hole. children_slot is a
// () => VNode[] closure built by the assembly layer (EngineEditor's
// childrenOf adapter — node.children.map(ch => childSlot(ch, ctx))), so the
// recursion and ALL its runtime state (epoch remounts 029, host registry,
// focus path) stay at the single assembly point; the hole is render-thin
// and owns none of it. Same idiom as AssemblyView's render-closure prop and
// NodeViewWrapper's host bridge — .at templates embed it via
// `use { component: BlockChildren from "ext/<bridge>" }` and pass the
// wide-typed children prop; the closure re-evaluates on every render, so
// epoch/version-driven remounts flow through the keys of the vnodes it
// returns. Renders a FRAGMENT — no wrapper element of its own: the child
// list lands directly inside the container widget's chrome.
import { defineComponent, type VNode } from 'vue'

export const BlockChildren = defineComponent({
  name: 'BlockChildren',
  props: { children_slot: { type: Function, required: true } },
  setup(p) {
    return () => (p.children_slot as () => VNode[])()
  },
})
