<!-- QueryBlockWidget component - Auto-generated from Auto language -->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { queryText, queryRunner, normalizeQueryResults, errorMessage } from '../ext/query_block_widget_ext'


const props = defineProps<{
  mode: string
  node: any
  ctx: any
  final: boolean
}>()

const results = ref<any[]>([])
const loading = ref<boolean>(false)
const error_text = ref<string>('')

const query_text = computed<any>(() => queryText(props.node))
const code_tag = computed<string>(() => 'code')
const ul_tag = computed<string>(() => 'ul')
const li_tag = computed<string>(() => 'li')
const show_loading = computed<boolean>(() => loading.value || !props.final)
const show_error = computed<boolean>(() => props.final && !loading.value && !!(error_text.value))
const show_results = computed<boolean>(() => props.final && !loading.value && !(error_text.value) && results.value.length > 0)
const show_empty = computed<boolean>(() => props.final && !loading.value && !(error_text.value) && results.value.length === 0)

const emit = defineEmits<{
  Init: []
}>()

watch(query_text, async () => {
  if (props.final) {let run = queryRunner();
  if (run == null || query_text.value == '') {error_text.value = 'No query runner configured';
  }if (run != null && query_text.value != '') {loading.value = true;
  error_text.value = '';
  try {let res = (await run(query_text.value));
  results.value = normalizeQueryResults(res);
  } catch (e) {error_text.value = errorMessage(e);
  results.value = [];
  } finally {loading.value = false;
  }
  }}
})

onMounted(async () => {


  if (props.final) {let run = queryRunner();
  if (run == null || query_text.value == '') {error_text.value = 'No query runner configured';
  }if (run != null && query_text.value != '') {loading.value = true;
  error_text.value = '';
  try {let res = (await run(query_text.value));
  results.value = normalizeQueryResults(res);
  } catch (e) {error_text.value = errorMessage(e);
  results.value = [];
  } finally {loading.value = false;
  }
  }}
})


</script>

<template>
    <div class="autodown-query-block" :data-query-block="''">
      <div class="query-header">
        <span class="query-label">
          <span>Query</span>
        </span>
        <component :is="(code_tag) as any" class="query-code">
          <span>{{ query_text }}</span>
        </component>
      </div>
      <template v-if="show_loading">
        <div class="query-state">
          <span>Loading query…</span>
        </div>
      </template>
      <template v-if="show_error">
        <div class="query-state query-error">
          <span>{{ error_text }}</span>
        </div>
      </template>
      <template v-if="show_results">
        <component :is="(ul_tag) as any" class="query-results">
          <component :is="(li_tag) as any" class="query-result" :key="idx" v-for="(result, idx) in results">
            <span class="result-marker">
              <span>{{ result.marker }}</span>
            </span>
            <template v-if="result.priority">
              <span class="result-priority">
                <span>{{ result.priority_label }}</span>
              </span>
            </template>
            <span class="result-content">
              <span>{{ result.content }}</span>
            </span>
            <span class="result-source">
              <span>{{ result.source }}</span>
            </span>
          </component>
        </component>
      </template>
      <template v-if="show_empty">
        <div class="query-state">
          <span>No results</span>
        </div>
      </template>
    </div>

</template>

<style>
/* Component styles */

</style>

<style scoped>

        .autodown-query-block {
          border: 1px solid hsl(var(--border, 220 13% 91%));
          border-radius: 0.375rem;
          background: hsl(var(--card, 0 0% 100%));
          padding: 0.75rem;
          margin: 0.5rem 0;
        }
        .query-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .query-label {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: hsl(var(--primary, 238 55% 58%));
        }
        .query-code {
          font-size: 0.75rem;
          color: hsl(var(--muted-foreground, 220 9% 46%));
          background: hsl(var(--muted, 210 20% 96%));
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
        }
        .query-state {
          font-size: 0.75rem;
          color: hsl(var(--muted-foreground, 220 9% 46%));
        }
        .query-error {
          color: hsl(var(--destructive, 0 72% 51%));
        }
        .query-results {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .query-result {
          font-size: 0.8rem;
          display: flex;
          align-items: baseline;
          gap: 0.35rem;
        }
        .result-marker {
          font-weight: 600;
          color: hsl(var(--primary, 238 55% 58%));
        }
        .result-priority {
          font-weight: 600;
          color: hsl(var(--amber-600, 45 93% 47%));
        }
        .result-content {
          flex: 1;
          color: hsl(var(--foreground, 224 64% 33%));
        }
        .result-source {
          font-size: 0.7rem;
          color: hsl(var(--muted-foreground, 220 9% 46%));
        }
    </style>
