<!-- RichTextHost component - Auto-generated from Auto language -->
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { hostTag, hostCls, mountHost, hostInput, hostKeydown, hostPaste, hostCompositionBegin, hostCompositionUpdate, hostCompositionCommit, hostFocus, hostBlur } from '../ext/rich_text_host_ext'


const props = defineProps<{
  controller: any
  blockId: string
  blockKind: string
  level: number
  initial_html: string
}>()

const tag = computed<any>(() => hostTag(props.blockKind, props.level))
const cls = computed<any>(() => hostCls(props.blockKind, props.level))

const emit = defineEmits<{
  Init: []
  ClickStop: [any]
  Input: [any]
  Keydown: [any]
  Paste: [any]
  Focus: [any]
  Blur: [any]
  CompositionStart: [any]
  CompositionUpdate: [any]
  CompositionEnd: [any]
}>()

function Blur(e: any): void {
  hostBlur(e.target, props.controller);

  emit('Blur', e)
}

function ClickStop(e: any): void {

  emit('ClickStop', e)
}

function CompositionEnd(e: any): void {
  hostCompositionCommit(e.target, props.controller);

  emit('CompositionEnd', e)
}

function CompositionStart(e: any): void {
  hostCompositionBegin(e.target, props.controller);

  emit('CompositionStart', e)
}

function CompositionUpdate(e: any): void {
  hostCompositionUpdate(e, props.controller);

  emit('CompositionUpdate', e)
}

function Focus(e: any): void {
  hostFocus(e.target, props.controller);

  emit('Focus', e)
}

function Input(e: any): void {
  hostInput(e.target, props.controller);

  emit('Input', e)
}

function Keydown(e: any): void {
  hostKeydown(e, props.controller);

  emit('Keydown', e)
}

function Paste(e: any): void {
  hostPaste(e, props.controller);

  emit('Paste', e)
}

onMounted(() => {
  mountHost(props.initial_html, props.blockId);
})


</script>

<template>
    <component :is="(tag) as any" :class="cls" :contenteditable="true" :data-block-id="blockId" :data-node-type="blockKind" :dir="'auto'" :spellcheck="'false'" @blur="Blur($event)" @click.stop="ClickStop($event)" @compositionend="CompositionEnd($event)" @compositionstart="CompositionStart($event)" @compositionupdate="CompositionUpdate($event)" @focus="Focus($event)" @input="Input($event)" @keydown="Keydown($event)" @paste="Paste($event)" />

</template>

<style>
/* Component styles */

</style>
