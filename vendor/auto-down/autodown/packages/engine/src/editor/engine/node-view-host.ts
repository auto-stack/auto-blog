// Node-view host bridge (plan 026 P1T1) — the mounting protocol for the
// seven generated NodeView widgets (Details/MathBlock/MathInline/Mermaid/
// QueryBlock/BlockEmbed/WikiLink). The widgets declare the tiptap-shaped
// props (node/updateAttributes/deleteNode/getPos/selected/editor/extension/
// decorations); nodeViewProps fabricates that shape from a BlockNode + the
// engine session, so the SFCs mount UNCHANGED on the preview side.
//
// Host scope: panel renderers execute synchronously inside renderNodes, so
// the assembling EngineEditor brackets its preview render with
// push/popNodeViewHost — module-scope panel registrations resolve the
// engine of the editor currently rendering (empty stack = static render,
// e.g. MarkdownRender without an editor).

import {
  Attr,
  BlockNode,
  Value,
  attrSet,
  blockText,
  childIndex,
  parentOf,
  replaceNode,
} from '../../parser/block-model'
import { defineComponent, h, provide } from 'vue'
import { NODE_VIEW_CONTENT_KEY } from '../ext/node_view_ext'
import { setBlockAttrs } from './commands'
import { getDataLoaders } from './data-loaders'
import type { EditorEngine } from './editor-engine'
import type { EditorAdapter } from './tiptap-adapter'

export interface NodeViewHostScope {
  engine: EditorEngine
  adapter?: EditorAdapter
}

const hostStack: NodeViewHostScope[] = []

/** Open a synchronous render window for `host`'s engine. */
export function pushNodeViewHost(host: NodeViewHostScope): void {
  hostStack.push(host)
}

/** Close the innermost render window. */
export function popNodeViewHost(): void {
  hostStack.pop()
}

/** The editor currently rendering (undefined outside a render window). */
export function currentNodeViewHost(): NodeViewHostScope | undefined {
  return hostStack[hostStack.length - 1]
}

export interface NodeViewProps {
  node: { attrs: Record<string, unknown>; textContent: string; id: string }
  updateAttributes: (patch: Record<string, unknown>) => void
  deleteNode: () => void
  getPos: () => number
  selected: boolean
  editor: EditorAdapter | null
  extension: { options: Record<string, unknown> }
  decorations: unknown[]
}

/** plain JS value → model Value (attrs writeback channel). */
function toValue(v: unknown): Value {
  if (typeof v === 'boolean') return Value.Bool(v)
  if (typeof v === 'number') return Value.Int(v)
  return Value.Str(String(v ?? ''))
}

/** Attr list → plain object (Str/Int/Bool unwrap; structural values null). */
function attrsToObject(attrs: Attr[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const a of attrs) {
    const v = a.value as Value
    out[a.key] = v != null && (v._tag === 'Str' || v._tag === 'Int' || v._tag === 'Bool') ? v.value : null
  }
  return out
}

/** Wrap a NodeView widget mount with the NodeViewContent body source: the
 *  widget templates render the hole bare, the provider injects the block's
 *  embedded VNodes (plan 026 P1T2). */
export const NodeViewContentProvider = defineComponent({
  name: 'NodeViewContentProvider',
  props: { content: { type: Function, required: true } },
  setup(rp, { slots }) {
    provide(NODE_VIEW_CONTENT_KEY, () => (rp.content as () => unknown[])())
    return () => slots.default?.()
  },
})

/** Mount a NodeView widget with fabricated props, its NodeViewContent hole
 *  fed by `content` (embedded body VNodes). */
export function mountNodeView(view: unknown, props: NodeViewProps, content: () => unknown[]) {
  return h(NodeViewContentProvider, { content }, { default: () => h(view as any, props) })
}

/** Fabricate the tiptap-shaped widget props for a model block. `engine`
 *  optional: without it the widget renders but never writes back. */
export function nodeViewProps(node: BlockNode, engine?: EditorEngine, selected = false, adapter?: EditorAdapter | null): NodeViewProps {
  return {
    node: {
      attrs: attrsToObject(node.attrs),
      // Math/Mermaid widgets read node.textContent as their source
      textContent: blockText(node),
      id: node.id,
    },
    updateAttributes: (patch: Record<string, unknown>) => {
      if (!engine) return
      const attrs: Attr[] = []
      for (const [key, value] of Object.entries(patch ?? {})) attrs.push({ key, value: toValue(value) })
      if (attrs.length > 0) setBlockAttrs(engine, node.id, attrs)
    },
    deleteNode: () => {
      if (!engine) return
      engine.applyTree((tree) => replaceNode(tree, node.id, []))
    },
    getPos: () => {
      if (!engine) return 0
      const parent = parentOf(engine.doc, node.id) ?? engine.doc
      return childIndex(parent, node.id)
    },
    selected,
    editor: adapter ?? null,
    // Query/Embed widgets read extension.options.runQuery / .loadBlock —
    // the module-level data-loader slot the EngineEditor props watch feeds
    // (plan 038 T2; the plan 026 constant-empty gap closed)
    extension: { options: { ...getDataLoaders() } },
    decorations: [],
  }
}
