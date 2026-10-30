<!-- BlockquoteBlockWidget component - Auto-generated from Auto language -->
<script setup lang="ts">
import { computed } from 'vue'
import { BlockChildren } from '../ext/container_ext'


const props = defineProps<{
  mode: string
  node: any
  ctx: any
  final: boolean
  children: any
  version: number
}>()

const is_edit = computed<boolean>(() => props.mode === 'edit')


</script>

<template>
    <blockquote class="blockquote" :dir="'auto'">
      <template v-if="is_edit">
        <div class="markdown-renderer">
          <BlockChildren :children_slot="children" :key="'BlockChildren-1'" />
        </div>
      </template>
      <template v-if="! is_edit">
        <BlockChildren :children_slot="children" :key="'BlockChildren-2'" />
      </template>
    </blockquote>

</template>

<style>
/* Component styles */

</style>
