<template>
  <div class="markdown-renderer">
    <template v-for="(vnode, i) in rendered" :key="i">
      <component :is="vnode" />
    </template>
  </div>
</template>

<script setup lang="ts">
// Self-hosted markdown renderer (plan 008, Phase 3): replaces the
// markstream-vue MarkdownRender dependency. The parse layer is the
// Auto-generated parser (moved to @autodown/core in plan 016 Phase 2;
// markdown-parser.generated is a compatibility redirect);
// the VNode rendering lives in render-node.ts and keeps the DOM structure
// (node-slot/node-content wrappers, data-node-type, pre[data-language],
// table-node, code-block-header) compatible so downstream chrome (scroll
// sync, code headers, CSS overrides) keeps working.
//
// Scheduling semantics (batchRendering / maxLiveNodes windowing /
// typewriter) are driven by use-render-scheduler on top of the Auto
// scheduling decisions (auto/render_scheduler.at); the timer goes through
// an injectable port (VM backends supply their own adapter).
import { computed, onMounted, ref } from 'vue'
import { parseDocument } from './markdown-parser.generated'
import { stripAnchorTokens } from '../parser/markdown-parser'
import { renderNodes } from './render-node'
import { useRenderScheduler } from './use-render-scheduler'

const props = withDefaults(
  defineProps<{
    content?: string
    final?: boolean
    batchRendering?: boolean
    initialRenderBatchSize?: number
    renderBatchSize?: number
    renderBatchDelay?: number
    typewriter?: boolean
    fade?: boolean
    maxLiveNodes?: number
  }>(),
  {
    content: '',
    final: true,
    batchRendering: true,
    initialRenderBatchSize: 40,
    renderBatchSize: 80,
    renderBatchDelay: 16,
    typewriter: false,
    fade: true,
    maxLiveNodes: 320,
  }
)

// ^block-anchors are file-level metadata: strip them (fence-aware) so the
// read view never renders the tokens, matching the editor's applyAnchorsDeep.
const allNodes = computed(() => parseDocument(stripAnchorTokens(props.content ?? ''), props.final))

// SSR / non-batched path renders everything synchronously
const ssrNodes = computed(() => renderNodes(allNodes.value, props.final))

const scheduler = useRenderScheduler(allNodes, {
  enabled: props.batchRendering,
  batchSize: props.renderBatchSize,
  batchDelay: props.renderBatchDelay,
  maxLiveNodes: props.maxLiveNodes,
  typewriter: props.typewriter && !props.final,
  typewriterChunk: 2,
})

const isServer = typeof window === 'undefined'
const mounted = ref(false)
const clientNodes = computed(() =>
  renderNodes(scheduler.visibleNodes.value, props.final, scheduler.typewriterChars.value)
)
const rendered = computed(() => (isServer || !mounted.value ? ssrNodes.value : clientNodes.value))

// keep the SSR (full) tree until hydration completes, then hand over to the
// batched scheduler
onMounted(() => {
  mounted.value = true
})
</script>
