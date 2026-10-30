<template>
  <div
    ref="containerRef"
    class="streaming-document"
    :class="{ 'is-sync': scrollSync, 'is-dark': isDarkActive }"
    :data-accent="accentAttr"
  >
    <template v-for="(part, idx) in parts" :key="part.kind + '-' + idx">
      <MarkdownRender
        v-if="part.kind === 'markdown'"
        :content="part.text"
        :final="!streaming"
        :max-live-nodes="streaming ? 0 : 320"
        :batch-rendering="streaming"
        :render-batch-size="16"
        :render-batch-delay="8"
        :typewriter="streaming && idx === lastMarkdownIndex"
        :fade="false"
        :code-block-props="codeBlockProps"
      />
      <!-- registered BlockComponent stream slots win (plan 023 P2T1); the
           builtin branches below are the unregistered fallbacks -->
      <component
        v-else-if="streamSlotOf(part)"
        :is="() => streamSlotOf(part)!(slotNodeOf(part), slotFinalOf(part))"
      />
      <details
        v-else-if="part.kind === 'details'"
        class="autodown-details"
        data-details-wrapped
      >
        <summary>{{ part.summary }}</summary>
        <div class="details-content">
          <MarkdownRender
            :content="part.body"
            :final="!streaming"
            :batch-rendering="streaming"
            :render-batch-size="16"
            :render-batch-delay="8"
            :typewriter="streaming && idx === lastMarkdownIndex"
            :fade="false"
            :code-block-props="codeBlockProps"
          />
        </div>
      </details>
      <component
        v-else-if="part.kind === 'component'"
        :is="registry[part.componentType]"
        v-bind="part.props"
        :final="part.final"
      />
    </template>
  </div>
</template>

<script lang="ts">
// plan 042 T3: the ```json table segment's stream face is the family
// widget's stream slot now (the retired local StreamingTableFace, hoisted
// to block-widget-panels as the shared closure). Registered HERE — the only
// consumer of stream slots, and the old face's home — so pure-render
// consumers keep the path without the editor layer; EngineEditor's table
// family registration supersedes it with the same closure wherever the
// editor loads. PLAIN script block: module scope, so it runs ONCE at
// import (a <script setup> body would re-register on every mount and
// clobber consumer registrations — the dual-script idiom EngineEditor uses).
import { registerBlockComponent } from './block-component'
import { tableStreamFace } from './block-widget-panels'

registerBlockComponent('Table', { stream: tableStreamFace })
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, h } from 'vue'
import MarkdownRender from './MarkdownRender.vue'
import { enableKatex, enableMermaid, enableHighlight, isCapabilityEnabled } from './optional-capabilities'
import { common, createLowlight } from 'lowlight'
import { toHtml } from 'hast-util-to-html'
import { useStreamingDocument } from './useStreamingDocument'
import { resolveBlockComponent } from './block-component'
import type { VNode } from 'vue'

const lowlight = createLowlight(common)

// heavy capabilities are opt-in registrations (plan 008 Phase 3); math and
// mermaid nodes are outside the current parse subset, so these record intent.
// highlight IS wired: the codeblock panel renders through the highlight
// bridge (highlight.ts) — lowlight is just the Vue default; a backend that
// registered its own impl (enableHighlight(vmImpl)) is NOT clobbered here.
enableKatex()
enableMermaid()
if (!isCapabilityEnabled('highlight')) enableHighlight()

const props = withDefaults(
  defineProps<{
    source: string
    streaming?: boolean
    placeholderBlockId?: string
    placeholderHeight?: number
    /** editor scroll-sync mode: zeroes slot-edge margins for stable block
     *  measurement. Plain streaming reads should turn this OFF to keep the
     *  normal heading/paragraph vertical rhythm. */
    scrollSync?: boolean    /** Theme declaration entry (PLAN-051 T4): which palette档 the document
     *  face renders in. Declarative in the view tree (the DSL
     *  `dark_mode:`/`accent:` bindings land here) — NOT an ambient CSS fact
     *  the VM track can't see. Values per auto-lang Design 22 §7. */
    darkMode?: boolean
    accent?: 'indigo' | 'coral' | 'ocean' | 'sage' | 'amber'
  }>(),
  {
    streaming: false,
    // musk plan 072: was `true` — the is-sync slot-edge margin zeroing
    // (with !important) then shipped with every plain read, killing the
    // heading top margins the doc comment above already reserved for
    // scroll-sync-only. Consumers wanting sync pass :scroll-sync="true"
    // (the editor twin and the wiki view already do).
    scrollSync: false,
    darkMode: false,
    accent: 'indigo',
  }
)

const ACCENTS = ['indigo', 'coral', 'ocean', 'sage', 'amber'] as const
const accentAttr = computed(() =>
  ACCENTS.includes(props.accent as (typeof ACCENTS)[number]) ? props.accent : 'indigo'
)

const ambientDark = ref(false)
const isDarkActive = computed(() => props.darkMode || ambientDark.value)

