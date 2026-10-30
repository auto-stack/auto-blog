<!-- SlashMenu component - Auto-generated from Auto language -->
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { computeMenuPosition } from '../ext/slash_menu_ext'
import { nextTick } from 'vue'


const props = withDefaults(defineProps<{
  editor: any
  items: any[]
  noResultsText?: string
}>(), {
  noResultsText: 'No results',
})

const visible = ref<boolean>(false)
const query = ref<string>('')
const range = ref<any>(null)
const selected_index = ref<number>(0)
const pos_top = ref<string>('')
const pos_left = ref<string>('')
const pos_visibility = ref<string>('')

const menuEl = ref<HTMLElement | null>(null)

const filtered = computed<any>(() => props.items.filter((item) => [item.title, item.description].concat(item.searchTerms).join(' ').toLowerCase().includes(query.value.toLowerCase())))
const is_empty = computed<boolean>(() => filtered.value.length === 0)
const empty_text = computed<any>(() => (props.noResultsText ?? 'No results'))

const emit = defineEmits<{
  OnOpen: [any]
  OnUpdate: [any]
  OnClose: []
  OnKeydown: [any]
  SelectItem: [any]
  HoverItem: [any]
}>()

watch(filtered, () => {
  selected_index.value = 0;
})

function HoverItem(i: any): void {
  selected_index.value = i;

  emit('HoverItem', i)
}

function OnClose(): void {
  visible.value = false;
  query.value = '';
  range.value = null;
  selected_index.value = 0;

  emit('OnClose')
}

function OnKeydown(e: any): void {
  if (visible.value) {if (e.detail.event.key == 'ArrowDown') {e.detail.event.preventDefault();



  let next: number = selected_index.value + 1;
  selected_index.value = next %filtered.value.length;


  nextTick(() => { if (menuEl.value!) {let active = menuEl.value!.querySelector('.autodown-slash-menu-item.active');
  if (active != null) {active.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }} });


  if (props.editor.storage['slash-command'] != null) {props.editor.storage['slash-command'].handled = true;
  }}if (e.detail.event.key == 'ArrowUp') {e.detail.event.preventDefault();
  let prev: number = selected_index.value - 1 + filtered.value.length;
  selected_index.value = prev %filtered.value.length;
  nextTick(() => { if (menuEl.value!) {let active = menuEl.value!.querySelector('.autodown-slash-menu-item.active');
  if (active != null) {active.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }} });
  if (props.editor.storage['slash-command'] != null) {props.editor.storage['slash-command'].handled = true;
  }}if (e.detail.event.key == 'Enter' || e.detail.event.key == 'NumpadEnter') {e.detail.event.preventDefault();



  let item = filtered.value[selected_index.value];
  if (item != null && range.value != null) {item.command({ editor: props.editor, range: range.value });
  visible.value = false;
  query.value = '';
  range.value = null;
  selected_index.value = 0;
  }if (props.editor.storage['slash-command'] != null) {props.editor.storage['slash-command'].handled = true;
  }}if (e.detail.event.key == 'Escape') {e.detail.event.preventDefault();
  visible.value = false;
  query.value = '';
  range.value = null;
  selected_index.value = 0;
  if (props.editor.storage['slash-command'] != null) {props.editor.storage['slash-command'].handled = true;
  }}}

  emit('OnKeydown', e)
}

function OnOpen(e: any): void {
  query.value = e.detail.query;
  range.value = e.detail.range;
  visible.value = true;
  selected_index.value = 0;





  nextTick(() => { if (range.value != null && props.editor['view']) {let coords = props.editor['view'].coordsAtPos(range.value.from);
  let editorEl = props.editor['view'].dom.closest('.autodown-editor');
  if (editorEl != null) {let rect = editorEl.getBoundingClientRect();
  let trigger = { top: coords.top - rect.top, left: coords.left - rect.left, bottom: coords.bottom - rect.top, right: coords.right - rect.left, width: coords.right - coords.left, height: coords.bottom - coords.top };
  let container = { width: rect.width, height: rect.height };
  let initial = computeMenuPosition(trigger, 0, 0, container, 'bottom', 8, 'left');
  pos_top.value = initial.top + 'px';
  pos_left.value = initial.left + 'px';
  pos_visibility.value = 'hidden';
  nextTick(() => { 



  let menu = editorEl.querySelector('.autodown-slash-menu');
  if (menu != null) {let menuRect = menu.getBoundingClientRect();
  let pos_final = computeMenuPosition(trigger, menuRect.width, menuRect.height, container, 'bottom', 8, 'left');
  pos_top.value = pos_final.top + 'px';
  pos_left.value = pos_final.left + 'px';
  pos_visibility.value = 'visible';
  } });
  }} });

  emit('OnOpen', e)
}

