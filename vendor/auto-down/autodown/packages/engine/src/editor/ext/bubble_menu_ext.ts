// bubble_menu_ext.ts — Hand-written TS extension for the BubbleMenu widget
// (../bubble_menu.at). The gen pipeline copies this file into the transient
// gen project (never type-checked there) and deploys it verbatim to
// src/editor/ext/bubble_menu_ext.ts; the generated BubbleMenu.vue imports it
// from ../ext/bubble_menu_ext (gen.mjs E1 rewrite).
//
// The button list itself (names, tooltips, active flags, actions) lives in
// the widget DSL. What remains here genuinely cannot be expressed in the DSL
// (plan 021 Phase 2 retarget — everything now speaks engine, no Tiptap):
//
// 1. EngineBubbleMenu — the selection bubble host. Tiptap's BubbleMenu
//    wrapper is replaced by a local component over the ENGINE handle: the
//    editor prop is the engine adapter bag (`__engine` carries the session),
//    visibility is re-derived on every engine change, and the menu floats
//    above the anchor block element. v1 caveat: the engine selection is
//    block-granular (anchor/focus BlockPos), so `state.selection.empty` is
//    true for every real selection and the bubble stays hidden until the
//    inline-mark/selection extension lands (plan 018 Phase 4 deferral,
//    handed over with plan 020). The DOM contract when visible matches the
//    old wrapper: a positioned div carrying the widget's class + buttons.
// 2. bubbleIcon — the static lucide icon set. The `dyn (.btn.icon)` pattern
//    carries icon components as data; the DSL cannot import npm-package
//    components as plain values, so the name → component map stays here.
// 3. bubbleShouldShow — the host calls it with an engine-faithful
//    { editor, state } (state.selection.empty = collapsed block selection)
//    and needs a boolean RETURN value; DSL msg handlers always return void.
// 4. runBubbleLink — the link action's if/else + window.prompt body needs a
//    block-body closure, which computed expressions do not support. The
//    mark buttons (incl. the underline restored in plan 028 P2T3) go through
//    the chain adapter's real toggle* commands — Bold-style DOM wrap, the
//    model catches up on the blur writeback.

import { defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue'
import { computeMenuPosition, type TriggerRect } from '../composables/useMenuBounds'
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Underline,
} from 'lucide-vue-next'
import { Mark } from '../../parser/block-model'
import { activeMarksAtCaret, domSelectionAdapter } from '../engine/selection-adapter'
import type { EditorEngine } from '../engine/editor-engine'

// The static lucide icon set, looked up by button name from the widget's
// buttons computed and rendered via `dyn (.btn.icon)`.
const BUBBLE_ICONS = {
  bold: Bold,
  italic: Italic,
  underline: Underline,
  strike: Strikethrough,
  code: Code,
  link: LinkIcon,
} as const

export function bubbleIcon(name: keyof typeof BUBBLE_ICONS): unknown {
  return BUBBLE_ICONS[name]
}

// shouldShow for the engine host: editable editor + a non-collapsed
// selection, OR (plan-062 T-04) a collapsed caret sitting inside a marked
// token — the cancel channel. state.marks is engineStateOf's caret-mark
// read (marksAtRange collapsed semantics); non-engine editors omit it and
// keep the selection-only behavior.
export function bubbleShouldShow({
  editor,
  state,
}: {
  editor: any
  state: { selection: { empty: boolean }; marks?: unknown[] }
}): boolean {
  if (!editor.isEditable || editor.isActive('image')) {
    return false
  }
  const { empty } = state.selection
  if (!empty) return true
  return Array.isArray(state.marks) && state.marks.length > 0
}

// The link button's action: unset an active link, otherwise prompt for a
// URL and set it. Generated prop defaults are NOT applied at runtime (no
// withDefaults), so `prompt ?? 'Enter URL'` is handled here.
export function runBubbleLink(editor: any, prompt: string | null | undefined): void {
  if (editor.isActive('link')) {
    editor.chain().focus().unsetLink?.().run()
  } else {
    const url = window.prompt(prompt ?? 'Enter URL')
    if (url) {
      editor.chain().focus().setLink?.({ href: url }).run()
    }
  }
}

// Engine-side state derivation for shouldShow: the engine selection is
// collapsed (empty) when anchor and head coincide.
function engineStateOf(engine: EditorEngine): { selection: { empty: boolean } } {
  const sel = engine.selection
  const empty =
    sel.anchor.blockId === sel.head.blockId && sel.anchor.offset === sel.head.offset
  return { selection: { empty } }
}

