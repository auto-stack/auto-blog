<!-- MathBlockWidget component - Auto-generated from Auto language -->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { renderMathBlockPreview, renderKatexPreview, focusCodeArea, textareaRows, nodeText, ctxReadonly, ctxBlockId, codeController, editOnlyAttr, viewMarker } from '../ext/math_block_widget_ext'


const props = defineProps<{
  mode: string
  node: any
  ctx: any
  final: boolean
}>()

const view_html = ref<string>('')
const view_error = ref<string>('')
const draft = ref<any>(nodeText(props.node))
const controller = ref<any>(codeController(props.ctx))

const area = ref<HTMLElement | null>(null)

const is_edit = computed<boolean>(() => props.mode === 'edit')
const source = computed<any>(() => nodeText(props.node))
const readonly = computed<any>(() => ctxReadonly(props.ctx))
const root_class = computed<any>(() => (is_edit.value ? (readonly.value ? 'autodown-math-editor is-readonly' : 'autodown-math-editor') : 'autodown-math-block'))
const root_math_marker = computed<any>(() => viewMarker(props.mode))
const root_block_id = computed<any>(() => editOnlyAttr(props.mode, ctxBlockId(props.ctx)))
const root_node_type = computed<any>(() => editOnlyAttr(props.mode, 'MathBlock'))
const edit_preview_html = computed<any>(() => renderKatexPreview(draft.value, true)?.html)
const edit_error_text = computed<any>(() => renderKatexPreview(draft.value, true)?.error)
const show_edit_preview = computed<boolean>(() => !(edit_error_text.value))
const show_edit_error = computed<boolean>(() => !!(edit_error_text.value))
const rows_value = computed<any>(() => textareaRows(draft.value))
const show_view_preview = computed<boolean>(() => !(view_error.value))
const show_view_error = computed<boolean>(() => !!(view_error.value))
const code_tag = computed<string>(() => 'code')

const emit = defineEmits<{
  Init: []
  AreaInput: [any]
  Blur: [any]
}>()

watch(source, () => {
  if (!is_edit.value) {let result = renderMathBlockPreview(source.value);
  view_html.value = result.html;
  view_error.value = result.error;
  }
})

function AreaInput(e: any): void {
  draft.value = e.target.value;

  emit('AreaInput', e)
}

function Blur(e: any): void {
  if (!readonly.value) {let c = controller.value;
  c.commit(e.target.value);
  }

  emit('Blur', e)
}

onMounted(() => {
  if (is_edit.value) {focusCodeArea(area.value!, readonly.value);
  }
  if (!is_edit.value) {
  let result = renderMathBlockPreview(source.value);
  view_html.value = result.html;
  view_error.value = result.error;
  }
})


</script>

<template>
    <div :class="root_class" :data-block-id="root_block_id" :data-math-block="root_math_marker" :data-node-type="root_node_type">
      <template v-if="is_edit">
        <template v-if="readonly">
          <div class="autodown-stream-banner">
            <span>流式生成中</span>
          </div>
        </template>
        <div class="math-editor-stack">
          <template v-if="show_edit_preview">
            <div class="autodown-math-preview" v-html="edit_preview_html" />
          </template>
          <template v-if="show_edit_error">
            <div class="autodown-math-error" :title="'Math preview error'">
              <span>{{ edit_error_text }}</span>
            </div>
          </template>
          <textarea class="math-editor-textarea" :disabled="readonly" ref="area" :rows="rows_value" :spellcheck="'false'" v-model="draft" @blur="Blur($event)" @input="AreaInput($event)" />
        </div>
      </template>
      <template v-if="! is_edit">
        <template v-if="show_view_preview">
          <div class="autodown-math-preview" v-html="view_html" />
        </template>
        <template v-if="show_view_error">
          <div class="autodown-math-error" :title="'Math preview error'">
            <span>{{ view_error }}</span>
          </div>
        </template>
        <pre class="math-block-source">
          <component :is="(code_tag) as any" />
        </pre>
      </template>
    </div>

</template>

<style>
/* Component styles */

</style>

<style scoped>

        .autodown-math-block {
          border: 1px solid hsl(var(--border, 220 13% 91%));
          border-radius: 0.375rem;
          background: hsl(var(--card, 0 0% 100%));
          overflow: hidden;
        }
        .autodown-math-preview {
          padding: 0.75rem 1rem;
          overflow-x: auto;
        }
        .autodown-math-preview :deep(.katex-display) {
          margin: 0;
        }
        .autodown-math-error {
          padding: 0.5rem 1rem;
          font-size: 0.75rem;
          color: hsl(var(--destructive, 0 72% 51%));
          background: hsl(var(--destructive/10, 0 72% 51% / 0.1));
        }
        .math-block-source {
          margin: 0;
          border-top: 1px solid hsl(var(--border, 220 13% 91%));
          border-radius: 0;
          background: hsl(var(--muted, 210 20% 96%));
          padding: 0.5rem 0.75rem;
          font-size: 0.75rem;
          color: hsl(var(--muted-foreground, 220 9% 46%));
          /* the hole stays EMPTY by design (preview carries the content);
             normal collapses the generated template's indentation
             whitespace — the old NodeViewContent component rendered no
             text nodes, pre-wrap would bill two phantom lines (~40px) */
          white-space: normal;
        }
        /* family container chrome (plan 033 T7): ONE set of values for the
           container in every mode — the view face's document-card chrome is
           the family canon (the 031 edit face's gray #f8f9fa card is
           retired; parity suite pins border/radius/background equality). */
        .autodown-math-editor {
          border: 1px solid hsl(var(--border, 220 13% 91%));
          border-radius: 0.375rem;
          background: hsl(var(--card, 0 0% 100%));
          overflow: hidden;
        }
        .autodown-math-editor.is-readonly {
          opacity: 0.75;
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
        .math-editor-stack {
          display: flex;
          flex-direction: column;
        }
        .math-editor-stack .autodown-math-preview {
          border-bottom: 1px solid #e5e7eb;
          background: #ffffff;
        }
        .math-editor-stack .autodown-math-error {
          border-bottom: 1px solid #e5e7eb;
        }
        .math-editor-textarea {
          display: block;
          width: 100%;
          box-sizing: border-box;
          min-height: 3rem;
          max-height: 24rem;
          padding: 0.6rem 0.75rem;
          border: none;
          outline: none;
          resize: none;
          overflow: auto;
          background: transparent;
          color: #111827;
          caret-color: #111827;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.88rem;
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .math-editor-textarea:disabled {
          cursor: not-allowed;
        }
    </style>