onMounted(() => {
  if (typeof document !== 'undefined') {
    const checkDark = () => {
      ambientDark.value = Boolean(
        document.documentElement.classList.contains('dark') ||
        document.documentElement.getAttribute('data-theme') === 'dark' ||
        containerRef.value?.closest('.dark, [data-theme="dark"]')
      )
    }
    checkDark()
    const observer = new MutationObserver(checkDark)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    if (containerRef.value?.parentElement) {
      observer.observe(containerRef.value.parentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    }
    onBeforeUnmount(() => observer.disconnect())
  }
})

const { segments } = useStreamingDocument(computed(() => props.source))

// :::details blocks are NOT part of the streaming parse subset — the
// self-hosted MarkdownRender has no raw-HTML support, so the old trick of
// rewriting them into <details> HTML left them escaped as plain text.
// Instead we split markdown segments here and render the native
// <details> element ourselves (browser handles collapse/expand), with the
// body going through MarkdownRender like any other markdown.
type DetailsPart = { kind: 'details'; summary: string; body: string; closed: boolean }
type Part = { kind: 'markdown'; text: string } | DetailsPart | { kind: 'component'; componentType: string; props: Record<string, any>; final: boolean }

const DETAILS_HEADER_RE = /^:::details[ \t]+([^\n]*)\n/gm

function splitMarkdownIntoParts(text: string): Part[] {
  const parts: Part[] = []
  let cursor = 0
  DETAILS_HEADER_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = DETAILS_HEADER_RE.exec(text)) !== null) {
    const bodyStart = m.index + m[0].length
    const closer = text.indexOf('\n:::', bodyStart)
    if (m.index > cursor) parts.push({ kind: 'markdown', text: text.slice(cursor, m.index) })
    if (closer === -1) {
      parts.push({ kind: 'details', summary: m[1], body: text.slice(bodyStart), closed: false })
      cursor = text.length
    } else {
      parts.push({ kind: 'details', summary: m[1], body: text.slice(bodyStart, closer), closed: true })
      cursor = closer + '\n:::'.length
      DETAILS_HEADER_RE.lastIndex = cursor
    }
  }
  if (cursor < text.length) parts.push({ kind: 'markdown', text: text.slice(cursor) })
  return parts
}

const parts = computed<Part[]>(() =>
  segments.value.flatMap((segment) =>
    segment.type === 'markdown'
      ? splitMarkdownIntoParts(segment.text)
      : [{ kind: 'component', componentType: segment.componentType, props: segment.props, final: segment.final }]
  )
)

const lastMarkdownIndex = computed(() => {
  for (let i = parts.value.length - 1; i >= 0; i--) {
    if (parts.value[i].kind !== 'component') return i
  }
  return -1
})

const codeBlockProps = {
  showHeader: true,
  showCopyButton: true,
  showExpandButton: true,
}

// plan 042 T3: the ```json table component segments render through the
// Table family widget's STREAM slot — the registered BlockComponent stream
// slot (streamSlotOf below) now carries the retired StreamingTableFace's
// progressive contract (header-first columns, streaming rows, loading row,
// final flip), registered with the family in EngineEditor and byte-pinned
// by streaming-table-gold.test.ts. The local registry stays for FUTURE
// component segments (chart/form/...) — table no longer needs an entry.
const registry: Record<string, any> = {
  // Future: chart: StreamingChart, form: StreamingForm, ...
}

// -- BlockComponent contract routing (plan 023 P2T1) -------------------------
// A registered stream slot overrides the builtin streaming path for its
// kind — the SAME registry the editor assembly resolves edit faces through.
// The slot receives the segment payload in its render-model shape (component
// props, or the details part itself) plus the `final` flag the builtin path
// would have used. Unregistered kinds keep the builtin branches (native
// <details>, StreamingTable registry, markdown segments).

function streamSlotOf(part: Part): ((node: any, final: boolean) => VNode) | undefined {
  const kind = part.kind === 'component' ? part.componentType : part.kind === 'details' ? 'details' : ''
  return kind ? resolveBlockComponent(kind).stream : undefined
}

function slotNodeOf(part: Part): any {
  return part.kind === 'component' ? part.props : part
}

function slotFinalOf(part: Part): boolean {
  return part.kind === 'component' ? part.final : !props.streaming
}

const containerRef = ref<HTMLElement | null>(null)

function clearPlaceholders(container: HTMLElement) {
  // Scoped to the slot's DIRECT children: the editing placeholder this
  // component inserts lives at .node-slot > .autodown-block-placeholder
  // (matching the :scope > guard in applyBlockIdsAndPlaceholder). The open
  // -fence skeleton (plan 032 P3) reuses the same class family DEEPER in the
  // tree (.node-content .code-block-container) and must survive refreshes —
  // an unscoped querySelectorAll here would rip the code panel out of the
  // DOM while Vue's VDOM still believes it is mounted.
  container.querySelectorAll('.node-slot > .autodown-block-placeholder').forEach((el) => el.remove())
}

// created lazily on mount — MutationObserver is browser-only and must not
// be touched during SSR setup
let mutationObserver: MutationObserver | null = null
function createMutationObserver(): MutationObserver {
  return new MutationObserver(() => {
    if (containerRef.value) {
      applyBlockIdsAndPlaceholder(containerRef.value)
      highlightCodeBlocks(containerRef.value)
      wrapDetailsContent(containerRef.value)
    }
  })
}

function getTopLevelBlockType(content: Element, nodeType: string | null): string | null {
  const child = content.firstElementChild
  if (!child) return null
  const tag = child.tagName.toLowerCase()
  if (['h1', 'h2', 'h3', 'p', 'pre', 'blockquote', 'ul', 'ol', 'hr', 'img', 'table'].includes(tag)) {
    return tag
  }
  if (child.classList.contains('table-node-wrapper')) return 'table'
  if (child.classList.contains('image-error')) return 'img'
  if (child.classList.contains('autodown-image-wrapper')) return 'img'
  if (child.querySelector('.image-node-container, .image-node__img')) return 'img'
  if (child.classList.contains('autodown-callout') || child.classList.contains('admonition')) return 'callout'
  if (child.classList.contains('autodown-details') || child.classList.contains('html-block-node')) return 'details'
  if (child.classList.contains('autodown-math-block') || child.classList.contains('math-block')) return 'math'
  if (child.classList.contains('mermaid-block-container')) return 'mermaid'
  // Fallback to markstream's node type so newly-added component blocks are
  // treated as top-level blocks without needing an explicit class list.
  if (nodeType && nodeType !== 'text') return nodeType
  return null
}

