<!-- CalloutBlockWidget component - Auto-generated from Auto language -->
<script setup lang="ts">
import { computed } from 'vue'
import { AttrHost } from '../ext/container_ext'
import { BlockChildren } from '../ext/container_ext'
import { nodeAttrStr, calloutTypeKnown, ctxReadonly, ctxBlockId, ctxEngine, htmlText } from '../ext/container_ext'


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
const type = computed<any>(() => nodeAttrStr(props.node, 'type'))
const known = computed<any>(() => calloutTypeKnown(type.value))
const title = computed<any>(() => nodeAttrStr(props.node, 'title'))
const title_fallback = computed<any>(() => (!!(title.value) ? title.value : type.value))
const title_html = computed<any>(() => htmlText(title_fallback.value))
const placeholder = computed<any>(() => (!!(type.value) ? type.value : '标题'))
const root_class = computed<string>(() => 'callout-node autodown-callout autodown-callout-' + type.value)
const icon_class = computed<string>(() => 'autodown-callout-icon autodown-callout-icon-' + type.value)


</script>

<template>
    <div :class="root_class" :data-callout-type="type">
      <template v-if="is_edit">
        <template v-if="readonly">
          <div class="autodown-stream-banner">
            <span>流式生成中</span>
          </div>
        </template>
      </template>
      <div class="autodown-callout-header">
        <template v-if="known">
          <span :class="icon_class" :aria-hidden="'true'" />
        </template>
        <template v-if="is_edit">
          <AttrHost :attr_key="'title'" :blockId="block_id" :controller="engine_ref" :host_class="'autodown-callout-title'" :placeholder="placeholder" :readonly="readonly" :value="title" :version="version" :key="'AttrHost-1'" />
        </template>
        <template v-if="! is_edit">
          <div class="autodown-callout-title" :dir="'auto'" v-html="title_html" />
        </template>
      </div>
      <div class="autodown-callout-content">
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
