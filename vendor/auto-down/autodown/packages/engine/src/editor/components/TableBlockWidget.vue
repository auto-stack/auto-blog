<!-- TableBlockWidget component - Auto-generated from Auto language -->
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { BlockChildren } from '../ext/container_ext'
import { commitTableCell, rootTag, rootClass, rootAriaBusy, rootBlockId, rootNodeType, streamHeader, streamBody, streamColspan, htmlText, focusPendingCell } from '../ext/table_block_widget_ext'


const props = defineProps<{
  mode: string
  controller: any
  blockId: string
  readonly: boolean
  final: boolean
  header_cells: any
  body_rows: any
  columns: any
  rows: any
}>()

const is_edit = computed<boolean>(() => props.mode === 'edit')
const is_view = computed<boolean>(() => props.mode === 'view')
const root_tag = computed<any>(() => rootTag(props.mode))
const root_class = computed<any>(() => rootClass(props.mode, props.final, props.readonly))
const root_aria_busy = computed<any>(() => rootAriaBusy(props.mode))
const root_block_id = computed<any>(() => rootBlockId(props.mode, props.blockId))
const root_node_type = computed<any>(() => rootNodeType(props.mode))
const stream_header = computed<any>(() => streamHeader(props.columns))
const stream_body = computed<any>(() => streamBody(props.columns, props.rows))
const loading_colspan = computed<any>(() => streamColspan(props.columns))
const loading_html = computed<any>(() => htmlText('Loading'))

const emit = defineEmits<{
  Init: []
  AddRowAbove: []
  AddRow: []
  DeleteRow: []
  AddColumnBefore: []
  AddColumn: []
  DeleteColumn: []
  DeleteTable: []
  CellBlur: [any]
}>()

function AddColumn(): void {
  let c = props.controller;
  c.addColumn();

  emit('AddColumn')
}

function AddRow(): void {
  let c = props.controller;
  c.addRow();

  emit('AddRow')
}

function AddRowAbove(): void {
  let c = props.controller;
  c.addRowAbove();

  emit('AddRowAbove')
}

function CellBlur(e: any): void {
  if (!props.readonly) {let c = props.controller;
  commitTableCell(c, e);
  }

  emit('CellBlur', e)
}

function DeleteColumn(): void {
  let c = props.controller;
  c.deleteColumn();

  emit('DeleteColumn')
}

function DeleteRow(): void {
  let c = props.controller;
  c.deleteRow();

  emit('DeleteRow')
}

function DeleteTable(): void {
  let c = props.controller;
  c.deleteTable();

  emit('DeleteTable')
}

function AddColumnBefore(): void {
  emit('AddColumnBefore')
}

onMounted(() => {
  focusPendingCell(props.blockId);
})


</script>