function isWrapperBlockType(type: string | null) {
  return (
    type === 'blockquote' ||
    type === 'ul' ||
    type === 'ol' ||
    type === 'callout' ||
    type === 'admonition'
  )
}

function applyBlockIdsAndPlaceholder(container: HTMLElement) {
  const slots = Array.from(container.querySelectorAll('.node-slot'))
  const topLevelBlocks: { slot: Element; content: Element; type: string; top: number; height: number }[] = []

  // Clear previously assigned block IDs so that nested content from earlier
  // runs does not leak into the block map used by scroll sync.
  slots.forEach((slot) => {
    const content = slot.querySelector('.node-content')
    if (content) {
      content.removeAttribute('data-block-id')
      content.removeAttribute('data-block-index')
    }
  })

  const containerRect = container.getBoundingClientRect()

  slots.forEach((slot) => {
    const content = slot.querySelector('.node-content')
    if (!content) return

    const nodeType = slot.getAttribute('data-node-type')
    const type = getTopLevelBlockType(content, nodeType)
    if (!type) return

    const htmlSlot = slot as HTMLElement
    const rect = htmlSlot.getBoundingClientRect()
    const top = rect.top - containerRect.top
    const height = rect.height

    // Skip nested slots that fall inside a previously-seen wrapper block
    // (e.g. list items inside a <ul>/<ol> or paragraphs inside a <blockquote>).
    const insideWrapper = topLevelBlocks.some((b) => {
      if (!isWrapperBlockType(b.type)) return false
      return top >= b.top && top < b.top + b.height
    })
    if (insideWrapper) return

    // Skip duplicate slots that share the exact same position as the previous
    // block (some markstream blocks are rendered twice).
    const prev = topLevelBlocks[topLevelBlocks.length - 1]
    if (prev && top === prev.top && height === prev.height) return

    topLevelBlocks.push({ slot, content, type, top, height })
  })

  topLevelBlocks.forEach(({ slot, content }, index) => {
    const blockId = `block-${index}`
    content.setAttribute('data-block-id', blockId)
    content.setAttribute('data-block-index', String(index))
    slot.setAttribute('data-block-slot-id', blockId)
  })

  // Placeholder is inserted into the slot that matches the requested block id.
  if (props.placeholderBlockId != null && props.placeholderHeight != null) {
    const target = topLevelBlocks[Number(props.placeholderBlockId.replace('block-', ''))]
    if (target) {
      const existing = target.slot.querySelector(':scope > .autodown-block-placeholder')
      if (!existing) {
        const placeholder = document.createElement('div')
        placeholder.className = 'autodown-block-placeholder'
        placeholder.style.height = `${props.placeholderHeight}px`
        target.slot.insertBefore(placeholder, target.slot.firstChild)
      }
    }
  }
}

async function refresh() {
  if (!containerRef.value) return
  await nextTick()
  clearPlaceholders(containerRef.value)
  applyBlockIdsAndPlaceholder(containerRef.value)
  highlightCodeBlocks(containerRef.value)
  // plan 039 T14: addCodeBlockHeaders (injected in-pre badge + copy button)
  // retired — the code block widget's header now carries the language
  // trigger and the copy/collapse actions as first-class content.
  wrapDetailsContent(containerRef.value)
}

/**
 * Wrap the body of each native <details> element (everything except <summary>)
 * in a .details-content container so we can apply consistent padding and
 * margins without affecting the summary row.
 */
function wrapDetailsContent(container: HTMLElement) {
  const detailsBlocks = Array.from(
    container.querySelectorAll('details:not([data-details-wrapped])')
  )
  detailsBlocks.forEach((details) => {
    const children = Array.from(details.children).filter((child) => {
      const tag = child.tagName.toLowerCase()
      return tag !== 'summary' && tag !== 'details' && !child.classList.contains('details-content')
    })
    if (children.length === 0) return

    const wrapper = document.createElement('div')
    wrapper.className = 'details-content'
    children.forEach((child) => wrapper.appendChild(child))
    details.appendChild(wrapper)
    details.setAttribute('data-details-wrapped', '')
  })
}

function handleContainerClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  // plan 039 T14: the actions live in the widget header, a SIBLING of the
  // pre — resolve the pre through the container.
  const resolvePre = (el: HTMLElement) =>
    el.closest('pre') ?? el.closest('.code-block-container')?.querySelector('pre[data-language]') ?? null
  const copyBtn = target.closest?.('[data-codeblock-copy-btn]') as HTMLElement | null
  if (copyBtn && containerRef.value) {
    const pre = resolvePre(copyBtn)
    const code = pre?.querySelector('code')?.textContent ?? ''
    event.preventDefault()
    event.stopPropagation()
    navigator.clipboard.writeText(code)
    return
  }
  // Whole-header collapse (read pane only — the editor pane's header doubles
  // as the block-focus/language-menu surface and stays icon-only via
  // CodeBlockMenu): details/summary model, the header is the largest hit
  // target. The language trigger keeps its own semantics and never collapses;
  // the expand icon needs no special case — it is header content.
  const header = target.closest?.('.code-block-header') as HTMLElement | null
  const languageTrigger = target.closest?.('[data-codeblock-language-badge]') as HTMLElement | null
  if (header && !languageTrigger && containerRef.value) {
    event.preventDefault()
    event.stopPropagation()
    header
      .closest('.code-block-container')
      ?.querySelector('pre[data-language]')
      ?.classList.toggle('is-collapsed')
  }
}

