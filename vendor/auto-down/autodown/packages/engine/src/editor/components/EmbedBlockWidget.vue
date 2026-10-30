<!-- EmbedBlockWidget component - Auto-generated from Auto language -->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { embedTitle, embedBlockId, blockLoader, errorMessage } from '../ext/embed_block_widget_ext'


const props = defineProps<{
  mode: string
  node: any
  ctx: any
  final: boolean
}>()

const block = ref<any>(null)
const loading = ref<boolean>(false)
const error_text = ref<string>('')

const title_value = computed<any>(() => embedTitle(props.node))
const block_id = computed<any>(() => embedBlockId(props.node))
const display_label = computed<any>(() => (block_id.value != null ? (!!(title_value.value) ? title_value.value + '#' + block_id.value : block_id.value) : title_value.value))
const loading_text = computed<string>(() => 'Loading ' + display_label.value + '…' || 'Loading…')
const block_content = computed<any>(() => block.value && block.value.content || '')
const show_loading = computed<boolean>(() => loading.value || !props.final)
const show_error = computed<boolean>(() => props.final && !loading.value && !!(error_text.value))
const show_block = computed<any>(() => props.final && !loading.value && !(error_text.value) && block.value)
const show_header = computed<boolean>(() => props.final && !loading.value && !(error_text.value))

const emit = defineEmits<{
  Init: []
}>()

watch(block_id, async () => {
  if (props.final) {if (block_id.value != null) {let loader = blockLoader();
  if (loader == null) {error_text.value = 'No block loader configured';
  }if (loader != null) {loading.value = true;
  error_text.value = '';
  try {let result = (await loader(block_id.value));
  block.value = result;
  if (!result) {error_text.value = 'Block not found';
  }} catch (e) {error_text.value = errorMessage(e);
  block.value = null;
  } finally {loading.value = false;
  }
  }}}
})

onMounted(async () => {


  if (props.final) {if (block_id.value != null) {let loader = blockLoader();
  if (loader == null) {error_text.value = 'No block loader configured';
  }if (loader != null) {loading.value = true;
  error_text.value = '';
  try {let result = (await loader(block_id.value));
  block.value = result;
  if (!result) {error_text.value = 'Block not found';
  }} catch (e) {error_text.value = errorMessage(e);
  block.value = null;
  } finally {loading.value = false;
  }
  }}}
})


</script>

<template>
    <div class="autodown-block-embed" :data-title="title_value">
      <template v-if="show_loading">
        <div class="embed-state">
          <span>{{ loading_text }}</span>
        </div>
      </template>
      <template v-if="show_error">
        <div class="embed-state embed-error">
          <span>{{ error_text }}</span>
        </div>
      </template>
      <template v-if="show_header">
        <div class="embed-header">
          <span class="embed-title">
            <span>{{ display_label }}</span>
          </span>
        </div>
      </template>
      <template v-if="show_block">
        <div class="embed-content">
          <span>{{ block_content }}</span>
        </div>
      </template>
    </div>

</template>

<style>
/* Component styles */

</style>

<style scoped>

        .autodown-block-embed {
          border: 1px solid hsl(var(--border, 220 13% 91%));
          border-radius: 0.375rem;
          background: hsl(var(--muted, 210 20% 96%));
          padding: 0.75rem;
          margin: 0.5rem 0;
        }
        .embed-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .embed-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: hsl(var(--primary, 238 55% 58%));
        }
        .embed-content {
          font-size: 0.875rem;
          color: hsl(var(--foreground, 224 64% 33%));
          white-space: pre-wrap;
        }
        .embed-state {
          font-size: 0.75rem;
          color: hsl(var(--muted-foreground, 220 9% 46%));
        }
        .embed-error {
          color: hsl(var(--destructive, 0 72% 51%));
        }
    </style>