<template>
    <component :is="(root_tag) as any" :class="root_class" :aria-busy="root_aria_busy" :data-block-id="root_block_id" :data-node-type="root_node_type">
      <template v-if="is_edit">
        <template v-if="readonly">
          <div class="autodown-stream-banner">
            <span>流式生成中</span>
          </div>
        </template>
        <div class="te-toolbar" :aria-label="'表格工具栏'" :role="'toolbar'">
          <button class="te-btn" :data-te-action="'add-row-above'" :disabled="readonly" :title="'在上方插入一行'" :type="'button'" @click="AddRowAbove">
            <span>行↑</span>
          </button>
          <button class="te-btn" :data-te-action="'add-row'" :disabled="readonly" :title="'在末尾后插入一行'" :type="'button'" @click="AddRow">
            <span>行↓</span>
          </button>
          <button class="te-btn" :data-te-action="'delete-row'" :disabled="readonly" :title="'删除最后一行'" :type="'button'" @click="DeleteRow">
            <span>删行</span>
          </button>
          <button class="te-btn" :data-te-action="'add-col-before'" :disabled="readonly" :title="'在左侧插入一列'" :type="'button'" @click="AddColumnBefore">
            <span>列←</span>
          </button>
          <button class="te-btn" :data-te-action="'add-col'" :disabled="readonly" :title="'追加一列'" :type="'button'" @click="AddColumn">
            <span>列→</span>
          </button>
          <button class="te-btn" :data-te-action="'delete-col'" :disabled="readonly" :title="'删除最后一列'" :type="'button'" @click="DeleteColumn">
            <span>删列</span>
          </button>
          <button class="te-btn te-btn-danger" :data-te-action="'delete-table'" :disabled="readonly" :title="'删除整个表格'" :type="'button'" @click="DeleteTable">
            <span>删表</span>
          </button>
        </div>
        <table class="table-node" :aria-busy="'false'">
          <thead>
            <tr>
              <th :class="cell.cls" :contenteditable="readonly == false" :data-cell-id="cell.id" :dir="'auto'" :key="cell.id" :spellcheck="'false'" @blur="CellBlur($event)" v-for="(cell, h_i) in header_cells">
                <span>{{ cell.text }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr :key="row.id" v-for="(row, r_i) in body_rows">
              <td :class="cell.cls" :contenteditable="readonly == false" :data-cell-id="cell.id" :dir="'auto'" :key="cell.id" :spellcheck="'false'" @blur="CellBlur($event)" v-for="(cell, c_i) in row.cells">
                <span>{{ cell.text }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </template>
      <template v-if="is_view">
        <thead>
          <tr>
            <th :class="cell.cls" :dir="'auto'" :key="cell.id" v-for="(cell, hv_i) in header_cells">
              <BlockChildren :children_slot="cell.children_slot" :key="'BlockChildren-1-' + hv_i" />
              <button class="table-node__resize-handle" :type="'button'" />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr :key="row.id" v-for="(row, rv_i) in body_rows">
            <td :class="cell.cls" :dir="'auto'" :key="cell.id" v-for="(cell, cv_i) in row.cells">
              <BlockChildren :children_slot="cell.children_slot" :key="'BlockChildren-2-' + cv_i" />
            </td>
          </tr>
        </tbody>
      </template>
      <template v-if="mode == 'stream'">
        <table>
          <thead>
            <tr>
              <th v-html="col.html" :key="col.col"  v-for="(col, hs_i) in stream_header"/>
            </tr>
          </thead>
          <tbody>
            <tr :key="rs_i" v-for="(row, rs_i) in stream_body">
              <td v-html="cell.html" :key="cell.col"  v-for="(cell, cs_i) in row"/>
            </tr>
            <template v-if="! final">
              <tr class="loading-row">
                <td :colspan="loading_colspan">
                  <span class="loading-dots" v-html="loading_html" />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </template>
    </component>

</template>

<style>
/* Component styles */

</style>

<style scoped>

        .autodown-table-editor {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #ffffff;
          overflow: hidden;
        }
        .autodown-table-editor.is-readonly {
          opacity: 0.75;
        }
        .autodown-stream-banner {
          padding: 0.3rem 0.75rem;
          font-size: 0.8rem;
          font-weight: 500;
          color: #92400e;
          background: #fef3c7;
          border-bottom: 1px solid #fcd34d;
          user-select: none;
        }
        .te-toolbar {
          display: flex;
          gap: 0.25rem;
          padding: 0.35rem 0.5rem;
          background: hsl(220 9% 46% / 0.06);
          border-bottom: 1px solid #e5e7eb;
        }
        .te-btn {
          padding: 0.15rem 0.5rem;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          background: #ffffff;
          color: #374151;
          font-size: 0.8rem;
          line-height: 1.4;
          cursor: pointer;
        }
        .te-btn:hover:not(:disabled) {
          background: hsl(220 9% 46% / 0.1);
        }
        .te-btn:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }
        .te-btn.te-btn-danger {
          color: #b91c1c;
        }
        .te-btn.te-btn-danger:hover:not(:disabled) {
          background: hsl(0 74% 56% / 0.1);
        }
        .autodown-table-editor td[contenteditable='true'],
        .autodown-table-editor th[contenteditable='true'] {
          outline: none;
          cursor: text;
        }
        .autodown-table-editor td[contenteditable='true']:focus,
        .autodown-table-editor th[contenteditable='true']:focus {
          box-shadow: inset 0 0 0 1.5px #6366f1;
          border-radius: 2px;
        }
        /* stream face — the retired StreamingTable SFC's styles, verbatim
           (plan 037 T3; scoped to the widget now, same rules) */
        .streaming-table {
          margin: 0.75rem 0;
          overflow-x: auto;
        }
        .streaming-table table {
          border-collapse: collapse;
          width: 100%;
          font-size: 0.95rem;
        }
        .streaming-table th,
        .streaming-table td {
          border: 1px solid #e5e7eb;
          padding: 0.9rem 0.6rem;
          text-align: left;
        }
        .streaming-table th {
          background: hsl(220 9% 46% / 0.06);
          font-weight: 600;
          color: #111827;
        }
        .streaming-table td {
          color: #111827;
        }
        .streaming-table tr:nth-child(even) {
          background: #f9fafb;
        }
        .streaming-table .loading-row td {
          color: #6b7280;
          font-style: italic;
          text-align: center;
        }
        .loading-dots::after {
          content: '';
          animation: dots 1.4s infinite both;
        }
        @keyframes dots {
          0%, 80%, 100% { content: ''; }
          40% { content: '.'; }
          60% { content: '..'; }
        }
    </style>
