// auto_down_editor_ext.ts — Hand-written TS extension for the
// AutoDownEditor widget (../auto_down_editor.at). The gen pipeline copies
// this file into the transient gen project (never type-checked there) and
// deploys it verbatim to src/editor/ext/auto_down_editor_ext.ts; the
// generated AutoDownEditor.vue imports it from ../ext/auto_down_editor_ext
// (gen.mjs E1 rewrite). DEPLOY NOTE: unlike the other six bridges this one
// deploys with the Phase 3 menu batch — its BubbleMenu/TableMenu/
// CodeBlockMenu re-exports only resolve once those generated SFCs land in
// src/editor/menus/.
//
// plan 021 Phase 2 retarget (Tiptap → engine). The ASSEMBLY surface the
// widget needs is now built from engine primitives:
//
// - useAutoDownEditorBridge — creates the EditorEngine session (parse_blocks
//   of the content prop) and returns a reactive { items, editor } bag.
//   `editor` is the chain adapter (createEditorAdapter) extended with the
//   assembly surface: getMarkdown (serialize, emitIds=true like
//   EngineEditor), commands.setContent (replaceDoc), setEditable, isFocused,
//   and __engine (the session itself — the slash manifest's Block link
//   command reads it). Lifecycle events are forwarded through inst.emit
//   using the widget's quoted msg variants. The 30-item slash manifest is
//   SINGLE-SOURCED from ../slash-manifest (the plan 018 deployment) —
//   engine idioms, zero duplication.
// - EditorContent — the engine content host: focused editable leaf blocks
//   render through BlockHost (BlockHostController), every other block
//   renders through the ./render preview pipeline — the same live-preview
//   compromise as the handwritten EngineEditor.vue (design §8 v1). Compact
//   bridge-native version; the Phase 4 assembly evaluation decides whether
//   this hardens into the deployed assembly or EngineEditor stays the
//   handwritten platform shell.
// - appendTableIAL — identity: the engine serializer owns IAL emission
//   (table cols/rows attrs round-trip as {cols:[..]} text, plan 016 S4),
//   so the Tiptap-era save-time IAL re-append has no engine counterpart.
// - blockMapOf — the engine block-map (DOM-anchored, EDITOR-CONTRACT §3)
//   scoped to the content host element stashed on the handle.
// - normalizeAnchors / editorCheckIcon / editorXIcon — unchanged in kind
//   (regex; lucide re-exports for the `dyn` render trick).
//
// No @tiptap imports anywhere; the editor instance is the engine handle.

import { defineComponent, getCurrentInstance, h, onMounted, reactive, ref } from 'vue'
import type { VNode } from 'vue'
import { Check, X } from 'lucide-vue-next'
import type { SlashItem } from '../menus/slashItem'
import { getSlashItems } from '../slash-manifest'
import { EditorEngine } from '../engine/editor-engine'
import { createEditorAdapter } from '../engine/tiptap-adapter'
import { BlockHostController, isEditableLeaf } from '../engine/host-controller'
import RichTextHost from '../components/RichTextHost.vue'
import { getBlockMap } from '../block-map'
import { BlockNode, BlockType } from '../../parser/block-model'
import { parse_blocks, parseDocument } from '../../parser/markdown-parser'
import { serialize } from '../../parser/serializer'
import { renderNodes } from '../../render/render-node'
import { spansToHtml } from '../engine/rich-html'

// -- menu / content component re-exports (the widget's `component:` use) ----
// SlashMenu is the Phase 2 revival; the other three menus are the Phase 3
// generated products. EngineContentHost is local (see below).
export { default as SlashMenu } from '../menus/SlashMenu.vue'
export { default as BubbleMenu } from '../menus/BubbleMenu.vue'
export { default as CodeBlockMenu } from '../menus/CodeBlockMenu.vue'

// Lucide icons for the Save/Cancel buttons, rendered via `dyn` (the
// codeBlockCheckIcon trick).
export function editorCheckIcon(): unknown {
  return Check
}

export function editorXIcon(): unknown {
  return X
}

// The original's normalizeAnchors: strip trailing ` ^blockId` anchors per
// line before comparing editor content with the incoming prop (the DSL has
// no regex literals).
export function normalizeAnchors(md: string): string {
  return md
    .split('\n')
    .map((line) => line.replace(/\s+\^[a-zA-Z0-9_-]+\s*$/, ''))
    .join('\n')
}

// The original's save-time IAL post-process. Engine: identity — the
// serializer already emits table IAL from block attrs (plan 016 S4), so
// there is nothing to re-append. Kept as a named export because the widget
// source calls it (byte-stable .at contract).
export function appendTableIAL(md: string, _editor: unknown): string {
  return md
}

