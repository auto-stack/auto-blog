<!-- CodeBlockWidget component - Auto-generated from Auto language -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { renderCodeHighlight, focusCodeArea, resizeCodeArea, syncCodeHighlight, nodeLanguage, nodeText, nodeLoading, ctxReadonly, ctxBlockId, codeController, viewCodeInner, editCodeInner, rootDataLanguage, draftCodeOf, captureCodeClick, takePendingCodeCaret, nodeIdOf } from '../ext/code_block_widget_ext'


const props = defineProps<{
  mode: string
  node: any
  ctx: any
  final: boolean
}>()

const code_draft = ref<any>(draftCodeOf(props.node))
const controller = ref<any>(codeController(props.ctx))

const hl = ref<HTMLElement | null>(null)
const area = ref<HTMLElement | null>(null)

const is_edit = computed<boolean>(() => props.mode === 'edit')
const language = computed<any>(() => nodeLanguage(props.node))
const code = computed<any>(() => nodeText(props.node))
const readonly = computed<any>(() => ctxReadonly(props.ctx))
const block_id = computed<any>(() => ctxBlockId(props.ctx))
const loading = computed<any>(() => nodeLoading(props.node))
const root_class = computed<any>(() => (is_edit.value ? 'code-block-container rounded-lg border autodown-codeblock-node' : (loading.value ? 'code-block-container rounded-lg border autodown-block-placeholder is-loading' : 'code-block-container rounded-lg border')))
const root_data_language = computed<any>(() => rootDataLanguage(props.mode, language.value))
const badge_label = computed<any>(() => (!(language.value) ? 'text' : language.value))
const pre_class = computed<string>(() => 'language-' + badge_label.value + ' code-pre-fallback is-wrap')
const aria_busy = computed<any>(() => (loading.value ? 'true' : 'false'))
const view_inner_html = computed<any>(() => viewCodeInner(code.value, language.value))
const edit_code_inner = computed<any>(() => editCodeInner(code_draft.value, language.value))

const emit = defineEmits<{
  Init: []
  AreaInput: [any]
  AreaScroll: [any]
  Blur: [any]
  ViewClick: [any]
}>()

function AreaInput(v: any): void {


  resizeCodeArea(area.value!);
  syncCodeHighlight(area.value!, hl.value!);

  emit('AreaInput', v)
}

function AreaScroll(e: any): void {
  syncCodeHighlight(e.target, hl.value!);

  emit('AreaScroll', e)
}

function Blur(e: any): void {
  if (!readonly.value) {let c = controller.value;
  c.commitDraft(e.target.value);
  }

  emit('Blur', e)
}

function ViewClick(e: any): void {


  captureCodeClick(e, nodeIdOf(props.node));

  emit('ViewClick', e)
}

onMounted(() => {
  if (is_edit.value) {focusCodeArea(area.value!, readonly.value, takePendingCodeCaret(block_id.value));
  syncCodeHighlight(area.value!, hl.value!);
  }
})


</script>

<template>
    <div :class="root_class" :data-language="root_data_language">
      <template v-if="is_edit">
        <div class="autodown-code-editor" :class="{ 'is-readonly': readonly }" :data-block-id="block_id" :data-node-type="'Fence'">
          <template v-if="readonly">
            <div class="autodown-stream-banner">
              <span>流式生成中</span>
            </div>
          </template>
          <div class="code-block-header flex justify-between items-center">
            <button class="code-header-trigger" :data-codeblock-language-badge="''" :title="'切换语言'" :type="'button'">
              <span class="code-header-title">
                <span>{{ language }}</span>
              </span>
              <span class="code-header-caret">
                <span>▾</span>
              </span>
            </button>
            <div class="flex items-center gap-0.5">
              <button class="code-action-btn" :data-codeblock-copy-btn="''" :title="'复制'" :type="'button'">
                <span class="codeblock-copy-icon" />
              </button>
              <button class="code-action-btn" :data-codeblock-expand-btn="''" :title="'折叠'" :type="'button'">
                <span class="codeblock-expand-icon" />
              </button>
            </div>
          </div>
          <div class="code-editor-stack">
            <pre class="code-editor-highlight" :aria-hidden="'true'" v-html="edit_code_inner" ref="hl" />
            <textarea class="code-editor-textarea" :disabled="readonly" ref="area" :spellcheck="'false'" v-model="code_draft" @blur="Blur($event)" @input="AreaInput(($event.target as HTMLInputElement).value)" @scroll="AreaScroll($event)" />
          </div>
        </div>
      </template>
      <template v-if="! is_edit">
        <div class="code-block-header flex justify-between items-center">
          <button class="code-header-trigger" :data-codeblock-language-badge="''" :title="'切换语言'" :type="'button'">
            <span class="code-header-title">
              <span>{{ language }}</span>
            </span>
            <span class="code-header-caret">
              <span>▾</span>
            </span>
          </button>
          <div class="flex items-center gap-0.5">
            <button class="code-action-btn" :data-codeblock-copy-btn="''" :title="'复制'" :type="'button'">
              <span class="codeblock-copy-icon" />
            </button>
            <button class="code-action-btn" :data-codeblock-expand-btn="''" :title="'折叠'" :type="'button'">
              <span class="codeblock-expand-icon" />
            </button>
          </div>
        </div>
        <pre :class="pre_class" :aria-busy="aria_busy" :data-language="language" v-html="view_inner_html" :tabindex="'0'" @click="ViewClick($event)" />
      </template>
    </div>

