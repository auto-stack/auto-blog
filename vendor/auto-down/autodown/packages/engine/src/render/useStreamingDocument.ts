// Vue binding for the streaming document segmentation (plan 008, Phase 1).
//
// The segmentation logic lives in the Auto source auto/streaming.at and is
// transpiled to src/streaming.generated.ts (`pnpm gen`); behavioral parity
// with the previous hand-written logic is asserted by
// src/__tests__/streaming-parity.test.ts. This file only adds the Vue
// reactivity layer.

import { computed, type Ref } from 'vue'
import { buildSegments, type StreamingSegment } from './streaming.generated'

export type {
  MarkdownSegment,
  ComponentSegment,
  StreamingSegment,
} from './streaming.generated'

export function useStreamingDocument(rawText: Ref<string>) {
  const segments = computed<StreamingSegment[]>(() => buildSegments(rawText.value))
  return { segments }
}
