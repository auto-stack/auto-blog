<!-- MermaidBlockWidget component - Auto-generated from Auto language -->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { renderMermaidPreview, scheduleMermaidRender, focusCodeArea, textareaRows, nodeText, ctxReadonly, ctxBlockId, codeController, editOnlyAttr, viewMarker } from '../ext/mermaid_block_widget_ext'


const props = defineProps<{
  mode: string
  node: any
  ctx: any
  final: boolean
}>()

const view_svg = ref<string>('')
const view_error = ref<string>('')
const draft = ref<any>(nodeText(props.node))
const svg = ref<string>('')
const error_text = ref<string>('')
const loading = ref<boolean>(false)
const controller = ref<any>(codeController(props.ctx))

const area = ref<HTMLElement | null>(null)

const is_edit = computed<boolean>(() => props.mode === 'edit')
const source = computed<any>(() => nodeText(props.node))
const readonly = computed<any>(() => ctxReadonly(props.ctx))
const root_class = computed<any>(() => (is_edit.value ? (readonly.value ? 'autodown-mermaid-editor is-readonly' : 'autodown-mermaid-editor') : 'autodown-mermaid-block'))
const root_mermaid_marker = computed<any>(() => viewMarker(props.mode))
const root_block_id = computed<any>(() => editOnlyAttr(props.mode, ctxBlockId(props.ctx)))
const root_node_type = computed<any>(() => editOnlyAttr(props.mode, 'Mermaid'))
const show_edit_preview = computed<boolean>(() => loading.value === false && !(error_text.value) && !!(svg.value))
const show_edit_error = computed<boolean>(() => loading.value === false && !!(error_text.value))
const rows_value = computed<any>(() => textareaRows(draft.value))
const show_view_preview = computed<boolean>(() => !!(view_svg.value))
const show_view_error = computed<boolean>(() => !(view_svg.value) && !!(view_error.value))
const code_tag = computed<string>(() => 'code')

const emit = defineEmits<{
  Init: []
  AreaInput: [any]
  Blur: [any]
}>()

watch(source, () => {
  if (!is_edit.value) {if (source.value.trim() == '') {view_svg.value = '';
  view_error.value = '';
  }if (source.value.trim() != '') {let p = renderMermaidPreview(source.value);
  p.then((res: any) => { view_svg.value = res.svg;
  view_error.value = res.error;
   });
  }}
})

function AreaInput(e: any): void {
  draft.value = e.target.value;
  loading.value = true;
  scheduleMermaidRender(draft.value, (res: any) => { svg.value = res.svg;
  error_text.value = res.error;
  loading.value = res.loading;
   });

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
  loading.value = true;
  scheduleMermaidRender(source.value, (res: any) => { svg.value = res.svg;
  error_text.value = res.error;
  loading.value = res.loading;
   });
  }
  if (!is_edit.value) {
  if (source.value.trim() == '') {view_svg.value = '';
  view_error.value = '';
  }if (source.value.trim() != '') {let p = renderMermaidPreview(source.value);
  p.then((res: any) => { view_svg.value = res.svg;
  view_error.value = res.error;
   });
  }}
})


</script>

<template>
    <div :class="root_class" :data-block-id="root_block_id" :data-mermaid-block="root_mermaid_marker" :data-node-type="root_node_type">
      <template v-if="is_edit">
        <template v-if="readonly">
          <div class="autodown-stream-banner">
            <span>流式生成中</span>
          </div>
        </template>
        <div class="mermaid-editor-stack">
          <template v-if="show_edit_preview">
            <div class="autodown-mermaid-preview" v-html="svg" />
          </template>
          <template v-if="show_edit_error">
            <div class="autodown-mermaid-error" :title="'Mermaid render error'">
              <span>{{ error_text }}</span>
            </div>
          </template>
          <template v-if="loading">
            <div class="mermaid-editor-loading">
              <span>渲染中…</span>
            </div>
          </template>
          <textarea class="mermaid-editor-textarea" :disabled="readonly" ref="area" :rows="rows_value" :spellcheck="'false'" v-model="draft" @blur="Blur($event)" @input="AreaInput($event)" />
        </div>
      </template>
      <template v-if="! is_edit">
        <template v-if="show_view_preview">
          <div class="autodown-mermaid-preview" v-html="view_svg" />
        </template>
        <template v-if="show_view_error">
          <div class="autodown-mermaid-error" :title="'Mermaid render error'">
            <span>{{ view_error }}</span>
          </div>
        </template>
        <pre class="mermaid-source">
          <component :is="(code_tag) as any" />
        </pre>
      </template>
    </div>

</template>

<style>
/* Component styles */

</style>

<style scoped>

        .autodown-mermaid-block {
          border: 1px solid hsl(var(--border, 220 13% 91%));
          border-radius: 0.375rem;
          background: hsl(var(--card, 0 0% 100%));
          overflow: hidden;
        }
        .autodown-mermaid-preview {
          padding: 0.75rem 1rem;
          overflow-x: auto;
        }
        .autodown-mermaid-preview :deep(svg) {
          margin: 0 auto;
          display: block;
        }
        .autodown-mermaid-error {
          padding: 0.5rem 1rem;
          font-size: 0.75rem;
          color: hsl(var(--destructive, 0 72% 51%));
          background: hsl(var(--destructive/10, 0 72% 51% / 0.1));
        }
        .mermaid-source {
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
        .autodown-mermaid-editor {
          border: 1px solid hsl(var(--border, 220 13% 91%));
          border-radius: 0.375rem;
          background: hsl(var(--card, 0 0% 100%));
          overflow: hidden;
        }
        .autodown-mermaid-editor.is-readonly {
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
        .mermaid-editor-stack {
          display: flex;
          flex-direction: column;
        }
        .mermaid-editor-stack .autodown-mermaid-preview {
          border-bottom: 1px solid #e5e7eb;
          background: #ffffff;
        }
        .mermaid-editor-stack .autodown-mermaid-preview :deep(svg) {
          max-width: 100%;
        }
        .mermaid-editor-stack .autodown-mermaid-error {
          border-bottom: 1px solid #e5e7eb;
        }
        .mermaid-editor-loading {
          padding: 0.5rem 1rem;
          font-size: 0.75rem;
          color: hsl(var(--muted-foreground, 220 9% 46%));
          background: hsl(var(--muted, 210 20% 96%));
          border-bottom: 1px solid #e5e7eb;
          user-select: none;
        }
        .mermaid-editor-textarea {
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
        .mermaid-editor-textarea:disabled {
          cursor: not-allowed;
        }
    </style>
