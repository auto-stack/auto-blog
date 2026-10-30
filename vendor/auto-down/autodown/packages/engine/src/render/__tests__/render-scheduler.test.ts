// Scheduler tests (plan 008, Phase 3 batch B): the Auto-generated decision
// functions (auto/render_scheduler.at) and the Vue composable driving them
// with an injected fake timer (the VM-side adapter contract).

import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import {
  liveWindowStart,
  nextBatchCount,
  typewriterNextChars,
} from '../render-scheduler.generated'
import { useRenderScheduler, type SchedulerTimer } from '../use-render-scheduler'

describe('scheduling decisions (generated from render_scheduler.at)', () => {
  it('nextBatchCount advances by batch size and clamps at total', () => {
    expect(nextBatchCount(0, 100, 40)).toBe(40)
    expect(nextBatchCount(40, 100, 40)).toBe(80)
    expect(nextBatchCount(80, 100, 40)).toBe(100)
    expect(nextBatchCount(100, 100, 40)).toBe(100)
    // batch size 0 -> everything at once
    expect(nextBatchCount(0, 10, 0)).toBe(10)
  })

  it('liveWindowStart keeps the tail window', () => {
    expect(liveWindowStart(100, 320)).toBe(0)
    expect(liveWindowStart(500, 320)).toBe(180)
    // disabled windowing
    expect(liveWindowStart(500, 0)).toBe(0)
    expect(liveWindowStart(50, 100)).toBe(0)
  })

  it('typewriterNextChars steps characters and finishes at total', () => {
    expect(typewriterNextChars(0, 10, 2)).toBe(2)
    expect(typewriterNextChars(8, 10, 2)).toBe(10)
    expect(typewriterNextChars(10, 10, 2)).toBe(10)
    expect(typewriterNextChars(0, 10, 0)).toBe(10)
  })
})

/** Deterministic timer: ticks are flushed manually. */
function fakeTimer() {
  const queue: Array<() => void> = []
  const timer: SchedulerTimer = {
    setTimeout(fn) {
      queue.push(fn)
      return queue.length - 1
    },
    clearTimeout() {},
  }
  return {
    timer,
    flushAll() {
      let guard = 0
      while (queue.length > 0 && guard < 10000) {
        queue.shift()!()
        guard += 1
      }
    },
  }
}

function manyNodes(n: number) {
  return Array.from({ length: n }, (_, i) => ({ type: 'paragraph', children: [{ type: 'text', content: `n${i}` }] }))
}

describe('useRenderScheduler composable', () => {
  it('batched: reveals nodes progressively then completes', () => {
    const { timer, flushAll } = fakeTimer()
    const nodes = ref(manyNodes(10))
    const { visibleNodes, visibleCount } = useRenderScheduler(nodes, {
      enabled: true,
      batchSize: 4,
      batchDelay: 8,
      maxLiveNodes: 0,
      typewriter: false,
      typewriterChunk: 2,
      timer,
    })
    // immediate first batch on watch
    expect(visibleCount.value).toBeGreaterThan(0)
    expect(visibleCount.value).toBeLessThanOrEqual(10)
    flushAll()
    expect(visibleCount.value).toBe(10)
    expect(visibleNodes.value).toHaveLength(10)
  })

  it('disabled batching renders everything immediately', () => {
    const { timer } = fakeTimer()
    const nodes = ref(manyNodes(10))
    const { visibleCount } = useRenderScheduler(nodes, {
      enabled: false,
      batchSize: 4,
      batchDelay: 8,
      maxLiveNodes: 0,
      typewriter: false,
      typewriterChunk: 2,
      timer,
    })
    expect(visibleCount.value).toBe(10)
  })

  it('maxLiveNodes windows the mounted slice to the tail', () => {
    const { timer, flushAll } = fakeTimer()
    const nodes = ref(manyNodes(100))
    const { visibleNodes, visibleCount, windowStart } = useRenderScheduler(nodes, {
      enabled: true,
      batchSize: 50,
      batchDelay: 8,
      maxLiveNodes: 30,
      typewriter: false,
      typewriterChunk: 2,
      timer,
    })
    flushAll()
    expect(visibleCount.value).toBe(100)
    expect(windowStart.value).toBe(70)
    expect(visibleNodes.value).toHaveLength(30)
    expect((visibleNodes.value[29] as any).children[0].content).toBe('n99')
  })

  it('typewriter reveals the last node text character by character', () => {
    const { timer, flushAll } = fakeTimer()
    const nodes = ref([
      { type: 'paragraph', children: [{ type: 'text', content: 'done' }] },
      { type: 'paragraph', children: [{ type: 'text', content: 'typing here' }] },
    ])
    const { typewriterChars, visibleCount } = useRenderScheduler(nodes, {
      enabled: true,
      batchSize: 10,
      batchDelay: 8,
      maxLiveNodes: 0,
      typewriter: true,
      typewriterChunk: 4,
      timer,
    })
    flushAll()
    expect(visibleCount.value).toBe(2)
    // 11 chars in the last node, chunk 4 -> finished at exactly 11
    expect(typewriterChars.value).toBe(11)
  })
})