</template>

<style>
/* Component styles */

</style>

<style scoped>

        /* plan 039 T7: the container chrome (border/radius/background) lives
           on the shared root (code-block-container) — this wrapper only
           positions the readonly banner. */
        .autodown-code-editor {
          position: relative;
        }
        .autodown-code-editor.is-readonly {
          opacity: 0.75;
        }
        /* the in-header language trigger (CodeBlockMenu badge contract) */
        .code-header-trigger {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.1rem 0.4rem;
          margin-left: -0.4rem;
          border: 1px solid transparent;
          border-radius: 4px;
          background: transparent;
          color: inherit;
          font: inherit;
          cursor: pointer;
        }
        .code-header-trigger:hover {
          border-color: #9ca3af;
        }
        .code-header-caret {
          font-size: 0.6rem;
          line-height: 1;
          opacity: 0.7;
        }
        /* plan 039 T13: the view/stream faces keep the header pixel-identical
           to the plain title bar until hover — the caret affordance is
           transparent (and the trigger border hidden) until the user points
           at the language item. The edit face keeps the always-on caret. */
        .code-block-container:not(.autodown-codeblock-node) .code-header-caret {
          opacity: 0;
        }
        .code-block-container:not(.autodown-codeblock-node) .code-header-trigger:hover .code-header-caret {
          opacity: 0.7;
        }
        .autodown-stream-banner {
          padding: 0.3rem 0.75rem;
          font-size: 0.8rem;
          font-weight: 500;
          color: #92400e;
          background: #fef3c7;
          border-bottom: 1px solid #fcd34d;
          user-select: none;
        }
        .code-editor-stack {
          position: relative;
        }
        .code-editor-highlight {
          position: absolute;
          inset: 0;
          margin: 0;
          box-sizing: border-box;
          /* View-face pre mirror (font metrics, not just padding): the view
             pre inherits 0.95rem/1.6 from .autodown-editor-content and its
             STRUT inflates every line box to 24.32px even though the glyphs
             are the code child's 0.88rem/1.5. Mirroring the same font/leading
             here makes the line boxes identical, so the focus swap changes
             nothing — no height jump, no glyph reflow. The code child picks
             the shared `.autodown-editor-content pre code` rule (0.88rem/1.5)
             exactly like the view face does, and 0.85em/1em resolves to the
             same 12.92px/15.2px padding. */
          padding: 0.85em 1em;
          border: none;
          overflow: hidden;
          pointer-events: none;
          background: transparent;
          color: #111827;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.95rem;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .code-editor-textarea {
          display: block;
          width: 100%;
          box-sizing: border-box;
          min-height: 3rem;
          /* same 12.92px/15.2px padding as the highlight pre above */
          padding: 0.8075rem 0.95rem;
          border: none;
          outline: none;
          resize: none;
          overflow: hidden;
          background: transparent;
          /* overlay plan 024 P4T1: the highlight pre below shows the text;
             the caret stays visible via caret-color */
          color: transparent;
          caret-color: #111827;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          /* glyph metrics stay the code face (0.88rem) so caret advances
             match the painted glyphs; the leading goes to the view pre's
             24.32px line boxes (1.6 × 0.95rem) so line k of the textarea
             lands on line k of the overlay — the half-leading distributes
             identically on both sides. */
          font-size: 0.88rem;
          line-height: 1.52rem;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .code-editor-textarea:disabled {
          cursor: not-allowed;
        }
    </style>
