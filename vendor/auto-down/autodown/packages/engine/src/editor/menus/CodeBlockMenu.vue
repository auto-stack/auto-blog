<!-- CodeBlockMenu component - Auto-generated from Auto language -->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { computeMenuPosition, codeBlockLanguages, codeBlockCheckIcon } from '../ext/code_block_menu_ext'
import { nextTick } from 'vue'


const props = defineProps<{
  editor: any
}>()

const visible = ref<boolean>(false)
const search = ref<string>('')
const highlighted_index = ref<number>(0)
const current_language = ref<string>('')
const pos_top = ref<string>('')
const pos_left = ref<string>('')
const pos_visibility = ref<string>('')
const active_code_block = ref<any>(null)
const editor_el = ref<any>(null)
const editor_dom = ref<any>(null)
const wrapper_el = ref<any>(null)
const raf_id = ref<number>(0)
const wheel_cb = ref<any>(null)
const dom_mousedown_cb = ref<any>(null)
const dom_click_cb = ref<any>(null)
const scroll_cb = ref<any>(null)

const menuEl = ref<HTMLElement | null>(null)
const searchEl = ref<HTMLElement | null>(null)
const listEl = ref<HTMLElement | null>(null)

const filtered = computed<any>(() => codeBlockLanguages().filter((lang) => [lang.id, lang.label].concat(lang.aliases).join(' ').toLowerCase().includes(search.value.toLowerCase().trim())))
const is_empty = computed<boolean>(() => filtered.value.length === 0)
const check_icon = computed<any>(() => codeBlockCheckIcon())

const emit = defineEmits<{
  Init: []
  Destroy: []
  SearchInput: [any]
  MoveDown: []
  MoveUp: []
  SelectHighlighted: []
  SelectItem: [any]
  HoverItem: [any]
  Close: []
  OutsideClick: [any]
}>()

function Close(): void {
  visible.value = false;
  search.value = '';
  highlighted_index.value = 0;
  active_code_block.value = null;

  emit('Close')
}

function HoverItem(i: any): void {
  highlighted_index.value = i;

  emit('HoverItem', i)
}

function MoveDown(): void {
  if (highlighted_index.value < filtered.value.length - 1) {highlighted_index.value = highlighted_index.value + 1;
  nextTick(() => { let s_menu = null;
  if (editor_el.value != null) {s_menu = editor_el.value.querySelector('.autodown-codeblock-menu');
  }if (s_menu != null) {let s_list = s_menu.querySelector('.autodown-codeblock-menu-list');
  let s_item = s_menu.querySelector('.autodown-codeblock-menu-item.active');
  if (s_list != null && s_item != null) {let listRect = s_list.getBoundingClientRect();
  let itemRect = s_item.getBoundingClientRect();
  let offset: number = itemRect.top - listRect.top - listRect.height / 2 + itemRect.height / 2;
  s_list.scrollTop = s_list.scrollTop + offset;
  }} });
  }

  emit('MoveDown')
}

function MoveUp(): void {
  if (highlighted_index.value > 0) {highlighted_index.value = highlighted_index.value - 1;
  nextTick(() => { let s_menu = null;
  if (editor_el.value != null) {s_menu = editor_el.value.querySelector('.autodown-codeblock-menu');
  }if (s_menu != null) {let s_list = s_menu.querySelector('.autodown-codeblock-menu-list');
  let s_item = s_menu.querySelector('.autodown-codeblock-menu-item.active');
  if (s_list != null && s_item != null) {let listRect = s_list.getBoundingClientRect();
  let itemRect = s_item.getBoundingClientRect();
  let offset: number = itemRect.top - listRect.top - listRect.height / 2 + itemRect.height / 2;
  s_list.scrollTop = s_list.scrollTop + offset;
  }} });
  }

  emit('MoveUp')
}

function OutsideClick(e: any): void {
  if (visible.value) {let menu = null;
  if (editor_el.value != null) {menu = editor_el.value.querySelector('.autodown-codeblock-menu');
  }if (menu != null) {if (!menu["contains"](e.target)) {visible.value = false;
  search.value = '';
  highlighted_index.value = 0;
  active_code_block.value = null;
  }}}

  emit('OutsideClick', e)
}

function SearchInput(e: any): void {
  search.value = e.target.value;

  emit('SearchInput', e)
}