function OnUpdate(e: any): void {
  query.value = e.detail.query;
  range.value = e.detail.range;
  nextTick(() => { if (range.value != null && props.editor['view']) {let coords = props.editor['view'].coordsAtPos(range.value.from);
  let editorEl = props.editor['view'].dom.closest('.autodown-editor');
  if (editorEl != null) {let rect = editorEl.getBoundingClientRect();
  let trigger = { top: coords.top - rect.top, left: coords.left - rect.left, bottom: coords.bottom - rect.top, right: coords.right - rect.left, width: coords.right - coords.left, height: coords.bottom - coords.top };
  let container = { width: rect.width, height: rect.height };
  let initial = computeMenuPosition(trigger, 0, 0, container, 'bottom', 8, 'left');
  pos_top.value = initial.top + 'px';
  pos_left.value = initial.left + 'px';
  pos_visibility.value = 'hidden';
  nextTick(() => { let menu = editorEl.querySelector('.autodown-slash-menu');
  if (menu != null) {let menuRect = menu.getBoundingClientRect();
  let pos_final = computeMenuPosition(trigger, menuRect.width, menuRect.height, container, 'bottom', 8, 'left');
  pos_top.value = pos_final.top + 'px';
  pos_left.value = pos_final.left + 'px';
  pos_visibility.value = 'visible';
  } });
  }} });

  emit('OnUpdate', e)
}

function SelectItem(i: any): void {
  let item = filtered.value[i];
  if (item != null && range.value != null) {item.command({ editor: props.editor, range: range.value });
  visible.value = false;
  query.value = '';
  range.value = null;
  selected_index.value = 0;
  }

  emit('SelectItem', i)
}

function __auto_gl_autodown_slash_keydown_OnKeydown(e: any) {
  OnKeydown(e)
}

function __auto_gl_autodown_slash_open_OnOpen(e: any) {
  OnOpen(e)
}

function __auto_gl_autodown_slash_update_OnUpdate(e: any) {
  OnUpdate(e)
}

onMounted(() => {
  document.addEventListener('autodown:slash-close', OnClose)
  document.addEventListener('autodown:slash-keydown', __auto_gl_autodown_slash_keydown_OnKeydown)
  document.addEventListener('autodown:slash-open', __auto_gl_autodown_slash_open_OnOpen)
  document.addEventListener('autodown:slash-update', __auto_gl_autodown_slash_update_OnUpdate)
})

onUnmounted(() => {
  document.removeEventListener('autodown:slash-close', OnClose)
  document.removeEventListener('autodown:slash-keydown', __auto_gl_autodown_slash_keydown_OnKeydown)
  document.removeEventListener('autodown:slash-open', __auto_gl_autodown_slash_open_OnOpen)
  document.removeEventListener('autodown:slash-update', __auto_gl_autodown_slash_update_OnUpdate)
})


</script>

<template>
    <template v-if="visible">
      <div class="autodown-slash-menu" ref="menuEl" :style="({ top: pos_top, left: pos_left, visibility: pos_visibility } as any)">
        <div class="autodown-slash-menu-items">
          <button class="autodown-slash-menu-item" :class="{ active: i == selected_index }" :key="item.title" @click="SelectItem(i)" @mouseenter="HoverItem(i)" v-for="(item, i) in filtered">
            <component :is="(item.icon) as any" class="autodown-slash-menu-icon" :size="16" />
            <div class="autodown-slash-menu-info">
              <div class="autodown-slash-menu-title">
                <span>{{ item.title }}</span>
              </div>
              <div class="autodown-slash-menu-desc">
                <span>{{ item.description }}</span>
              </div>
            </div>
          </button>
          <template v-if="is_empty">
            <div class="autodown-slash-menu-empty">
              <span>{{ empty_text }}</span>
            </div>
          </template>
        </div>
      </div>
    </template>

</template>

<style>
/* Component styles */

</style>
