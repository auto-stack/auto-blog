// @autodown/engine — ./parser exit, frozen in plan 017 Phase 3. Kernel
// layer public surface: document parse (streaming subset) + block parse +
// serialize. The wider kernel internals (block ops, IAL preprocessing)
// stay layer-internal; the vue-free property is asserted at build time
// (scripts/assert-parser-pure.mjs).
export { parseDocument, parse_blocks } from './parser/markdown-parser'
export { serialize, serializeBlocks } from './parser/serializer'
// plan-022 Phase 5 (jade blockParser retirement): block-tree inspection
// helpers for front-side view-model assembly (all vue-free pure kernel).
export { BlockType, anchorOf, attrGetInt, spansText } from './parser/block-model'
export type { BlockNode } from './parser/block-model'
