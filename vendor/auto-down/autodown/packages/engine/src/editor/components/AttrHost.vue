<!-- AttrHost component - Auto-generated from Auto language -->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { mountAttrHost, syncAttrFromModel, commitAttr, blurAttrHost } from '../ext/attr_host_ext'


const props = defineProps<{
  controller: any
  blockId: string
  attr_key: string
  value: string
  placeholder: string
  host_class: string
  readonly: boolean
  version: number
}>()

const host = ref<HTMLElement | null>(null)

const editable = computed<boolean>(() => !props.readonly)
const host_cls = computed<string>(() => 'autodown-attr-host ' + props.host_class)

const emit = defineEmits<{
  Init: []
  KeyEnter: []
  KeyEscape: []
  Blur: [any]
}>()

watch(() => props.version, () => {
  syncAttrFromModel(host.value!, props.controller, props.blockId, props.attr_key);
})

function Blur(e: any): void {
  commitAttr(e.target, props.controller, props.blockId, props.attr_key, props.readonly);

  emit('Blur', e)
}

function KeyEnter(): void {
  blurAttrHost(host.value!);

  emit('KeyEnter')
}

function KeyEscape(): void {
  blurAttrHost(host.value!);

  emit('KeyEscape')
}

onMounted(() => {
  mountAttrHost(host.value!, props.value);
})


</script>

<template>
    <span :class="host_cls" :contenteditable="editable" :data-placeholder="placeholder" ref="host" :spellcheck="'false'" @blur="Blur($event)" @keydown.enter.prevent="KeyEnter" @keydown.esc.prevent="KeyEscape" />

</template>

<style>
/* Component styles */

</style>