/**
 * Apply lowlight syntax highlighting to code blocks rendered by markstream-vue.
 * The original `<code>` content is replaced by highlighted tokens whenever a
 * non-text language is available and registered.
 */
function highlightCodeBlocks(container: HTMLElement) {
  const codeBlocks = Array.from(container.querySelectorAll('pre[data-language] > code'))
  codeBlocks.forEach((code) => {
    const pre = code.parentElement as HTMLPreElement
    const rawLanguage = pre.getAttribute('data-language')
    const language = rawLanguage === 'plaintext' ? 'text' : rawLanguage
    if (!language || language === 'text' || code.getAttribute('data-highlighted') === language) return
    if (!lowlight.registered(language)) return

    const text = code.textContent || ''
    if (!text) return

    try {
      const tree = lowlight.highlight(language, text)
      code.innerHTML = toHtml(tree)
      code.setAttribute('data-highlighted', language)
    } catch {
      // Unknown language or malformed input; leave plain text intact.
    }
  })
}

watch(
  () => [segments.value, props.placeholderBlockId, props.placeholderHeight],
  () => refresh(),
  { deep: true, flush: 'post' }
)

onMounted(() => {
  if (!containerRef.value) return
  mutationObserver = createMutationObserver()
  mutationObserver.observe(containerRef.value, { childList: true, subtree: true })
  containerRef.value.addEventListener('click', handleContainerClick, { capture: true })
})

onBeforeUnmount(() => {
  mutationObserver?.disconnect()
  containerRef.value?.removeEventListener('click', handleContainerClick, { capture: true })
})

defineExpose({
  containerRef,
})
</script>

<style scoped>
/* Accent tokens: single-sourced in autodown-editor.css (PLAN-051 T3) — the
   `.autodown-editor, .streaming-document` rule there feeds this root too
   (this stylesheet ships with every engine consumer via style.css). */

/* Segment spacing */
.streaming-document > * + * {
  margin-top: 0.75rem;
}

/* Intra-segment block rhythm: slot spacing inside single markdown renderer (PLAN-076 / musk PLAN-056 convergence) */
.streaming-document :deep(.markdown-renderer > .node-slot + .node-slot) {
  margin-top: 0.75rem;
}

/* Scroll sync controls the gap between slots via margin-bottom. Zero the
   leading/trailing margins of the rendered node's children so they cannot
   collapse with adjacent slots and throw off the measurement. The first slot
   keeps its top margin so the first block aligns with the editor.
   Active ONLY in scroll-sync mode (placeholderBlockId set): without it the
   zeroing kills intra-segment heading/paragraph rhythm for plain streaming
   reads. */
.streaming-document.is-sync :deep(.node-slot:not(:first-of-type) > .node-content > *:first-child) {
  margin-top: 0 !important;
}
.streaming-document.is-sync :deep(.node-slot:not(:last-of-type) > .node-content > *:last-child) {
  margin-bottom: 0 !important;
}

/* ---------- Base typography (match @autodown/editor) ---------- */
.streaming-document :deep(.markdown-renderer) {
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--ad-fg, #111827);
}

/* Headings */
.streaming-document :deep(h1),
.streaming-document :deep(h2),
.streaming-document :deep(h3) {
  font-weight: 700;
  margin-top: 1.6rem;
  margin-bottom: 0.9rem;
  line-height: 1.3;
  color: var(--ad-accent-strong);
}

.streaming-document :deep(h1) {
  font-size: 1.58rem;
  margin-top: 1.2rem;
  margin-bottom: 1.1rem;
}

.streaming-document :deep(h2) {
  font-size: 1.33rem;
}

.streaming-document :deep(h3) {
  font-size: 1.18rem;
}

/* musk plan 072: h4-h6 had no rules here — the app reset (Tailwind
   preflight) zeroed their margins and they glued to the surrounding blocks.
   Same descending rhythm, continuing from h3. */
.streaming-document :deep(h4) {
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.3;
  margin-top: 1.4rem;
  margin-bottom: 0.7rem;
  color: var(--ad-accent-strong);
}

.streaming-document :deep(h5) {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.3;
  margin-top: 1.3rem;
  margin-bottom: 0.6rem;
  color: var(--ad-accent-strong);
}

.streaming-document :deep(h6) {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.3;
  margin-top: 1.2rem;
  margin-bottom: 0.6rem;
  color: var(--ad-accent-strong);
}

/* Paragraphs */
.streaming-document :deep(p) {
  margin: 0.5rem 0;
}

/* Lists / blockquote chrome: retired with the container-family
   single-sourcing (plan 042 T2) — the widget-class rules in
   autodown-editor.css (loaded by every engine consumer, pane-agnostic)
   own .list-node/.list-item/.blockquote everywhere. */

/* Admonition / Callout — override markstream-vue defaults to match editor */
.streaming-document :deep(.admonition) {
  position: relative !important;
  margin: 1rem 0 !important;
  border-radius: 12px !important;
  padding: 1.1rem 1rem 1rem !important;
  overflow: visible !important;
}

