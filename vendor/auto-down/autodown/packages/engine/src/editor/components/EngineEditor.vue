<template>
  <div
    ref="root"
    class="autodown-editor"
    :class="{ 'is-dark': isDarkActive }"
    :data-accent="accentAttr"
  >
    <div ref="wrapper" class="autodown-editor-content-wrapper">
      <div class="autodown-editor-content" data-engine-editor tabindex="-1" @keydown="onContentKeydown">
        <SlashMenu :editor="adapter" :items="slashItems" />
        <BubbleMenu :editor="adapter" />
        <!-- CodeBlockMenu anchors root-relative, mounts bare. TableMenu was
             retired (plan 037 T5): its verbs live in the table family
             widget's toolbar since the 026 #1 absorption — single table
             entry, no floating menu face at all. -->
        <CodeBlockMenu :editor="adapter" />
        <component
          :is="block.view"
          v-for="block in views"
          :key="block.id"
          v-bind="block.props"
        />
      </div>
    </div>
    <div class="autodown-editor-actions">
      <button type="button" class="autodown-editor-save" @click="emitSave">Save</button>
    </div>
  </div>
</template>

<script lang="ts">
// plan 033 T6: the pilot kinds' three-mode faces are the family widgets —
// ONE .at widget per kind serves view/stream (panel custom slot, panelOf)
// and edit (BlockComponent slots, registerBlockWidget), so the chrome has
// a single source and cross-mode style drift is structurally impossible.
// The edit-slot wrappers the widgets absorbed (fenceEditSlot's
// .autodown-codeblock-node + badge host chrome, math/mermaid's
// controller-construction shims) live INSIDE the widgets now. This lives
// in a PLAIN script block because <script setup> statements compile into
// setup() — they would only run at component creation, not at import.
// Keys are BlockType enum names ('Fence' IS the code block kind).
import { Value, attrGetStr, blockText } from '../../parser/block-model'
import type { BlockNode } from '../../parser/block-model'
import type { BlockEditCtx } from '../../render/block-component'
import { registerBlockWidget, panelOf } from '../../render/block-widget'
import { tableStreamFace } from '../../render/block-widget-panels'
import { registerPanel } from '../../render/panel-registry'
import { blockOfWNode } from '../../render/block-wnode'
import { TableEditorController } from '../engine/table-editor-controller'
import { currentNodeViewHost } from '../engine/node-view-host'
import TableBlockWidget from './TableBlockWidget.vue'
import CodeBlockWidget from './CodeBlockWidget.vue'
import MathBlockWidget from './MathBlockWidget.vue'
import MermaidBlockWidget from './MermaidBlockWidget.vue'
import DetailsBlockWidget from './DetailsBlockWidget.vue'
import QueryBlockWidget from './QueryBlockWidget.vue'
import EmbedBlockWidget from './EmbedBlockWidget.vue'
import CalloutBlockWidget from './CalloutBlockWidget.vue'
import BlockquoteBlockWidget from './BlockquoteBlockWidget.vue'
import ListBlockWidget from './ListBlockWidget.vue'

// the three pilot families (plan 033): one widget, three modes — the
// BlockComponent slots mount the widget with the right mode, and the panel
// registrations below mount the SAME widget's view face for the preview
// column / static render (CodeBlockMenu's host contract — badge +
// data-language wrapper — rides the widget's edit mode).
registerBlockWidget('Fence', CodeBlockWidget)
registerBlockWidget('MathBlock', MathBlockWidget)
registerBlockWidget('Mermaid', MermaidBlockWidget)

// the container families (plan 042 T2): the same family contract for the
// composite kinds — the registered edit slot mounts the widget, and the
// assembly injects the focus-path recursion (children/items closures +
// repaint version) through BlockEditCtx; the retired hand-rolled
// containerEditSlot dispatch lived in the setup script's assembly. A
// directly-selected container (engine.select on the kind, never via click —
// focus-path.ts keeps descending for composite kinds) takes the preview-
// pipeline fallback below: its children are off-path by definition.
// This retires the node-view fallback arm for these kinds: the widget comes
// from the registry (one chrome source, three slots), the recursion stays
// at the single assembly point (the BlockChildren hole's contract).
function previewChildrenOf(node: BlockNode): () => VNode[] {
  return () => renderNodes(blockNodesToWNodes(node.children), true)
}

/** List items flattened to the widget's chrome data with preview bodies —
 *  listEditItems' module-scope sibling (the assembly's injected closure
 *  carries the focus-path recursion; this is the fallback face). */
function previewItemsOf(node: BlockNode): unknown[] {
  return node.children.map((item) => {
    const task = attrGet(item.attrs, 'checked') != null
    return {
      id: item.id,
      task,
      checked: attrGetBool(item.attrs, 'checked', false),
      cls: 'list-item' + (task ? ' task-item' : ''),
      children_slot: () => renderNodes(blockNodesToWNodes(item.children), true),
    }
  })
}

/** The container families' edit slot: the widget mount plus the kind's
 *  chrome-data prop (children closure / list items), from the assembly
 *  injection when present, the preview fallback otherwise. */
