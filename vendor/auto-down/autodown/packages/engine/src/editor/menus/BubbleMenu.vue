<!-- BubbleMenu component - Auto-generated from Auto language -->
<script setup lang="ts">
import { computed } from 'vue'
import { TiptapBubbleMenu } from '../ext/bubble_menu_ext'
import { bubbleIcon, bubbleShouldShow, runBubbleLink } from '../ext/bubble_menu_ext'


const props = withDefaults(defineProps<{
  editor: any
  linkPrompt?: string
  tooltips?: any
}>(), {
  linkPrompt: 'Enter URL',
  tooltips: null,
})

const buttons = computed<any[]>(() => [{name: 'bold', title: props.tooltips && props.tooltips.bold || 'Bold', icon: bubbleIcon('bold'), active: props.editor.isActive('bold'), action: () => props.editor.chain().focus().toggleBold().run()}, {name: 'italic', title: props.tooltips && props.tooltips.italic || 'Italic', icon: bubbleIcon('italic'), active: props.editor.isActive('italic'), action: () => props.editor.chain().focus().toggleItalic().run()}, {name: 'underline', title: props.tooltips && props.tooltips.underline || 'Underline', icon: bubbleIcon('underline'), active: props.editor.isActive('underline'), action: () => props.editor.chain().focus().toggleUnderline().run()}, {name: 'strike', title: props.tooltips && props.tooltips.strike || 'Strikethrough', icon: bubbleIcon('strike'), active: props.editor.isActive('strike'), action: () => props.editor.chain().focus().toggleStrike().run()}, {name: 'code', title: props.tooltips && props.tooltips.code || 'Inline Code', icon: bubbleIcon('code'), active: props.editor.isActive('code'), action: () => props.editor.chain().focus().toggleCode().run()}, {name: 'link', title: props.tooltips && props.tooltips.link || 'Link', icon: bubbleIcon('link'), active: props.editor.isActive('link'), action: () => runBubbleLink(props.editor, props.linkPrompt)}])

const emit = defineEmits<{
  RunButton: [any]
}>()

function RunButton(btn: any): void {
  btn.action();

  emit('RunButton', btn)
}


</script>

<template>
    <template v-if="editor">
      <TiptapBubbleMenu :class="'autodown-bubble-menu'" :editor="editor" :options="{placement: 'top'}" :shouldShow="bubbleShouldShow" :key="'TiptapBubbleMenu-1'">
        <button class="autodown-bubble-btn" :class="{ active: btn.active }" :key="btn.title" :title="btn.title" @click="RunButton(btn)" v-for="btn in buttons">
          <component :is="(btn.icon) as any" :size="14" />
        </button>
      </TiptapBubbleMenu>
    </template>

</template>

<style>
/* Component styles */

</style>