.streaming-document :deep(.admonition-legend) {
  position: absolute !important;
  top: 0 !important;
  left: 0.75rem !important;
  transform: translateY(-50%) !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 0.35rem !important;
  padding: 0 0.5rem !important;
  background: var(--ad-surface, #ffffff) !important;
  font-size: 0.8125rem !important;
  font-weight: 600 !important;
  line-height: 1 !important;
}

.streaming-document :deep(.admonition-icon) {
  width: 1rem !important;
  height: 1rem !important;
}

.streaming-document :deep(.admonition-content) {
  padding: 0 !important;
  color: var(--ad-fg, #111827) !important;
}

.streaming-document :deep(.admonition-content) > .markdown-renderer > *:first-child {
  margin-top: 0 !important;
}

.streaming-document :deep(.admonition-content) > .markdown-renderer > *:last-child {
  margin-bottom: 0 !important;
}

.streaming-document :deep(.admonition-note) {
  background: #eff6ff !important;
  border: 1px solid #bfdbfe !important;
}
.streaming-document :deep(.admonition-note) .admonition-legend {
  color: #2563eb !important;
}
.streaming-document :deep(.admonition-info) {
  background: #f0f9ff !important;
  border: 1px solid #7dd3fc !important;
}
.streaming-document :deep(.admonition-info) .admonition-legend {
  color: #0284c7 !important;
}
.streaming-document :deep(.admonition-tip) {
  background: #f0fdf4 !important;
  border: 1px solid #86efac !important;
}
.streaming-document :deep(.admonition-tip) .admonition-legend {
  color: #16a34a !important;
}
.streaming-document :deep(.admonition-warning),
.streaming-document :deep(.admonition-caution) {
  background: #fffbeb !important;
  border: 1px solid #fcd34d !important;
}
.streaming-document :deep(.admonition-warning) .admonition-legend,
.streaming-document :deep(.admonition-caution) .admonition-legend {
  color: #d97706 !important;
}
.streaming-document :deep(.admonition-danger),
.streaming-document :deep(.admonition-error) {
  background: #fef2f2 !important;
  border: 1px solid #fca5a5 !important;
}
.streaming-document :deep(.admonition-danger) .admonition-legend,
.streaming-document :deep(.admonition-error) .admonition-legend {
  color: #dc2626 !important;
}

/* Details / Summary — keep native <details> but style consistently */
.streaming-document :deep(details) {
  margin: 0.75rem 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: var(--ad-surface, #ffffff);
  overflow: hidden;
}

.streaming-document :deep(details summary) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.75rem;
  background: hsl(220 9% 46% / 0.06);
  border-bottom: 1px solid transparent;
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--ad-fg, #111827);
  user-select: none;
  cursor: pointer;
  list-style: none;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.streaming-document :deep(details summary::-webkit-details-marker) {
  display: none;
}

.streaming-document :deep(details[open] summary) {
  border-bottom-color: #e5e7eb;
}

.streaming-document.is-dark :deep(details),
.streaming-document.is-dark :deep(details[open] summary) {
  border-color: #3f3f46;
}

.streaming-document :deep(details summary:hover) {
  background: hsl(220 9% 46% / 0.1);
}

.streaming-document :deep(details summary::before) {
  content: '▶';
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  font-size: 0.7rem;
  color: var(--ad-accent);
  transition: transform 0.15s ease;
}

.streaming-document :deep(details[open] summary::before) {
  transform: rotate(90deg);
}

.streaming-document :deep(details .details-content) {
  display: block;
  padding: 0.75rem 0.75rem 0.75rem 2rem;
  background: hsl(220 9% 46% / 0.02);
}

.streaming-document :deep(details .details-content) > :first-child {
  margin-top: 0 !important;
}

.streaming-document :deep(details .details-content) > :last-child {
  margin-bottom: 0 !important;
}

.streaming-document :deep(details .details-content) p,
.streaming-document :deep(details .details-content) .paragraph-node {
  margin: 0.5rem 0 !important;
}

/* Plain-text code blocks (markstream-vue defaults missing language to 'plaintext') */
.streaming-document :deep(pre[data-language="text"]),
.streaming-document :deep(pre[data-language="plaintext"]) {
  position: relative;
  margin: 0.75rem 0;
  padding: 2rem 1rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #f8f9fa;
  overflow-x: auto;
}

/* Hide the pseudo-element header when a real header bar has been injected */
.streaming-document :deep(pre[data-language][data-header-added])::before {
  display: none;
}

/* Language header bar (injected element) */
.streaming-document :deep(pre[data-language] .codeblock-language-badge) {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
  height: 1.9rem;
  box-sizing: border-box;
  padding: 0.35rem 0.5rem 0.35rem 0.75rem;
  background: hsl(220 9% 46% / 0.08);
  border-bottom: 1px solid #e5e7eb;
  border-radius: 8px 8px 0 0;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  line-height: 1.5;
  color: #6b7280;
  user-select: none;
  pointer-events: auto;
  white-space: nowrap;
  overflow: hidden;
}

.streaming-document :deep(pre[data-language] .codeblock-language-label) {
  position: relative;
  margin-right: 20px;
  cursor: default;
  text-transform: lowercase;
}

.streaming-document :deep(pre[data-language] .codeblock-language-label::after) {
  content: '▼';
  position: absolute;
  right: -16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.55rem;
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
}

.streaming-document :deep(pre[data-language] .codeblock-language-label:hover::after) {
  opacity: 1;
}

.streaming-document :deep(pre[data-language] .codeblock-language-label:hover) {
  color: var(--ad-fg, #111827);
}

/* Copy button for code blocks */
.streaming-document :deep(pre[data-language] .codeblock-copy-btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  line-height: 1;
}

.streaming-document :deep(pre[data-language] .codeblock-copy-btn:hover) {
  background: hsl(220 9% 46% / 0.14);
  color: var(--ad-fg, #111827);
}

.streaming-document :deep(pre[data-language] .codeblock-copy-icon) {
  display: inline-block;
  width: 14px;
  height: 14px;
  -webkit-mask-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNCIgaGVpZ2h0PSIxNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3QgeD0iOSIgeT0iOSIgd2lkdGg9IjEzIiBoZWlnaHQ9IjEzIiByeD0iMiIgcnk9IjIiLz48cGF0aCBkPSJNNSAxNUg0YTIgMiAwIDAgMS0yLTJWNGEyIDIgMCAwIDEgMi0yaDlhMiAyIDAgMCAxIDIgMnYxIi8+PC9zdmc+");
  mask-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNCIgaGVpZ2h0PSIxNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3QgeD0iOSIgeT0iOSIgd2lkdGg9IjEzIiBoZWlnaHQ9IjEzIiByeD0iMiIgcnk9IjIiLz48cGF0aCBkPSJNNSAxNUg0YTIgMiAwIDAgMS0yLTJWNGEyIDIgMCAwIDEgMi0yaDlhMiAyIDAgMCAxIDIgMnYxIi8+PC9zdmc+");
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  background-color: currentColor;
}

/* Code blocks — window style with header bar */
.streaming-document :deep(pre[data-language]) {
  position: relative;
  margin: 0.75rem 0;
  padding: 2rem 1rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #f8f9fa;
  overflow-x: auto;
}

/* Code blocks without a language — treated as plain text */
.streaming-document :deep(pre:not([data-language])) {
  margin: 0.75rem 0;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #f8f9fa;
  overflow-x: auto;
}

.streaming-document :deep(pre code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.88rem;
  line-height: 1.5;
  background: none;
  padding: 0;
  border: none;
  color: var(--ad-fg, #111827);
}

/* ─── Lowlight syntax highlighting tokens (preview) ───
   Match the editor's light theme token colors. */
.streaming-document :deep(pre code .hljs-keyword),
.streaming-document :deep(pre code .hljs-selector-tag),
.streaming-document :deep(pre code .hljs-doctag),
.streaming-document :deep(pre code .hljs-section) {
  color: #d73a49;
  font-weight: 600;
}

.streaming-document :deep(pre code .hljs-title),
.streaming-document :deep(pre code .hljs-title.function_),
.streaming-document :deep(pre code .hljs-function .hljs-title) {
  color: #6f42c1;
}

.streaming-document :deep(pre code .hljs-string),
.streaming-document :deep(pre code .hljs-regexp),
.streaming-document :deep(pre code .hljs-addition) {
  color: #032f62;
}

.streaming-document :deep(pre code .hljs-number),
.streaming-document :deep(pre code .hljs-literal),
.streaming-document :deep(pre code .hljs-variable),
.streaming-document :deep(pre code .hljs-template-variable),
.streaming-document :deep(pre code .hljs-attr),
.streaming-document :deep(pre code .hljs-attribute) {
  color: #005cc5;
}

.streaming-document :deep(pre code .hljs-comment),
.streaming-document :deep(pre code .hljs-quote),
.streaming-document :deep(pre code .hljs-deletion) {
  color: #6a737d;
  font-style: italic;
}

.streaming-document :deep(pre code .hljs-meta),
.streaming-document :deep(pre code .hljs-meta-keyword),
.streaming-document :deep(pre code .hljs-meta-string) {
  color: #176f2c;
}

.streaming-document :deep(pre code .hljs-tag),
.streaming-document :deep(pre code .hljs-name),
.streaming-document :deep(pre code .hljs-built_in),
.streaming-document :deep(pre code .hljs-type) {
  color: #22863a;
}

.streaming-document :deep(pre code .hljs-emphasis) {
  font-style: italic;
}

.streaming-document :deep(pre code .hljs-strong) {
  font-weight: 700;
}

/* Math blocks — reserve the same vertical space as the editor's bordered block */
.streaming-document :deep(.math-block) {
  margin: 0.75rem 0;
  padding: 0.75rem 1rem;
  border: 1px solid transparent;
  border-radius: 8px;
  box-sizing: border-box;
}

.streaming-document :deep(.math-block .katex-display) {
  margin: 0 !important;
}

/* Mermaid blocks — markstream-vue uses Tailwind utility classes that are not
   available in this project, so we provide explicit fallback styles. */
.streaming-document :deep(.mermaid-block-container) {
  margin: 0.75rem 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: var(--ad-surface, #ffffff);
  overflow: hidden;
}

.streaming-document :deep(.mermaid-block-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-height: 1.9rem;
  padding: 0.35rem 0.5rem 0.35rem 0.75rem;
  background: hsl(220 9% 46% / 0.08);
  border-bottom: 1px solid #e5e7eb;
  box-sizing: border-box;
}

.streaming-document :deep(.mermaid-block-header) > div {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.streaming-document :deep(.mermaid-label-text) {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--ad-muted, #6b7280);
  text-transform: lowercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.streaming-document :deep(.mermaid-mode-toggle-group),
.streaming-document :deep(.mermaid-header-actions) {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.streaming-document :deep(.mermaid-mode-btn),
.streaming-document :deep(.mermaid-action-btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  padding: 0.25rem 0.4rem;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--ad-muted, #6b7280);
  cursor: pointer;
  font-size: 0.8rem;
  line-height: 1;
  transition: background-color 0.1s ease, color 0.1s ease;
}

.streaming-document :deep(.mermaid-mode-btn.is-active),
.streaming-document :deep(.mermaid-mode-btn:hover),
.streaming-document :deep(.mermaid-action-btn:hover) {
  background: hsl(220 9% 46% / 0.14);
  color: var(--ad-fg, #111827);
}

.streaming-document :deep(.mermaid-block-header .action-icon) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1em;
  height: 1em;
  flex-shrink: 0;
}

.streaming-document :deep(.mermaid-block-container) > div:not(.mermaid-block-header) .relative {
  position: relative;
}

.streaming-document :deep(.mermaid-block-container) > div:not(.mermaid-block-header) .absolute.top-2.right-2 {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 10;
}

.streaming-document :deep(.mermaid-block-container) > div:not(.mermaid-block-header) .absolute.top-2.right-2 > .flex {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.streaming-document :deep(.mermaid-preview-area) {
  max-height: 320px;
  overflow: auto;
  background: var(--ad-surface, #ffffff);
}

.streaming-document :deep(.mermaid-source-panel) {
  padding: 0.75rem 1rem;
  background: #f8f9fa;
}

.streaming-document :deep(.mermaid-source-code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.88rem;
  line-height: 1.5;
  white-space: pre-wrap;
  color: var(--ad-fg, #111827);
}

/* Inline code */
.streaming-document :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85em;
  background: hsl(220 9% 46% / 0.08);
  padding: 0.15rem 0.35rem;
  border-radius: 4px;
  color: var(--ad-fg, #111827);
}

/* Links */
.streaming-document :deep(a) {
  color: var(--ad-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.streaming-document :deep(a:hover) {
  opacity: 0.8;
}

/* Override markstream-vue code block chrome (Tailwind classes are not available here) */
.streaming-document :deep(.code-block-container) {
  border: 1px solid #e5e7eb !important;
  border-radius: 8px;
  overflow: hidden;
  background: #f9fafb !important;
}

.streaming-document :deep(.code-editor-container.is-hidden) {
  display: none !important;
}

/* Use markstream's own header bar, but give it concrete layout/size because
   Tailwind utility classes are not present. */
.streaming-document :deep(.code-block-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-height: 36px;
  padding: 0 0.75rem;
  background: #e5e7eb;
  border-bottom: 1px solid #d1d5db;
  color: #374151;
  font-size: 0.85rem;
}

.streaming-document :deep(.code-block-header svg) {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.streaming-document :deep(.code-block-header .code-header-main) {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.streaming-document :deep(.code-block-header .icon-slot) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.streaming-document :deep(.code-block-header .icon-slot svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.streaming-document :deep(.code-block-header > .flex) {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* The actions render in the family widget's DOM order ([copy][collapse]) —
   the same order the editor pane's faces use. An earlier revision of this
   rule reordered them (chevron -> copy -> three-dots) for a header that
   still had a three-dots menu; with the menu retired by the family
   unification the reorder only desynced the two panes. */

.streaming-document :deep(.code-block-header button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0.2rem;
  color: inherit;
}

.streaming-document :deep(.code-block-header button svg) {
  width: 16px;
  height: 16px;
}

/* Our own injected badge duplicates the header info, so hide it in preview. */
.streaming-document :deep(pre[data-language] .codeblock-language-badge) {
  display: none;
}

.streaming-document :deep(pre[data-language]) {
  padding: 0.85em 1em !important;
  margin: 0;
  background: #f9fafb;
  border: none !important;
}

/* Images */
.streaming-document :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  margin: 0.5rem 0;
  display: block;
}

/* Broken image fallback (markstream-vue renders .image-error) */
.streaming-document :deep(.image-error) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 50px;
  padding: 0.5rem 1rem;
  margin: 0.5rem 0;
  background: hsl(220 9% 46% / 0.06);
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  color: #9ca3af;
  font-size: 0.85rem;
}

.streaming-document :deep(.image-error svg) {
  display: none;
}

.streaming-document :deep(.image-error span)::before {
  content: '🖼️ ';
}

/* Horizontal rule */
.streaming-document :deep(hr) {
  margin: 1rem 0;
  border: none;
  border-top: 1px solid var(--ad-border, #e5e7eb);
}

/* ---------- Tables ----------
   Table chrome retired with the table-family single-sourcing (plan 042 T3):
   the widget-class .table-node rules in autodown-editor.css (loaded by
   every engine consumer, pane-agnostic) own both faces' cells everywhere.
   The resize-handle hide below stays — it is a streaming-pane presentation
   choice for the view face's handles, not cell chrome. */
/* ---------- Task list ---------- */
.streaming-document :deep(ul):has(.checkbox-node) {
  list-style: none;
  padding-left: 0;
}

.streaming-document :deep(li):has(.checkbox-node) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.25rem 0;
}

.streaming-document :deep(.checkbox-icon.checkbox-checked) {
  color: var(--ad-accent);
}

.streaming-document :deep(.checkbox-icon.checkbox-unchecked) {
  color: #9ca3af;
}

.streaming-document :deep(.checkbox-icon.checkbox-checked path) {
  stroke: white;
}

.streaming-document :deep(.checkbox-node) {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
}

/* Hide markstream-vue built-in resize handle */
.streaming-document :deep(.table-node__resize-handle) {
  display: none !important;
}

/* ─── Dark theme overrides (PLAN-051 T4; Design 22 §7.4 深色列 = VM zinc
   baseline). Only faces whose dark value is NOT a plain var() flip live
   here — token-driven surfaces (fg/border/surface/headings/links/table th)
   go dark via the .is-dark token rule in autodown-editor.css. !important
   mirrors the vendor-override layer it must beat (markstream !important
   rules); higher specificity (.is-dark) does the rest. ─── */

.streaming-document.is-dark :deep(pre),
.streaming-document.is-dark :deep(pre[data-language]),
.streaming-document.is-dark :deep(pre:not([data-language])) {
  background: #09090b !important;
  border-color: #3f3f46 !important;
}

.streaming-document.is-dark :deep(.code-block-container) {
  background: #09090b !important;
  border-color: #3f3f46 !important;
}

.streaming-document.is-dark :deep(.code-block-header) {
  background: #27272a !important;
  border-bottom-color: #3f3f46 !important;
  color: #a1a1aa !important;
}

.streaming-document.is-dark :deep(.codeblock-language-badge) {
  background: rgb(161 161 170 / 0.1);
  border-bottom-color: #3f3f46;
  color: #a1a1aa;
}

.streaming-document.is-dark :deep(code) {
  background: rgb(161 161 170 / 0.12);
}

.streaming-document.is-dark :deep(.admonition-note) {
  background: rgb(59 130 246 / 0.1) !important;
  border-color: rgb(59 130 246 / 0.5) !important;
}

.streaming-document.is-dark :deep(.admonition-note) .admonition-legend {
  color: #60a5fa !important;
}

.streaming-document.is-dark :deep(.admonition-info) {
  background: rgb(14 165 233 / 0.1) !important;
  border-color: rgb(14 165 233 / 0.5) !important;
}

.streaming-document.is-dark :deep(.admonition-info) .admonition-legend {
  color: #38bdf8 !important;
}

.streaming-document.is-dark :deep(.admonition-tip) {
  background: rgb(16 185 129 / 0.1) !important;
  border-color: rgb(16 185 129 / 0.5) !important;
}

.streaming-document.is-dark :deep(.admonition-tip) .admonition-legend {
  color: #34d399 !important;
}

.streaming-document.is-dark :deep(.admonition-warning),
.streaming-document.is-dark :deep(.admonition-caution) {
  background: rgb(245 158 11 / 0.1) !important;
  border-color: rgb(245 158 11 / 0.5) !important;
}

.streaming-document.is-dark :deep(.admonition-warning) .admonition-legend,
.streaming-document.is-dark :deep(.admonition-caution) .admonition-legend {
  color: #fbbf24 !important;
}

.streaming-document.is-dark :deep(.admonition-danger),
.streaming-document.is-dark :deep(.admonition-error) {
  background: rgb(239 68 68 / 0.1) !important;
  border-color: rgb(239 68 68 / 0.5) !important;
}

.streaming-document.is-dark :deep(.admonition-danger) .admonition-legend,
.streaming-document.is-dark :deep(.admonition-error) .admonition-legend {
  color: #f87171 !important;
}

.streaming-document.is-dark :deep(.mermaid-source-panel) {
  background: #09090b;
}

.streaming-document.is-dark :deep(.mermaid-block-container) > div:not(.mermaid-block-header) .flex {
  background: rgba(9, 9, 11, 0.9);
}

.streaming-document.is-dark :deep(.image-error) {
  background: rgb(161 161 170 / 0.06);
  border-color: #3f3f46;
  color: #a1a1aa;
}

.streaming-document.is-dark :deep(.checkbox-icon.checkbox-unchecked) {
  color: #a1a1aa;
}

/* hljs dark tokens (streaming side) — values from the dual-track single
   source (packages/engine/rust/src/hljs_scope_map.rs, github-dark palette). */
.streaming-document.is-dark :deep(pre code .hljs-keyword),
.streaming-document.is-dark :deep(pre code .hljs-selector-tag),
.streaming-document.is-dark :deep(pre code .hljs-doctag),
.streaming-document.is-dark :deep(pre code .hljs-section) {
  color: #ff7b72;
}

.streaming-document.is-dark :deep(pre code .hljs-title),
.streaming-document.is-dark :deep(pre code .hljs-title.function_),
.streaming-document.is-dark :deep(pre code .hljs-function .hljs-title) {
  color: #d2a8ff;
}

.streaming-document.is-dark :deep(pre code .hljs-string),
.streaming-document.is-dark :deep(pre code .hljs-regexp),
.streaming-document.is-dark :deep(pre code .hljs-addition) {
  color: #a5d6ff;
}

.streaming-document.is-dark :deep(pre code .hljs-number),
.streaming-document.is-dark :deep(pre code .hljs-literal),
.streaming-document.is-dark :deep(pre code .hljs-variable),
.streaming-document.is-dark :deep(pre code .hljs-template-variable),
.streaming-document.is-dark :deep(pre code .hljs-attr),
.streaming-document.is-dark :deep(pre code .hljs-attribute) {
  color: #79c0ff;
}

.streaming-document.is-dark :deep(pre code .hljs-comment),
.streaming-document.is-dark :deep(pre code .hljs-quote),
.streaming-document.is-dark :deep(pre code .hljs-deletion) {
  color: #8b949a;
}

.streaming-document.is-dark :deep(pre code .hljs-meta),
.streaming-document.is-dark :deep(pre code .hljs-meta-keyword),
.streaming-document.is-dark :deep(pre code .hljs-meta-string) {
  color: #7ee787;
}

.streaming-document.is-dark :deep(pre code .hljs-tag),
.streaming-document.is-dark :deep(pre code .hljs-name),
.streaming-document.is-dark :deep(pre code .hljs-built_in),
.streaming-document.is-dark :deep(pre code .hljs-type) {
  color: #7ee787;
}
</style>