function containerEditFace(
  widget: unknown,
  extra: (node: BlockNode, ctx: BlockEditCtx) => Record<string, unknown>,
) {
  return (node: BlockNode, ctx: BlockEditCtx) =>
    h(widget as any, {
      mode: 'edit',
      node,
      ctx: { engine: ctx.engine, blockId: ctx.blockId, readonly: ctx.readonly },
      final: true,
      version: ctx.version ?? 0,
      ...extra(node, ctx),
    })
}

registerBlockWidget('Callout', CalloutBlockWidget, {
  edit: containerEditFace(CalloutBlockWidget, (node, ctx) => ({ children: ctx.children ?? previewChildrenOf(node) })),
})
registerBlockWidget('Blockquote', BlockquoteBlockWidget, {
  edit: containerEditFace(BlockquoteBlockWidget, (node, ctx) => ({ children: ctx.children ?? previewChildrenOf(node) })),
})
registerBlockWidget('ListBlock', ListBlockWidget, {
  // items is FLAT DATA (the widget v-fors the array itself), unlike the
  // children closure — call the injection at slot-call time (the assembly's
  // render closure re-runs per repaint, so the timing matches the retired
  // hand-rolled dispatch)
  edit: containerEditFace(ListBlockWidget, (node, ctx) => ({ items: ctx.items ? ctx.items() : previewItemsOf(node) })),
})
// Details joins the family registration (its T1 parity diff was real — the
// streaming pane's summary row rendered unstyled); the editor-side PANEL
// registration below stays (its marker verb needs the live host window's
// engine), the assembly's hand-rolled edit dispatch retires with the rest.
registerBlockWidget('Details', DetailsBlockWidget, {
  edit: containerEditFace(DetailsBlockWidget, (node, ctx) => ({ children: ctx.children ?? previewChildrenOf(node) })),
})

// The table family (plan 042 T3): registerBlockWidget replaces the 037
// edit-only registration — TableEditorController semantics unchanged (the
// edit slot constructs it internally, verbatim from the retired
// tableEditSlot); the STREAM slot reuses the render-side tableStreamFace
// (block-widget-panels registers it for pure-render consumers too — the
// ```json table segments hand the slot a render-model payload {columns,
// rows}, which the generic family wrapper's node prop would not deliver to
// the widget's columns/rows props), and the view slot mounts the view face
// from a model node (flat cells with preview bodies — the panel adapter's
// sibling; the panel registry keeps serving the renderNodes pipeline).
function tableAlignClass(align: string): string {
  if (align === 'center') return 'text-center'
  if (align === 'right') return 'text-right'
  return 'text-left'
}

/** Edit-cell chrome data: flat {id, text, cls} over the model — the 037
 *  TableEditorBlock boundary (commands/cell-commit semantics stay on the
 *  controller). */
function tableEditCell(c: BlockNode) {
  return { id: c.id, text: blockText(c), cls: tableAlignClass(attrGetStr(c.attrs, 'align', 'left')) }
}

/** View-cell chrome data: the same flat boundary with a preview body slot
 *  (the panel adapter's children_slot shape). */
function tableViewCell(c: BlockNode) {
  return {
    id: c.id,
    cls: tableAlignClass(attrGetStr(c.attrs, 'align', 'left')),
    children_slot: () => renderNodes(blockNodesToWNodes(c.children), true),
  }
}

registerBlockWidget('Table', TableBlockWidget, {
  edit: (node: BlockNode, ctx: BlockEditCtx) => {
    const rows = node.children
    return h(TableBlockWidget, {
      mode: 'edit',
      controller: new TableEditorController(ctx.engine, ctx.blockId),
      blockId: ctx.blockId,
      readonly: ctx.readonly,
      final: true,
      header_cells: (rows[0]?.children ?? []).map(tableEditCell),
      body_rows: rows.slice(1).map((row) => ({ id: row.id, cells: row.children.map(tableEditCell) })),
      // filler for the generated required-prop checks (the 033 ctx:null
      // idiom) — the edit face reads none
      columns: [],
      rows: [],
    })
  },
  stream: tableStreamFace,
  view: (node: BlockNode, final: boolean) => {
    const rows = node.children
    return h(TableBlockWidget, {
      mode: 'view',
      controller: null,
      blockId: '',
      readonly: false,
      final,
      header_cells: (rows[0]?.children ?? []).map(tableViewCell),
      body_rows: rows.slice(1).map((row) => ({ id: row.id, cells: row.children.map(tableViewCell) })),
      columns: [],
      rows: [],
    })
  },
})

// Node-view preview panels: the pilot kinds mount their family widgets'
// view face through the 017 panel registry's custom slot (plan 033 — same
// registration surface as the edit slots above, module scope). Plan 038
// T6 closes the family conversion: Query/Embed join panelOf too (their
// node views retired — 17 kinds, one widget each). renderNodes comes from
// the setup script's imports (dual-script hoisting — the `h` rule).
import type { PanelRenderCtx } from '../../render/panel-registry'

