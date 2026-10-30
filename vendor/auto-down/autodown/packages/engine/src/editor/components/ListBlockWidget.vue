<!-- ListBlockWidget component - Auto-generated from Auto language -->
<script setup lang="ts">
import { computed } from 'vue'
import { BlockChildren } from '../ext/container_ext'
import { nodeAttrBool, nodeAttrInt, editOrderedStart, toggleTaskChecked, ctxEngine } from '../ext/container_ext'


const props = defineProps<{
  mode: string
  node: any
  ctx: any
  final: boolean
  items: any
  version: number
}>()

const is_edit = computed<boolean>(() => props.mode === 'edit')
const engine_ref = computed<any>(() => ctxEngine(props.ctx))
const ordered = computed<any>(() => nodeAttrBool(props.node, 'ordered'))
const tag = computed<any>(() => (ordered.value ? 'ol' : 'ul'))
const list_class = computed<any>(() => (ordered.value ? 'list-node list-decimal' : 'list-node list-disc'))
const ordered_start = computed<any>(() => editOrderedStart(props.mode, ordered.value, nodeAttrInt(props.node, 'start')))
const task_disabled = computed<boolean>(() => !is_edit.value)
const task_label = computed<any>(() => (is_edit.value ? 'toggle task' : 'task checkbox'))

const emit = defineEmits<{
  TaskClick: [any]
}>()

function TaskClick(item: any): void {
  toggleTaskChecked(engine_ref.value, item.id);

  emit('TaskClick', item)
}


</script>

<template>
    <component :is="(tag) as any" :class="list_class" :start="ordered_start">
      <li :class="item.cls" :dir="'auto'" :key="item.id" v-for="(item, i_i) in items">
        <template v-if="item.task">
          <input class="task-checkbox" :aria-label="task_label" :checked="item.checked" :disabled="task_disabled" :type="'checkbox'" @click.stop="TaskClick(item)" />
        </template>
        <template v-if="is_edit">
          <div class="markdown-renderer">
            <BlockChildren :children_slot="item.children_slot" :key="'BlockChildren-1-' + i_i" />
          </div>
        </template>
        <template v-if="! is_edit">
          <BlockChildren :children_slot="item.children_slot" :key="'BlockChildren-2-' + i_i" />
        </template>
      </li>
    </component>

</template>

<style>
/* Component styles */

</style>
