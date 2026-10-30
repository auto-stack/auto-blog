<!-- DetailsBlockWidget component - Auto-generated from Auto language -->
<script setup lang="ts">
import { computed } from 'vue'
import { AttrHost } from '../ext/container_ext'
import { BlockChildren } from '../ext/container_ext'
import { nodeAttrStr, nodeAttrBool, blockRef, toggleDetailsOpen, ctxReadonly, ctxBlockId, ctxEngine } from '../ext/container_ext'


const props = defineProps<{
  mode: string
  node: any
  ctx: any
  final: boolean
  children: any
  version: number
}>()

const is_edit = computed<boolean>(() => props.mode === 'edit')
const readonly = computed<any>(() => ctxReadonly(props.ctx))
const block_id = computed<any>(() => ctxBlockId(props.ctx))
const engine_ref = computed<any>(() => ctxEngine(props.ctx))
const block_ref = computed<any>(() => blockRef(props.node, props.ctx))
const is_open = computed<any>(() => nodeAttrBool(props.node, 'open'))
const marker = computed<any>(() => (is_open.value ? '▼' : '▶'))
const summary = computed<any>(() => nodeAttrStr(props.node, 'summary'))
const summary_text = computed<any>(() => (!!(summary.value) ? summary.value : 'Details'))

const emit = defineEmits<{
  ToggleOpen: []
}>()

function ToggleOpen(): void {
  toggleDetailsOpen(engine_ref.value, block_ref.value, is_open.value);

  emit('ToggleOpen')
}


</script>

<template>
    <div class="autodown-details" :data-open="is_open">
      <div class="autodown-details-summary">
        <span class="autodown-details-marker" :aria-hidden="'true'" :title="'点击展开详细内容'" @click.stop="ToggleOpen">
          <span>{{ marker }}</span>
        </span>
        <template v-if="is_edit">
          <AttrHost :attr_key="'summary'" :blockId="block_ref" :controller="engine_ref" :host_class="'autodown-details-summary-text'" :placeholder="'Details'" :readonly="readonly" :value="summary" :version="version" :key="'AttrHost-1'" />
        </template>
        <template v-if="! is_edit">
          <span class="autodown-details-summary-text" @click.stop="ToggleOpen">
            <span>{{ summary_text }}</span>
          </span>
        </template>
      </div>
      <div class="autodown-details-content" v-show="is_open">
        <template v-if="is_edit">
          <div class="markdown-renderer">
            <BlockChildren :children_slot="children" :key="'BlockChildren-2'" />
          </div>
        </template>
        <template v-if="! is_edit">
          <BlockChildren :children_slot="children" :key="'BlockChildren-3'" />
        </template>
      </div>
    </div>

</template>

<style>
/* Component styles */

</style>