/** Static-render fallback model (Details panel only — query/embed went
 *  through panelOf's own fallback in plan 038 T6): kind + the WNode slot
 *  data the widget reads (attrs for the details summary/open). */
function wnodeFallbackModel(kindValue: BlockType, w: any): BlockNode {
  const attrs: { key: string; value: Value }[] = []
  if (w?.type === 'details') {
    attrs.push({ key: 'summary', value: Value.Str(String(w.text ?? '')) })
    if (w?.loading === true) attrs.push({ key: 'open', value: Value.Bool(true) })
  }
  return {
    id: 'nv',
    kind: kindValue,
    attrs,
    children: [],
    inlines: [],
    source: { start: 0, end: 0 },
  } as unknown as BlockNode
}

registerPanel(
  'Details',
  // plan 035 T6: the family widget replaces the retired DetailsNodeView —
  // same view face, plus the marker verb riding the live host window's
  // engine (the preview-side toggle writes `open` back through the model,
  // the host-protocol contract) and the body through the BlockChildren
  // closure instead of the node-view injection key.
  (ctx: PanelRenderCtx) => {
    const host = currentNodeViewHost()
    const model = blockOfWNode(ctx.node) ?? wnodeFallbackModel(BlockType.Details, ctx.node)
    return h(DetailsBlockWidget, {
      mode: 'view',
      node: model,
      final: ctx.final ?? true,
      ctx: host ? { engine: host.engine, blockId: model.id, readonly: true } : null,
      children: decorateBody(currentPanelDecorator(), () =>
        renderNodes((ctx.node as any).children ?? [], true)),
      version: 0,
    })
  },
)

// the render-type families: the widget's view face IS the panel (panelOf
// resolves the model back-link / fabricates one from the WNode slots).
// Plan 038 T6: Query/Embed join — the two node views retired, 17 kinds
// now one family widget each.
registerPanel('MathBlock', panelOf(MathBlockWidget))
registerPanel('Mermaid', panelOf(MermaidBlockWidget))
registerPanel('Query', panelOf(QueryBlockWidget))
registerPanel('Embed', panelOf(EmbedBlockWidget))

// frozen expose contract (EDITOR-CONTRACT.md) — declared in the plain
// script block: with dual scripts, type exports must live here, and the
// script setup below sees the module-scope type.
export interface BlockInfo {
  id: string
  index: number
  pos: number
  el: HTMLElement
  top: number
  height: number
}
</script>