// The exposed imperative getBlockMap — the engine block-map scoped to this
// editor's content wrapper (stashed on the handle by EngineContentHost).
export function blockMapOf(editor: any): ReturnType<typeof getBlockMap> {
  return getBlockMap(editor?.__contentEl ?? null)
}

// -- the engine content host (EditorContent replacement) ---------------------
//
// Renders the engine document: the focused editable leaf block through
// RichTextHost (plan 034), every other block through the render preview pipeline
// (EngineEditor.vue's live-preview compromise, compact bridge-native
// port). The class attr falls through from the widget
// (autodown-editor-content-wrapper).

const EngineContentHost = defineComponent({
  name: 'EngineContentHost',
  props: {
    editor: { type: Object, default: null },
  },
  setup(props, { attrs }) {
    const tick = ref(0)
    const hosts = new Map<string, BlockHostController>()

    const engine = (): EditorEngine | undefined => (props.editor as any)?.__engine

    const hostFor = (blockId: string): BlockHostController => {
      let c = hosts.get(blockId)
      if (!c) {
        const e = engine()
        if (!e) throw new Error('EngineContentHost: engine handle missing')
        c = new BlockHostController(e, blockId)
        hosts.set(blockId, c)
      }
      return c
    }

    onMounted(() => {
      const e = engine()
      if (e) e.onChange(() => { tick.value++ })
      const inst = getCurrentInstance()
      const el = (inst?.proxy?.$el as HTMLElement | undefined) ?? null
      if (el && props.editor) (props.editor as any).__contentEl = el
    })

    return () => {
      void tick.value
      const e = engine()
      const kids: VNode[] = []
      if (e) {
        const focusedId = e.selection.anchor.blockId
        const previewMd = e.doc.children
          .filter((n) => !(n.id === focusedId && isEditableLeaf(n)))
          .map((n) => serialize({ ...e.doc, children: [n] } as BlockNode, false))
          .join('\n')
        const preview = renderNodes(parseDocument(previewMd, true), true)
        let previewIdx = 0
        e.doc.children.forEach((node) => {
          if (node.id === focusedId && isEditableLeaf(node)) {
            const host = hostFor(node.id)
            kids.push(
              // plan 034: RichTextHost flat props (blockId/level/initial_html
              // derived here — same adapter shape as EngineEditor's assembly).
              h(RichTextHost, {
                controller: host,
                blockId: host.id,
                blockKind: BlockType[node.kind],
                level: 0,
                initial_html: spansToHtml(host.inlines),
                key: node.id,
              })
            )
            return
          }
          const vnode = preview[previewIdx]
          previewIdx += 1
          kids.push(
            h(
              'div',
              {
                class: 'node-slot',
                'data-node-index': String(previewIdx - 1),
                'data-node-type': BlockType[node.kind],
                'data-block-id': node.id,
                key: node.id,
              },
              [h('div', { class: 'node-content' }, [vnode ?? h('div', { class: 'unknown-node' })])]
            )
          )
        })
      }
      return h('div', { ...attrs, class: ['autodown-editor-content-wrapper', attrs.class] }, [
        h('div', { class: 'autodown-editor-content', 'data-engine-editor': '' }, kids),
      ])
    }
  },
})

// Exported under the widget's historical import name (`component:
// EditorContent from "ext/auto_down_editor_ext.ts"`).
export { EngineContentHost as EditorContent }

// -- the editor-creating composable ------------------------------------------
//
// The codegen calls it ONCE at <script setup> top level with ZERO
// arguments, so the options are assembled here from the component
// instance's props. Returns a reactive `{ items, editor }` bag;
// reactive() keeps the handle linked so `.autoDownEditorBridge.editor` is
// live everywhere in the widget. The handle REF is also merged into the
// widget's exposed surface on mount (defineExpose runs at setup end, so
// the merge defers to onMounted) — the e2e harness reads the raw
// exposed ref shape.

export function useAutoDownEditorBridge(): { items: SlashItem[]; editor: any } {
  const inst = getCurrentInstance()!
  const props = inst.props as any

  const slashItems = getSlashItems(props)

  const session = new EditorEngine(parse_blocks(String(props.content ?? ''), true))
  const editor = createEditorAdapter(session) as any
  editor.__engine = session
  editor.getMarkdown = (): string => serialize(session.doc, true)
  editor.isFocused = session.selection.anchor.blockId !== ''
  editor.setEditable = (v: boolean): void => {
    editor.isEditable = v
  }
  editor.commands = {
    setContent(md: string, _opts?: { emitUpdate?: boolean; contentType?: string }): void {
      if (md != null && md !== serialize(session.doc, true)) {
        session.replaceDoc(parse_blocks(md, true))
      }
    },
  }
  session.onChange(() => {
    inst.emit('update', serialize(session.doc, true))
  })

  onMounted(() => {
    if (inst.exposed) {
      ;(inst.exposed as any).editor = editor
    }
  })

  return reactive({ items: slashItems, editor })
}