// The selection bubble host (engine replacement for tiptap's BubbleMenu).
// Renders a positioned div (the widget's class + the button slot) whenever
// shouldShow accepts the current engine state; visibility re-derives on
// every engine change (the engine is not Vue-reactive). Dismisses on
// outside pointerdown and Escape, like the old plugin.
const EngineBubbleMenu = defineComponent({
  name: 'EngineBubbleMenu',
  props: {
    editor: { type: Object, default: null },
    options: { type: Object, default: null },
    shouldShow: { type: Function, default: null },
  },
  setup(props, { slots }) {
    const visible = ref(false)
    const top = ref('0px')
    const left = ref('0px')
    const menuEl = ref<HTMLElement | null>(null)
    let unsubscribe: (() => void) | null = null

    // plan 024 P3T2: the live DOM selection is the truth source for a
    // selection bubble — the engine selection (block-granular baseline,
    // range-synced by EngineEditor's selectionchange bridge) drives the
    // shouldShow/isActive semantics, but a collapsed DOM selection always
    // hides regardless of what the engine still holds.
    const derive = (): void => {
      const engine: EditorEngine | undefined = props.editor?.__engine
      if (!engine) {
        visible.value = false
        return
      }
      // plan-062 T-04: caret-only moves do not bump the adapter tick on
      // their own — bump here so the active-state computeds re-evaluate.
      props.editor?.__bump?.()
      const sel = typeof window === 'undefined' ? null : window.getSelection()
      // plan-062 T-04: a collapsed caret is no longer auto-hidden — the
      // cancel channel shows the bubble on a marked token under the caret
      // (shouldShow decides; the caret rect positions it). No DOM selection
      // at all still hides.
      const domRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null
      if (!domRange) {
        visible.value = false
        return
      }
      // plan-062 T-04: collapsed caret → the marks enclosing the caret via
      // the live DOM selection (the engine selection does not track bare
      // caret moves, so the DOM adapter is the truth source here).
      let marks: unknown[] | undefined = undefined
      if (domRange.collapsed) {
        marks = activeMarksAtCaret()
      }
      const ctx = { editor: props.editor, state: { ...engineStateOf(engine), marks } }
      visible.value = props.shouldShow ? Boolean(props.shouldShow(ctx)) : false
      if (!visible.value) return
      // positioning: float above the selection rect (computeMenuPosition
      // 'top' placement, the only placement the widget requests).
      const anchor = (domRange.startContainer.nodeType === 3
        ? domRange.startContainer.parentElement
        : (domRange.startContainer as HTMLElement))?.closest<HTMLElement>('.autodown-block-host')
      const scope = anchor?.closest<HTMLElement>('.autodown-editor')
      if (!anchor || !scope || !scope.contains(anchor)) {
        visible.value = false
        return
      }
      const rect = domRange.getBoundingClientRect()
      const scopeRect = scope.getBoundingClientRect()
      const trigger: TriggerRect = {
        top: rect.top - scopeRect.top,
        left: rect.left - scopeRect.left,
        bottom: rect.bottom - scopeRect.top,
        right: rect.right - scopeRect.left,
        width: rect.width,
        height: rect.height,
      }
      const pos = computeMenuPosition(
        trigger,
        menuEl.value?.offsetWidth ?? 0,
        menuEl.value?.offsetHeight ?? 0,
        { width: scope.clientWidth, height: scope.clientHeight },
        'top',
      )
      left.value = `${pos.left}px`
      top.value = `${pos.top}px`
    }

    const onPointerDown = (e: PointerEvent): void => {
      if (visible.value && !(e.target as HTMLElement | null)?.closest?.('.autodown-bubble-menu')) {
        visible.value = false
      }
    }
    const onKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && visible.value) visible.value = false
    }

    const listener = (): void => derive()
    onMounted(() => {
      const engine: EditorEngine | undefined = props.editor?.__engine
      if (engine) {
        engine.onChange(listener)
        unsubscribe = () => {
          // EditorEngine has no off(); listeners live for the editor's
          // lifetime, so the unsubscribe is a no-op tombstone.
        }
      }
      document.addEventListener('pointerdown', onPointerDown)
      document.addEventListener('keydown', onKeydown)
      document.addEventListener('selectionchange', listener)
      derive()
    })
    onBeforeUnmount(() => {
      unsubscribe?.()
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeydown)
      document.removeEventListener('selectionchange', listener)
    })

    return () =>
      visible.value
        ? h(
            'div',
            {
              ref: menuEl,
              class: 'autodown-bubble-menu',
              style: { position: 'absolute', top: top.value, left: left.value },
              // plan 024 P3T2: preventDefault keeps the contenteditable
              // host focused (and its selection alive) through button
              // clicks — the mark chains wrap the live host DOM.
              onMousedown: (e: MouseEvent) => e.preventDefault(),
            },
            slots.default?.()
          )
        : null
  },
})

// Exported under the widget's historical import name (`component:
// TiptapBubbleMenu from "ext/bubble_menu_ext.ts"`) — the widget source stays
// byte-stable while the implementation is engine-native.
export { EngineBubbleMenu as TiptapBubbleMenu }
