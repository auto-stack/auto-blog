// Block-widget panel registrations (plan 033 T5) — the render-layer face
// of the fence family widget. renderCodeblockPanel retired: the Codeblock
// builtin entry is gone from builtin-panels, and this module registers the
// widget's view face (panelOf) on the registry's custom slot instead —
// same channel StreamingTable pioneered (plan 032), pulled in by
// render-node's side-effect import so EVERY render consumer (MarkdownRender,
// StreamingRenderer right panes, the editor preview column) resolves the
// same widget with no editor-layer import at the call sites.
//
// plan 035 T6: renderCalloutPanel / renderListPanel retired the same way —
// the container families' view faces (panelOfContainer / the list adapter)
// own the Callout and List slots now, children riding the renderEmbedded
// closure into the widget's BlockChildren hole. The registration is
// module-scope and unconditional: the widget IS the single chrome source
// for these kinds — unregisterPanel would degrade to unknown-node (no
// builtin fallback), the shape Table/Codeblock already have. Details
// registers editor-side (EngineEditor): its marker verb needs the live
// host window's engine.
//
// plan 037 T3: tablePanel retired the same way — the table family widget's
// view face owns the Table slot (table.table-node contract), cells riding
// the renderInlineChildren closure through the BlockChildren hole (the list
// adapter's sibling — cells are parseInline output, inline flow since musk
// plan 072). StreamingTable.vue no longer registers anything; the
// module goes fully dead until the T5 retirement deletes it.

import { h, type VNode } from 'vue'
import CodeBlockWidget from '../editor/components/CodeBlockWidget.vue'
import CalloutBlockWidget from '../editor/components/CalloutBlockWidget.vue'
import ListBlockWidget from '../editor/components/ListBlockWidget.vue'
import TableBlockWidget from '../editor/components/TableBlockWidget.vue'
import {
  containerPanelModel,
  listItemsOfPanel,
  panelOf,
  panelOfContainer,
  tableHeaderCellsOfPanel,
  tableRowsOfPanel,
} from './block-widget'
import { registerPanel } from './panel-registry'

/** The ```json table segment's stream face (plan 042 T3): the retired
 *  StreamingRenderer-local StreamingTableFace, hoisted to a shared export
 *  so both registration layers use ONE implementation — StreamingRenderer
 *  registers it for pure-render consumers (its module scope is the old
 *  face's home, and the only consumer of stream slots), EngineEditor's
 *  table family registration reuses it (superseding with the same closure).
 *  NOTE: this module must not CALL registerBlockComponent at top level —
 *  the render-node side-effect cycle would hit block-component's TDZ. */
export function tableStreamFace(node: any, final: boolean): VNode {
  return h(TableBlockWidget as any, {
    mode: 'stream',
    controller: null,
    blockId: '',
    readonly: true,
    final,
    header_cells: [],
    body_rows: [],
    columns: node?.columns ?? [],
    rows: node?.rows ?? [],
  })
}

registerPanel('Codeblock', panelOf(CodeBlockWidget))
registerPanel('Callout', panelOfContainer(CalloutBlockWidget))
registerPanel('List', (ctx) =>
  h(ListBlockWidget, {
    mode: 'view',
    node: containerPanelModel(ctx.node),
    final: ctx.final ?? true,
    ctx: null,
    items: listItemsOfPanel(ctx),
    version: 0,
  }),
)
registerPanel('Table', (ctx) =>
  h(TableBlockWidget, {
    mode: 'view',
    final: ctx.final ?? true,
    ctx: null,
    // filler values for the generated required-prop checks (the 033
    // ctx:null idiom): the view face reads none of these
    controller: null,
    blockId: '',
    readonly: false,
    columns: [],
    rows: [],
    header_cells: tableHeaderCellsOfPanel(ctx),
    body_rows: tableRowsOfPanel(ctx),
  }),
)