function SelectHighlighted(): void {
  if (filtered.value.length == 1) {let only = filtered.value[0];
  props.editor.chain().focus().setCodeBlock({ language: only.id }).run();
  visible.value = false;
  search.value = '';
  highlighted_index.value = 0;
  active_code_block.value = null;
  }
  if (filtered.value.length != 1) {let lang = filtered.value[highlighted_index.value];
  if (lang != null) {props.editor.chain().focus().setCodeBlock({ language: lang.id }).run();
  visible.value = false;
  search.value = '';
  highlighted_index.value = 0;
  active_code_block.value = null;
  }}

  emit('SelectHighlighted')
}

function SelectItem(lang: any): void {
  props.editor.chain().focus().setCodeBlock({ language: lang.id }).run();
  visible.value = false;
  search.value = '';
  highlighted_index.value = 0;
  active_code_block.value = null;

  emit('SelectItem', lang)
}

onMounted(async () => {
  // Child onMounted hooks run before the parent inserts its DOM subtree into
  // document. Resolve the editor host after the mount flush so view.dom is
  // attached before closest() and event listeners are used.
  await nextTick();
  const dom: HTMLElement | null = props.editor?.view?.dom ?? null;
  if (dom == null) return;
  editor_dom.value = dom;
  editor_el.value = dom.closest('.autodown-editor');
  wrapper_el.value = dom.closest('.autodown-editor-content-wrapper');





  let schedule = () => { if (raf_id.value != 0) {cancelAnimationFrame(raf_id.value);
  }raf_id.value = requestAnimationFrame(() => { raf_id.value = 0;
  if (visible.value) {







  if (editor_el.value != null) {let editorRect = editor_el.value.getBoundingClientRect();
  let triggerEl = active_code_block.value;
  if (triggerEl == null) {

  let ed_view = props.editor['view'];
  let el = ed_view.nodeDOM(ed_view.state.selection.from);
  if (el != null && el.closest != null) {triggerEl = el.closest('pre[data-language]');
  if (triggerEl == null) {triggerEl = el.closest('.autodown-codeblock-node');
  }}}if (triggerEl == null) {
  visible.value = false;
  search.value = '';
  highlighted_index.value = 0;
  active_code_block.value = null;
  }if (triggerEl != null) {let badge = triggerEl.querySelector('[data-codeblock-language-badge]');
  let anchor = triggerEl;
  if (badge != null) {anchor = badge;
  }let triggerRect = anchor.getBoundingClientRect();


  let trigger = { top: triggerRect.top - editorRect.top + 6, left: triggerRect.left - editorRect.left, bottom: triggerRect.bottom - editorRect.top + 6, right: triggerRect.right - editorRect.left, width: triggerRect.width, height: triggerRect.height };
  let container = { width: editorRect.width, height: editorRect.height };
  let initial = computeMenuPosition(trigger, 0, 0, container, 'bottom-end', 0);
  pos_top.value = initial.top + 'px';
  pos_left.value = initial.left + 'px';
  pos_visibility.value = 'hidden';
  nextTick(() => { 



  let menu = editor_el.value.querySelector('.autodown-codeblock-menu');
  if (menu != null) {let menuRect = menu.getBoundingClientRect();
  let pos_final = computeMenuPosition(trigger, menuRect.width, menuRect.height, container, 'bottom-end', 0);
  pos_top.value = pos_final.top + 'px';
  pos_left.value = pos_final.left + 'px';
  pos_visibility.value = 'visible';
  } });
  }}} });
   };
  scroll_cb.value = schedule;







  let on_wheel = (e: any) => { if (visible.value) {let menu = null;
  if (editor_el.value != null) {menu = editor_el.value.querySelector('.autodown-codeblock-menu');
  }if (menu != null && menu["contains"](e.target)) {e.preventDefault();
  e.stopPropagation();
  let list = menu.querySelector('.autodown-codeblock-menu-list');
  if (list != null) {let can_down: boolean = list.scrollTop + list.clientHeight < list.scrollHeight;
  let can_up: boolean = list.scrollTop > 0;


  if (e.deltaY > 0 && can_down) {list.scrollTop = list.scrollTop + e.deltaY;
  }if (e.deltaY < 0 && can_up) {list.scrollTop = list.scrollTop + e.deltaY;
  }}}

  if (menu == null) {e.preventDefault();
  e.stopPropagation();
  }if (menu != null && !menu["contains"](e.target)) {e.preventDefault();
  e.stopPropagation();
  }} };
  wheel_cb.value = on_wheel;
  document.addEventListener('wheel', wheel_cb.value, { passive: false, capture: true });






  let on_mousedown = (e: any) => { let target = e.target;
  let badge = null;
  let copy = null;
  let expand = null;
  let more = null;
  if (target.closest != null) {badge = target.closest('[data-codeblock-language-badge]');
  copy = target.closest('[data-codeblock-copy-btn]');
  expand = target.closest('[data-codeblock-expand-btn]');
  more = target.closest('[data-codeblock-more-btn]');
  }if (badge != null || copy != null || expand != null || more != null) {e.preventDefault();
  e.stopPropagation();
  } };
  dom_mousedown_cb.value = on_mousedown;
  dom.addEventListener('mousedown', dom_mousedown_cb.value, { capture: true });




  let on_click = (e: any) => { let target = e.target;
  let copy = null;
  let expand = null;
  let badge = null;
  let more = null;
  if (target.closest != null) {copy = target.closest('[data-codeblock-copy-btn]');
  expand = target.closest('[data-codeblock-expand-btn]');
  badge = target.closest('[data-codeblock-language-badge]');
  more = target.closest('[data-codeblock-more-btn]');
  }if (copy != null) {e.preventDefault();
  e.stopPropagation();
  let pre = copy.closest('pre');
  if (pre == null) {

  let container_el = copy.closest('.code-block-container');
  if (container_el != null) {pre = container_el.querySelector('pre[data-language]');
  }}let code: string = '';
  if (pre != null) {let codeEl = pre.querySelector('code');
  if (codeEl != null) {code = (codeEl.textContent ?? '');
  }}navigator.clipboard.writeText(code);
  }if (copy == null && expand != null) {e.preventDefault();
  e.stopPropagation();
  let pre2 = expand.closest('pre');
  if (pre2 == null) {let container_el2 = expand.closest('.code-block-container');
  if (container_el2 != null) {pre2 = container_el2.querySelector('pre[data-language]');
  }}if (pre2 != null) {pre2.classList.toggle('is-collapsed');
  }}if (copy == null && expand == null) {let trigger = badge;
  if (trigger == null) {trigger = more;
  }if (trigger != null) {






  let block = trigger.closest('pre');
  if (block == null) {block = trigger.closest('.autodown-codeblock-node');
  }let container_face: boolean = false;
  if (block == null) {



  block = trigger.closest('.code-block-container');
  if (block != null) {container_face = true;
  }}e.preventDefault();
  if (container_face == false) {e.stopPropagation();
  }if (block == null) {




  block = trigger.closest('.code-block-container');
  }if (block == null) {

  let ed_view = props.editor['view'];
  let el = ed_view.nodeDOM(ed_view.state.selection.from);
  if (el != null && el.closest != null) {block = el.closest('pre[data-language]');
  if (block == null) {block = el.closest('.autodown-codeblock-node');
  }}}active_code_block.value = block;








  current_language.value = '';
  if (active_code_block.value != null) {current_language.value = (active_code_block.value.getAttribute('data-language') ?? '');
  if (current_language.value == '') {let pre_el = active_code_block.value.querySelector('pre[data-language]');
  if (pre_el != null) {current_language.value = (pre_el.getAttribute('data-language') ?? '');
  }}}if (current_language.value == '') {current_language.value = (props.editor.getAttributes('codeBlock').language ?? '');
  }visible.value = true;
  search.value = '';
  let idx = codeBlockLanguages().findIndex((l: any) => l.id == current_language.value);
  highlighted_index.value = idx;
  if (idx < 0) {highlighted_index.value = 0;
  }nextTick(() => { 

  let menu = null;
  if (editor_el.value != null) {menu = editor_el.value.querySelector('.autodown-codeblock-menu');
  }if (menu != null) {let searchEl = menu.querySelector('.autodown-codeblock-menu-search');
  if (searchEl != null) {searchEl.focus();
  }}
  if (editor_el.value != null) {let editorRect = editor_el.value.getBoundingClientRect();
  let triggerEl = active_code_block.value;
  if (triggerEl == null) {let ed_view2 = props.editor['view'];
  let el2 = ed_view2.nodeDOM(ed_view2.state.selection.from);
  if (el2 != null && el2.closest != null) {triggerEl = el2.closest('pre[data-language]');
  if (triggerEl == null) {triggerEl = el2.closest('.autodown-codeblock-node');
  }}}if (triggerEl == null) {visible.value = false;
  search.value = '';
  highlighted_index.value = 0;
  active_code_block.value = null;
  }if (triggerEl != null) {let badge2 = triggerEl.querySelector('[data-codeblock-language-badge]');
  let anchor = triggerEl;
  if (badge2 != null) {anchor = badge2;
  }let triggerRect = anchor.getBoundingClientRect();
  let trigger2 = { top: triggerRect.top - editorRect.top + 6, left: triggerRect.left - editorRect.left, bottom: triggerRect.bottom - editorRect.top + 6, right: triggerRect.right - editorRect.left, width: triggerRect.width, height: triggerRect.height };
  let container = { width: editorRect.width, height: editorRect.height };
  let initial = computeMenuPosition(trigger2, 0, 0, container, 'bottom-end', 0);
  pos_top.value = initial.top + 'px';
  pos_left.value = initial.left + 'px';
  pos_visibility.value = 'hidden';
  nextTick(() => { let menu2 = editor_el.value.querySelector('.autodown-codeblock-menu');
  if (menu2 != null) {let menuRect = menu2.getBoundingClientRect();
  let pos_final = computeMenuPosition(trigger2, menuRect.width, menuRect.height, container, 'bottom-end', 0);
  pos_top.value = pos_final.top + 'px';
  pos_left.value = pos_final.left + 'px';
  pos_visibility.value = 'visible';
  } });
  }}



  nextTick(() => { let s_menu = null;
  if (editor_el.value != null) {s_menu = editor_el.value.querySelector('.autodown-codeblock-menu');
  }if (s_menu != null) {let s_list = s_menu.querySelector('.autodown-codeblock-menu-list');
  let s_item = s_menu.querySelector('.autodown-codeblock-menu-item.active');
  if (s_list != null && s_item != null) {let listRect = s_list.getBoundingClientRect();
  let itemRect = s_item.getBoundingClientRect();
  let offset: number = itemRect.top - listRect.top - listRect.height / 2 + itemRect.height / 2;
  s_list.scrollTop = s_list.scrollTop + offset;
  }} });
   });
  }} };
  dom_click_cb.value = on_click;
  dom.addEventListener('click', dom_click_cb.value, { capture: true });




  if (wrapper_el.value != null) {wrapper_el.value.addEventListener('scroll', scroll_cb.value, { passive: true });
  }
})

