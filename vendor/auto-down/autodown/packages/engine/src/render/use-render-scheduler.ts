// Streaming render scheduler (plan 008, Phase 3 batch B): batch progression,
// max-live-nodes windowing, and typewriter character stepping over the
// parsed node tree. The decision math lives in the Auto source
// (auto/render_scheduler.at -> render-scheduler.generated.ts); time comes
// from an injected timer port so a VM backend can supply its own adapter.

import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import {
  liveWindowStart,
  nextBatchCount,
  typewriterNextChars,
} from './render-scheduler.generated'

export interface SchedulerTimer {
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

const defaultTimer: SchedulerTimer = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
}

export interface RenderSchedulerOptions {
  /** progressive batching enabled (false renders everything immediately) */
  enabled: boolean
  /** nodes rendered per tick */
  batchSize: number
  /** ms between batch ticks */
  batchDelay: number
  /** max simultaneously mounted nodes (<= 0 disables windowing) */
  maxLiveNodes: number
  /** typewriter effect on the last text-bearing node */
  typewriter: boolean
  /** characters revealed per typewriter tick */
  typewriterChunk: number
  timer?: SchedulerTimer
}

/**
 * Drives progressive rendering of a parsed node array. Exposes:
 * - `visibleNodes`: the windowed slice that should be mounted
 * - `typewriterChars`: characters of the last node's flattened text that
 *   are revealed (Infinity when the typewriter is off / finished)
 */
export function useRenderScheduler(nodes: Ref<any[]>, opts: RenderSchedulerOptions) {
  const timer = opts.timer ?? defaultTimer
  const visibleCount = ref(nodes.value.length)
  const typewriterChars = ref(Number.POSITIVE_INFINITY)
  let pending: unknown = undefined

  function scheduleTick(fn: () => void) {
    if (pending !== undefined) {
      timer.clearTimeout(pending)
    }
    pending = timer.setTimeout(() => {
      pending = undefined
      fn()
    }, opts.batchDelay)
  }

  function lastNodeText(node: any): string {
    if (!node) return ''
    if (node.type === 'text') return String(node.content ?? '')
    const kids = node.children ?? []
    return kids.map((k: any) => lastNodeText(k)).join('')
  }

  function startTypewriter() {
    const last = nodes.value[nodes.value.length - 1]
    const total = lastNodeText(last).length
    if (total <= 0) {
      typewriterChars.value = Number.POSITIVE_INFINITY
      return
    }
    typewriterChars.value = 0
    const step = () => {
      const next = typewriterNextChars(typewriterChars.value, total, opts.typewriterChunk)
      typewriterChars.value = next
      if (next < total) {
        scheduleTick(step)
      }
    }
    scheduleTick(step)
  }

  watch(
    nodes,
    (next) => {
      if (pending !== undefined) {
        timer.clearTimeout(pending)
        pending = undefined
      }
      if (!opts.enabled) {
        visibleCount.value = next.length
        typewriterChars.value = Number.POSITIVE_INFINITY
        return
      }
      // a new node arriving while a batch is in flight: reveal up to the
      // first batch immediately, then keep ticking
      const target = next.length
      const immediate = Math.min(target, Math.max(1, Math.floor(opts.batchSize / 4) || 1))
      visibleCount.value = Math.max(visibleCount.value, immediate)
      const tick = () => {
        const nextCount = nextBatchCount(visibleCount.value, target, opts.batchSize)
        visibleCount.value = nextCount
        if (nextCount < target) {
          scheduleTick(tick)
        } else if (opts.typewriter) {
          startTypewriter()
        }
      }
      if (visibleCount.value < target) {
        scheduleTick(tick)
      } else if (opts.typewriter) {
        startTypewriter()
      }
    },
    { immediate: true }
  )

  const windowStart = computed(() => liveWindowStart(visibleCount.value, opts.maxLiveNodes))
  const visibleNodes = computed(() => nodes.value.slice(windowStart.value, visibleCount.value))

  onScopeDispose(() => {
    if (pending !== undefined) {
      timer.clearTimeout(pending)
    }
  })

  return { visibleNodes, visibleCount, typewriterChars, windowStart }
}