<script setup lang="ts">
// EngineEditor (plan 018 Phase 2/3) — the self-built editor top level:
// per-leaf-block contenteditable hosts + the ./render pipeline for preview
// (live-preview compromise: the focused leaf block renders SOURCE, every
// other block renders PREVIEW — 块粒度 text/code 翻转, design §8 v1).
//
// Experimental parallel component during the Tiptap retirement (plan 018);
// AutoDownEditor switches to this assembly in Phase 4. The frozen external
// contract (EDITOR-CONTRACT.md) — root classes, data-block-id, getBlockMap —
// is preserved from day one.
import { computed, defineComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
// Value comes from the plain script block's import (dual scripts share
// one module scope)
import { BlockPos, BlockType, Selection, attrGet, attrGetBool, attrGetInt, findBlock } from '../../parser/block-model'
import { parse_blocks } from '../../parser/markdown-parser'
import { serialize } from '../../parser/serializer'
import { renderNodes } from '../../render/render-node'
import { blockNodesToWNodes } from '../../render/block-wnode'
import { editSlotFor } from '../../render/block-component'
import { h, type VNode } from 'vue'
import { EditorEngine } from '../engine/editor-engine'
import { BlockHostController, isEditableLeaf } from '../engine/host-controller'
import { captureClickCaret, resolveClickHit, slotAnchorOf } from '../engine/click-caret'
import { historyActionOf, runHistory } from '../engine/undo-wiring'
import { focusPathOf, focusTargetOf, lastFocusTargetOf } from '../engine/focus-path'
import { domRangeToBlockRange } from '../engine/selection-map'
import { spansToHtml } from '../engine/rich-html'
import RichTextHost from './RichTextHost.vue'
import BubbleMenu from '../menus/BubbleMenu.vue'
import CodeBlockMenu from '../menus/CodeBlockMenu.vue'
import { SlashMenu, getSlashItems } from '../slash-manifest'
import { createEditorAdapter } from '../engine/tiptap-adapter'
import { pushNodeViewHost, popNodeViewHost } from '../engine/node-view-host'
import { currentPanelDecorator } from '../../render/panel-registry'
import { decorateBody } from '../../render/block-widget'
import { registerWikilinkOpener, currentWikilinkOpener, type WikilinkOpener } from '../../render/wikilink-opener'
import { setDataLoaders, getDataLoaders, type RunQueryFn, type LoadBlockFn } from '../engine/data-loaders'

const props = defineProps<{
  content?: string
  modelValue?: string
  placeholder?: string
  extraSlashItems?: unknown[]
  /** stream→edit v1 gate (plan 023 P2T2): while true the focused editing
   *  faces render read-only (banner + disabled) via BlockEditCtx.readonly;
   *  the stream landing flips it back and the faces unlock. */
  streaming?: boolean
  /** Query/Embed data loaders (plan 038 T1): jade passes both straight
   *  through EditorShell — unpassed props keep the "No query runner
   *  configured" placeholder states. */
  runQuery?: RunQueryFn
  loadBlock?: LoadBlockFn
  /** Theme declaration entry (PLAN-051 T4): mirrors StreamingRenderer's
   *  darkMode/accent — the DSL `dark_mode:`/`accent:` bindings land here so
   *  the editor pane renders the same palette档 as the view pane. Values
   *  per auto-lang Design 22 §7; unpassed = light/indigo (现状零差异). */
  darkMode?: boolean
  accent?: 'indigo' | 'coral' | 'ocean' | 'sage' | 'amber'
}>()

const ACCENTS = ['indigo', 'coral', 'ocean', 'sage', 'amber'] as const
const accentAttr = computed(() =>
  ACCENTS.includes(props.accent as (typeof ACCENTS)[number]) ? props.accent : 'indigo'
)

const ambientDark = ref(false)
const isDarkActive = computed(() => props.darkMode || ambientDark.value)

onMounted(() => {
  if (typeof document !== 'undefined') {
    const checkDark = () => {
      ambientDark.value = Boolean(
        document.documentElement.classList.contains('dark') ||
        document.documentElement.getAttribute('data-theme') === 'dark' ||
        root.value?.closest('.dark, [data-theme="dark"]')
      )
    }
    checkDark()
    const observer = new MutationObserver(checkDark)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    if (root.value?.parentElement) {
      observer.observe(root.value.parentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    }
    onBeforeUnmount(() => observer.disconnect())
  }
})

const emit = defineEmits<{ (e: 'update', md: string): void; (e: 'update:modelValue', md: string): void; (e: 'save', md: string): void; (e: 'focusblock', block: { id: string; height: number } | null): void; (e: 'open-wiki-link', title: string, blockId?: string): void }>()

// PLAN-044 T5: focus-block channel — emits the anchor block (id +
// getBlockMap-measured height, null = clear). Push-emit form per the engine's
// existing update/save family (choice recorded in EDITOR-CONTRACT §3); at
// most one emit per distinct switch (lastEmitted dedup — watch-equivalent
// throttle). PLAN-044 待澄清① gate: `dirty` = this onChange carried a text
// change — the block emits only in the un-echoed window (typing); pure
// selection changes clear. Rides the onChange seam; height measured after
// the repaint tick (mount-time select fires before the wrapper exists).
let lastEmittedFocus: string | null = null
let focusEmitTimer: ReturnType<typeof setTimeout> | null = null
const FOCUS_GHOST_DELAY_MS = 250
function emitFocusBlockNow(id: string | null): void {
  const key = id ?? '\0null'
  if (key === lastEmittedFocus) return
  lastEmittedFocus = key
  nextTick(() => {
    const info = id ? getBlockMap().find((b) => b.id === id) : undefined
    emit('focusblock', id && info ? { id, height: info.height } : null)
  })
}
function emitFocusBlock(dirty: boolean): void {
  if (suppressNextFocusEmit) {
    suppressNextFocusEmit = false
    lastEmittedFocus = null // 程序化替换：不发射，也归零去重键
    return
  }
  // 尾沿 gate：文本变更后 FOCUS_GHOST_DELAY_MS 仍在同块（持续编辑）才
  // 亮 ghost；选区变化/程序化替换/新变更节拍都取消或推迟挂起发射。
  // 瞬态编辑（单键/一次 mark 切换后立刻点走）不闪现——ghost 经
  // useSyncedScroll 注入补偿 margin，闪现会造成两栏 ±px 级布局抖动
  //（wysiwyg zero-jump 套件实测）；持续编辑的真实占位不受影响。
  if (focusEmitTimer != null) {
    clearTimeout(focusEmitTimer)
    focusEmitTimer = null
  }
  if (!dirty) {
    emitFocusBlockNow(null)
    return
  }
  const id = engine.selection.anchor.blockId || null
  if (!id) return
  focusEmitTimer = setTimeout(() => {
    focusEmitTimer = null
    emitFocusBlockNow(id)
  }, FOCUS_GHOST_DELAY_MS)
}

// Wikilink clicks (plan 036 T5): the label span is rendered deep inside the
// pure render pipeline, so the app-facing callback registers on the
// render-side seam instead of threading through every render call. Single
// global slot with the same last-mounted-wins semantics as the
// focused-rich-host registration (plan 034).
const wikilinkOpener: WikilinkOpener = (title, blockId) => emit('open-wiki-link', title, blockId)
registerWikilinkOpener(wikilinkOpener)
onBeforeUnmount(() => {
  if (currentWikilinkOpener() === wikilinkOpener) registerWikilinkOpener(null)
})

// Data-loader channel (plan 038 T2, refined in T7): the nodeViewProps
// fabricator sits at the bottom of the render pipeline with no
// component-tree context, so the loaders register on the module-level slot
// and this watch keeps them current (the wikilink-opener seam's shape).
// An editor that DECLARES at least one loader owns the slot; an editor
// with neither prop leaves any existing registration intact — the demo
// registers mock loaders at entry and mounts a prop-less editor, and
// clobbering them with undefined would sink every load to the
// "No … configured" placeholder (T7 e2e catch).
let ownsLoaders = false
watch(
  () => [props.runQuery, props.loadBlock],
  () => {
    if (props.runQuery != null || props.loadBlock != null) {
      setDataLoaders({ runQuery: props.runQuery, loadBlock: props.loadBlock })
      ownsLoaders = true
    } else if (ownsLoaders) {
      // this editor owned the slot and just dropped both props — restore
      // the un-owned state (placeholder fallback)
      setDataLoaders({})
      ownsLoaders = false
    }
  },
  { immediate: true }
)
onBeforeUnmount(() => {
  if (!ownsLoaders) return
  const cur = getDataLoaders()
  if (cur.runQuery === props.runQuery && cur.loadBlock === props.loadBlock) setDataLoaders({})
})

const root = ref<HTMLElement | null>(null)
const wrapper = ref<HTMLElement | null>(null)

// -- engine session ----------------------------------------------------------------

function docFromMarkdown(md: string) {
  return parse_blocks(md ?? '', true)
}

const engine = new EditorEngine(docFromMarkdown(props.modelValue ?? props.content ?? ''))
const adapter = createEditorAdapter(engine)
const slashItems = getSlashItems({ extraSlashItems: props.extraSlashItems })

// Content-event dedup: `update` means the DOCUMENT CHANGED. Selection-only
// engine changes (mount-time focusFirstBlock, caret moves, history hops that
// restore the same tree) re-emit byte-identical md — consumers would run
// their save path for nothing, and jade's EditorTab handler isn't even
// initialized before the child mounts (mount-time select crashed it — found
// by the plan 026 jade e2e supplement). Seeded with the initial doc so the
// mount-time select never emits.
let lastEmittedMd: string | null = serialize(engine.doc, true)

engine.onChange(() => {
  repaintVersion.value++ // async content loads / every change repaints
  // PLAN-044 T5/待澄清①: focus-block channel — vue 臂 gate：仅文本变更
  //（未回显窗口）发射聚焦块，纯选区变化发射 null（清空 ghost）。聚焦即
  // 灰盒实测打断 zero-jump 语义（useSyncedScroll 按 ghost 高差给编辑栏
  // 注入补偿 margin，wysiwyg 套件 3 用例 +52px 跳变）——gate 属发射端
  // 策略，renderer 契约（props 非 null 即显）不动；VM 臂维持聚焦即显
  //（goal 1 原文，无 zero-jump 约束）。裁定记录计划 044 待澄清①。
  const textChanged = emitUpdate()
  emitFocusBlock(textChanged)
})

function emitUpdate(): boolean {
  // emitIds=true: re-emit persistent ^anchors from the `anchor` attr so the
  // store/save round trip never loses them (the text itself stays clean —
  // applyAnchorsDeep stripped them at parse time).
  const md = serialize(engine.doc, true)
  if (md === lastEmittedMd) return false
  lastEmittedMd = md
  emit('update', md)
  emit('update:modelValue', md)
  return true
}

// PLAN-044 待澄清①：程序化内容替换（外部 value 差分 seed）不算「未回显
// 窗口」——抑制其触发的 focus 发射，ghost 只跟用户编辑走（否则载入即
// ghost，wysiwyg zero-jump 基线被种子期注入的补偿 margin 毒化）。
let suppressNextFocusEmit = false

watch(
  () => props.modelValue ?? props.content,
  (md) => {
    if (md != null && md !== serialize(engine.doc, true)) {
      suppressNextFocusEmit = true
      engine.replaceDoc(docFromMarkdown(md))
      // D17: the replacement reshuffles block->content mapping while block
      // ids stay deterministic (`block-N`), so cached controllers (knownText
      // baselines, composition sessions) and mounted host DOMs all go stale.
      // Drop them and remount every host via the docEpoch key bump.
      hosts.clear()
      docEpoch.value++
    }
  }
)

// -- DOM selection → engine selection bridge (plan 024 P3T2) ---------------------
// A non-collapsed selection inside a rich host maps to (blockId, lo, hi) so
// adapter.isActive / the bubble address the selected range. Collapsed carets
// deliberately do NOT sync (block-granular baseline; avoids per-keystroke
// re-emits).

function onDocSelectionChange(): void {
  const sel = typeof window === 'undefined' ? null : window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  if (range.collapsed) return
  const start = range.startContainer
  const startEl = start.nodeType === 3 ? start.parentElement : (start as HTMLElement)
  const hostEl = startEl?.closest<HTMLElement>('.autodown-block-host')
  if (!hostEl || !root.value?.contains(hostEl)) return
  const blockId = hostEl.dataset.blockId
  if (!blockId) return
  const br = domRangeToBlockRange(hostEl, blockId)
  if (!br || br.lo === br.hi) return
  if (engine.selection.anchor.blockId === blockId && engine.selection.anchor.offset === br.lo && engine.selection.head.offset === br.hi) return
  engine.select(new Selection(new BlockPos(blockId, br.lo), new BlockPos(blockId, br.hi)))
}

onMounted(() => document.addEventListener('selectionchange', onDocSelectionChange))
onBeforeUnmount(() => document.removeEventListener('selectionchange', onDocSelectionChange))
// PLAN-044 待澄清①：尾沿 gate 挂起发射随卸载清理。
onBeforeUnmount(() => {
  if (focusEmitTimer != null) clearTimeout(focusEmitTimer)
})

// -- live preview assembly ----------------------------------------------------------

const repaintVersion = ref(0)

// History-hop epoch (plan 028 P0T1): bumped after each undo/redo. The
// focused edit face's draft DOM (BlockHost v-html / CodeEditorBlock
// textarea) is deliberately non-reactive to protect the user's caret, so a
// restored tree would not show up in it — the epoch lands in the focused
// view's vnode key and remounts that face from the live model (fresh DOM,
// caret re-placed at end). Preview slots always re-read the model, so they
// need nothing here.
const historyEpoch = ref(0)
// D17: bumped on external doc replacement (replaceDoc) so host vnodes remount
// and cached per-block controllers are discarded — deterministic block ids
// (`block-N`) collide across documents, and a stale controller (old
// knownText / stuck composition session) silently swallowed keystrokes.
const docEpoch = ref(0)

interface BlockView {
  id: string
  view: unknown
  props: Record<string, unknown>
}

interface AssemblyCtx {
  /** ancestor ids of the focused block — these containers render expanded */
  path: Set<string>
  focusedId: string
  /** running data-node-index across the whole assembled document */
  counter: { n: number }
}

// Stable shell for the vnode-producing views (plan 025 P2T1). Handing the
// template a fresh `{ render }` object per assembly made Vue treat every
// repaint as a component-type change → the whole subtree (nested hosts
// included) unmounted and remounted on EVERY engine emit: the focused
// host's DOM was rebuilt mid-typing (trailing spaces normalized away,
// caret churn). One component type + the render closure as a prop patches
// the same instance and re-runs only the closure.
const AssemblyView = defineComponent({
  name: 'AssemblyView',
  props: { render: { type: Function, required: true } },
  setup(rp) {
    return () => (rp.render as () => VNode)()
  },
})

const views = computed<BlockView[]>(() => {
  void repaintVersion.value
  const focusedId = engine.selection.anchor.blockId
  const ctx: AssemblyCtx = { path: focusPathOf(engine.doc, focusedId), focusedId, counter: { n: 0 } }
  return engine.doc.children.map((node) => assembleView(node, ctx, true))
})

/** Preview render of an off-path subtree: BlockNode → WNode → renderNodes —
 *  no serialize->parseDocument round trip (plan 023 P0T0, one pipeline for
 *  editor preview / MarkdownRender / StreamingRenderer). [[wikilinks]] are
 *  model spans since plan 036: renderInlineNode emits the label span
 *  directly and the click reaches this component's open-wiki-link event
 *  through the registered opener (the 020 post-render decorator retired).
 *  The host window (plan 026 P1T2) scopes the mounted node-view panels to
 *  THIS editor's engine — panel renderers execute synchronously inside
 *  renderNodes, so push/pop brackets the whole conversion+render leg. */
function previewVNodeOf(node: BlockNode): VNode {
  pushNodeViewHost({ engine, adapter })
  try {
    const vnode = renderNodes(blockNodesToWNodes([node]), true)[0]
    return vnode ?? h('div', { class: 'unknown-node' }, '')
  } finally {
    popNodeViewHost()
  }
}

/** The node-slot chrome around every assembled node: data-block-id makes the
 *  block deep-addressable (getBlockMap + click-to-focus); the boundary
 *  marker stays top-level only (preview DOM parity with renderEmbedded).
 *  `withBoundary: false` serves the FOCUSED face (plan 039 T4b): the insert
 *  affordance is meaningless for the block being edited, and its hit zone
 *  would swallow caret clicks on the focused block's own tail. */
function slotChrome(
  node: BlockNode,
  inner: VNode,
  topLevel: boolean,
  counter: { n: number },
  withBoundary = true,
): VNode {
  return h(
    'div',
    {
      class: 'node-slot',
      'data-node-index': String(counter.n++),
      'data-node-type': BlockType[node.kind],
      'data-block-id': node.id,
      // the innermost addressable slot wins — an expanded container's outer
      // chrome must not re-handle the bubbled click (it would resolve the
      // whole container back to its first leaf)
      onClick: (ev: MouseEvent) => {
        ev.stopPropagation()
        // click-caret handoff (engine/click-caret.ts): resolve WHAT the click
        // addresses and WHERE it pointed before the repaint swaps this
        // preview for the edit face. Without it every first click on an
        // unfocused block threw the caret to the block end, and a collapsed
        // container resolved focus to its FIRST leaf instead of the clicked
        // item. Only the RichTextHost face consumes a point, so only its
        // anchors capture (widget faces own their handoff — the fence records
        // a text offset in its own pre handler and a point entry for the same
        // block would clobber it; the table rides the cellId payload).
        const hit = resolveClickHit(node, ev.currentTarget as HTMLElement | null, ev)
        // only a resolved hit records — an unresolved click (container
        // chrome, a widget face's own handoff like the fence's pre handler)
        // must leave the store untouched; the channel's expiry clears stale
        // entries
        if (hit.anchor) captureClickCaret(ev, hit.targetId, hit.anchor, hit.cellId)
        selectBlock(node.id, hit.targetId)
      },
    },
    [
      h('div', { class: 'node-content' }, [inner]),
      ...(topLevel && withBoundary ? [h('div', { class: 'autodown-block-boundary', 'data-boundary-for': node.id })] : []),
    ]
  )
}

/** The focus-path container face (plan 035, family-registered in plan 042
 *  T2): the kind's REGISTERED family edit slot, invoked with the
 *  assembly-built closures injected through BlockEditCtx — chrome is
 *  .at-sourced (callout/details/blockquote/list_block_widget.at), the
 *  recursion stays HERE at the single assembly point (the BlockChildren
 *  hole's closure: epoch remounts / host registry / focus path all ride the
 *  captured ctx). Plan 030's keep-card-while-focused ruling carries over
 *  unchanged: the widgets render the same card chains the retired
 *  expandedElement hand-built (byte-pinned by the widget suites). */

/** List items flattened to the widget's chrome data ({id, task, checked,
 *  cls, children_slot}) — the TableEditorBlock flat-data boundary; the task
 *  checkbox verb (toggleTaskChecked, ONE undo step) lives in the widget's
 *  ext bridge now. */
function listEditItems(node: BlockNode, ctx: AssemblyCtx) {
  return node.children.map((item) => {
    const task = attrGet(item.attrs, 'checked') != null
    return {
      id: item.id,
      task,
      checked: attrGetBool(item.attrs, 'checked', false),
      cls: 'list-item' + (task ? ' task-item' : ''),
      children_slot: () => item.children.map((ch) => childSlot(ch, ctx)),
    }
  })
}

/** A child of an expanded container: on the focus path → recursive assembly
 *  (deepest focused leaf mounts the BlockHost); off it → preview subtree in
 *  its own clickable slot. */
function childSlot(ch: BlockNode, ctx: AssemblyCtx): VNode {
  if (ch.id === ctx.focusedId || ctx.path.has(ch.id)) return viewVNode(assembleView(ch, ctx, false))
  return slotChrome(ch, previewVNodeOf(ch), false, ctx.counter)
}

function viewVNode(v: BlockView): VNode {
  return h(v.view as Parameters<typeof h>[0], v.props)
}

/** One assembled node: focused leaf → edit face / BlockHost (plan 023 P1T3
 *  contract, bare — no node-slot); focus-path container → expanded chrome;
 *  everything else → preview slot. VNode-producing views go through the
 *  stable AssemblyView shell (see its comment). plan 039 T4b: the focused
 *  face rides the SAME slotChrome as preview (structural parity — see the
 *  comment inside; revises plan 029's bare-host mounting). */
function assembleView(node: BlockNode, ctx: AssemblyCtx, topLevel: boolean): BlockView {
  if (node.id === ctx.focusedId) {
    // plan 039 T4b (engine-layer focus parity — revises plan 029's
    // bare-host ruling): the focused face mounts INSIDE the same slotChrome
    // as its preview twin. The two faces of one block are structurally
    // identical now, so structure-sensitive host logic (the demo's
    // scroll-sync margin injections, any future VM layout keyed on the
    // slot) sees ONE shape, not two — the 1-4px focus-toggle jump dies at
    // the root instead of being patched per consumer. The semantic host
    // keeps its own data-block-id (adapter host lookup); getBlockMap
    // dedupes to the slot.
    const edit = editSlotFor(BlockType[node.kind])
    if (edit) {
      return {
        id: node.id,
        view: AssemblyView,
        props: {
          render: () =>
            slotChrome(node, edit(node, { engine, blockId: node.id, readonly: props.streaming === true }), topLevel, ctx.counter, false),
          key: `edit:${node.id}:${historyEpoch.value}`,
        },
      }
    }
    if (isEditableLeaf(node)) {
      const controller = hostFor(node.id)
      const level = node.kind === BlockType.Heading ? attrGetInt(node.attrs, 'level', 1) : undefined
      return {
        id: node.id,
        view: AssemblyView,
        props: {
          render: () =>
            slotChrome(
              node,
              h(RichTextHost, {
                controller,
                // flat chrome data (plan 034 D4): the widget derives tag/cls from
                // blockKind/level itself (the host-face computation is absorbed);
                // initial_html is the mount-once rich snapshot, evaluated here —
                // the engine is not Vue-reactive, the snapshot never invalidates.
                blockId: controller.id,
                blockKind: BlockType[node.kind],
                level: level ?? 0,
                initial_html: spansToHtml(controller.inlines),
                // The face lives in the key: a kind/level flip mid-typing (input
                // rules) must REMOUNT the host. <component :is> would swap the
                // DOM element under the caret without re-running onMounted —
                // focus lands nowhere and every post-flip keystroke is lost.
                // The remount re-focuses at end (plan 029; rules match only a
                // whole-block marker, so the caret IS at end on every flip).
                key: `host:${node.id}:${BlockType[node.kind]}:${level ?? ''}:${historyEpoch.value}:${docEpoch.value}`,
              }),
              topLevel,
              ctx.counter,
              false,
            ),
        },
      }
    }
    // a focused non-hostable node (empty container / ThematicBreak) degrades
    // to preview — selection resolution normally never lands here
  }
  if (ctx.path.has(node.id) && isExpandableContainer(node)) {
    // plan 042 T2: the family edit slot from the registry (the retired
    // hand-rolled dispatch), fed with the assembly's recursion closures —
    // children for Callout/Details/Blockquote, items for ListBlock (the
    // edit face reads whichever prop its widget takes).
    const edit = editSlotFor(BlockType[node.kind])
    if (edit) {
      return {
        id: node.id,
        view: AssemblyView,
        props: {
          render: () =>
            slotChrome(node, edit(node, {
              engine,
              blockId: node.id,
              readonly: props.streaming === true,
              children: () => node.children.map((ch) => childSlot(ch, ctx)),
              items: () => listEditItems(node, ctx),
              version: repaintVersion.value,
            }), topLevel, ctx.counter),
        },
      }
    }
  }
  return {
    id: node.id,
    view: AssemblyView,
    props: { render: () => slotChrome(node, previewVNodeOf(node), topLevel, ctx.counter) },
  }
}

function isExpandableContainer(node: BlockNode): boolean {
  // plan 030: Callout/Details keep their card chrome while a child is
  // focused (029's WYSIWYG ruling extended to container blocks)
  return (
    node.children.length > 0 &&
    (node.kind === BlockType.ListBlock ||
      node.kind === BlockType.Blockquote ||
      node.kind === BlockType.Callout ||
      node.kind === BlockType.Details)
  )
}

// -- host registry -------------------------------------------------------------------

const hosts = new Map<string, BlockHostController>()

function hostFor(blockId: string): BlockHostController {
  let c = hosts.get(blockId)
  if (!c) {
    c = new BlockHostController(engine, blockId)
    hosts.set(blockId, c)
  }
  return c
}

// -- frozen expose contract (EDITOR-CONTRACT.md) ---------------------------------------
// BlockInfo lives in the plain <script> block above (dual-script type exports).

/** getBlockMap parity: DOM-anchored block geometry for scroll sync. */
function getBlockMap(): BlockInfo[] {
  const out: BlockInfo[] = []
  const content = wrapper.value
  if (!content) return out
  const els = Array.from(content.querySelectorAll<HTMLElement>('[data-block-id]'))
  els.forEach((el, i) => {
    out.push({
      id: el.dataset.blockId ?? '',
      index: i,
      pos: i,
      el,
      top: el.offsetTop,
      height: el.offsetHeight,
    })
  })
  return out
}

function selectBlock(id: string, deepTargetId?: string): void {
  // deep selection (plan 025 P1T1): a clicked container resolves to its
  // first focusable descendant — containers never host. A resolved click
  // (click-caret's container/table hit) names the descendant the user
  // actually pointed at, which wins over the first-leaf default.
  const found = findBlock(engine.doc, id)
  if (!found) return
  const deep = deepTargetId && deepTargetId !== id ? findBlock(engine.doc, deepTargetId) : null
  const target = (deep && focusTargetOf(deep) === deep ? deep : null) ?? focusTargetOf(found) ?? found
  const p = new BlockPos(target.id, 0)
  engine.select(new Selection(p, p))
  repaintVersion.value++
}

function onContentKeydown(e: KeyboardEvent): void {
  // undo/redo wiring (plan 028 P0T1): Ctrl/Cmd+Z (Shift variant) and
  // Ctrl/Cmd+Y. While any host is mid-composition the IME owns the key
  // stream — pass through untouched.
  const action = historyActionOf(e)
  if (action) {
    if (Array.from(hosts.values()).some((c) => c.composition.composing)) return
    e.preventDefault()
    if (runHistory(engine, hosts.values(), action)) historyEpoch.value++
    return
  }
  if (e.ctrlKey && e.key === 'End') {
    e.preventDefault()
    const last = lastFocusTargetOf(engine.doc)
    if (last) selectBlock(last.id)
  }
}

function focusFirstBlock(): void {
  const first = focusTargetOf(engine.doc)
  if (first) {
    const p = new BlockPos(first.id, 0)
    engine.select(new Selection(p, p))
  }
}

focusFirstBlock()

function emitSave(): void {
  emit('save', serialize(engine.doc, true))
}

defineExpose({ getBlockMap, handleSave: emitSave })
</script>