onUnmounted(() => {
  




document.removeEventListener('wheel', wheel_cb.value, { capture: true });
if (editor_dom.value != null) {editor_dom.value.removeEventListener('mousedown', dom_mousedown_cb.value, { capture: true });
editor_dom.value.removeEventListener('click', dom_click_cb.value, { capture: true });
}
if (wrapper_el.value != null) {wrapper_el.value.removeEventListener('scroll', scroll_cb.value);
}

})

function __auto_gl_mousedown_OutsideClick(e: any) {
  OutsideClick(e)
}

onMounted(() => {
  document.addEventListener('mousedown', __auto_gl_mousedown_OutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', __auto_gl_mousedown_OutsideClick)
})


</script>

<template>
    <template v-if="visible">
      <div class="autodown-codeblock-menu" ref="menuEl" :style="({ top: pos_top, left: pos_left, visibility: pos_visibility } as any)">
        <div class="autodown-codeblock-menu-header">
          <input class="autodown-codeblock-menu-search" :placeholder="'Search language…'" ref="searchEl" v-model="search" @input="SearchInput($event)" @keydown.down.prevent="MoveDown" @keydown.enter.prevent="SelectHighlighted" @keydown.esc="Close" @keydown.up.prevent="MoveUp" />
        </div>
        <div class="autodown-codeblock-menu-list" ref="listEl">
          <button class="autodown-codeblock-menu-item" :class="{ active: i == highlighted_index, selected: lang.id == current_language }" :key="lang.id" @click="SelectItem(lang)" @mouseenter="HoverItem(i)" v-for="(lang, i) in filtered">
            <span class="autodown-codeblock-menu-item-label">
              <span>{{ lang.label }}</span>
            </span>
            <template v-if="lang.id == current_language">
              <component :is="(check_icon) as any" class="autodown-codeblock-menu-check" :size="13" />
            </template>
          </button>
          <template v-if="is_empty">
            <div class="autodown-codeblock-menu-empty">
              <span>No matching languages</span>
            </div>
          </template>
        </div>
      </div>
    </template>

</template>

<style>
/* Component styles */

</style>
