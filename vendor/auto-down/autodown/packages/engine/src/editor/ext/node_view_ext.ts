// node_view_ext.ts — Hand-written TS extension shared by the Auto
// node-view widgets. The gen pipeline copies this file into the transient
// gen project (never type-checked there) and deploys it verbatim to
// src/editor/ext/node_view_ext.ts; the generated SFCs import it from
// ../ext/node_view_ext (gen.mjs E1 rewrite).
//
// Plan 038 T6: with the Query/Embed node views retired (the family
// widgets absorbed them — normalizeQueryResults/errorMessage moved to
// query_block_widget_ext.ts / embed_block_widget_ext.ts) and the dormant
// WikiLinkNodeView source retired (plan 036 made wikilink a model span;
// parseWikiLinkRaw / wikiLinkPencilIcon / focusAndSelect went with it),
// what remains is the node-view mounting protocol pair the node-view-host
// bridge fabricates props for:
//
// 1. NodeViewWrapper / NodeViewContent — the block-view host components
//    (plan 021 Phase 2 retarget: Tiptap is gone, these are engine-native
//    render-thin components with the same DOM contract — the `as` element
//    prop, full attr/class fallthrough, data-node-view-* markers). Under
//    the engine the node-view widgets are PREVIEW-side chrome; the
//    NodeViewContent hole renders the block's source/preview through the
//    NODE_VIEW_CONTENT_KEY injection.
// 2. NODE_VIEW_CONTENT_KEY — the injection key node-view-host's
//    NodeViewContentProvider provides (plan 026 P1T2).

import { defineComponent, h, inject, type VNode } from 'vue'

/** Injection key for the NodeViewContent hole's body (plan 026 P1T2): the
 *  mounting bridge provides the block's embedded VNodes; the widget templates
 *  use NodeViewContent bare (no own children), so the hole renders what the
 *  assembly injected. Nearest provider wins — nested node-views resolve to
 *  their own wrapper. */
export const NODE_VIEW_CONTENT_KEY = 'autodown-node-view-content'

// The block-view host components (engine replacements for tiptap's
// NodeViewWrapper/NodeViewContent). Render-thin: element type via `as`,
// everything else falls through; the data-node-view-* markers keep the
// historical DOM shape.
export const NodeViewWrapper = defineComponent({
  name: 'NodeViewWrapper',
  props: {
    as: { type: [String, Object], default: 'div' },
  },
  setup(props, { slots, attrs }) {
    return () =>
      h(props.as as string, { ...attrs, 'data-node-view-wrapper': '' }, slots.default?.())
  },
})

export const NodeViewContent = defineComponent({
  name: 'NodeViewContent',
  props: {
    as: { type: [String, Object], default: 'div' },
  },
  setup(props, { slots, attrs }) {
    const provided = inject<(() => VNode[]) | null>(NODE_VIEW_CONTENT_KEY, null)
    return () => {
      const body = provided ? provided() : (slots.default?.() ?? [])
      return h(props.as as string, { ...attrs, 'data-node-view-content': '' }, body)
    }
  },
})
