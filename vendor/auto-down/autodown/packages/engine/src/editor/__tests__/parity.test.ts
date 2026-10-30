// Edit/render parity (plan 018 Phase 4 acceptance #3) — the 对拍脚本:
// the editing session's display path (serialize(parse_blocks(md)) →
// parseDocument → renderNodes — exactly what EngineEditor renders for
// non-focused blocks) must produce the SAME DOM as rendering the source
// markdown directly through ./render (MarkdownRender). Same document,
// two paths, one projection.

import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { parse_blocks } from '../../parser/markdown-parser'
import { serialize } from '../../parser/serializer'
import { parseDocument } from '../../parser/markdown-parser'
import { renderNodes } from '../../render/render-node'

async function renderVNodes(nodes: any[]): Promise<string> {
  const app = createSSRApp({ render: () => h('div', renderNodes(nodes, true)) })
  return renderToString(app)
}

const FIXTURES = [
  '# 标题\n\n第一段，**加粗**与*斜体*。',
  '- 列表甲\n- 列表乙\n\n> 引用块',
  '```rust\nfn main() {}\n```',
  '| a | b |\n| --- | --- |\n| 1 | 2 |',
  '---\n\n结尾段落 [链接](https://example.com)',
]

describe('edit/render parity (对拍)', () => {
  for (const md of FIXTURES) {
    it(`parity for: ${md.split('\n')[0].slice(0, 24)}`, async () => {
      const editPath = serialize(parse_blocks(md, true), false)
      const direct = await renderVNodes(parseDocument(md, true))
      const viaEdit = await renderVNodes(parseDocument(editPath, true))
      expect(viaEdit).toBe(direct)
    })
  }

  it('edit sessions stay serialization-stable across a save cycle', () => {
    for (const md of FIXTURES) {
      const once = serialize(parse_blocks(md, true), false)
      const twice = serialize(parse_blocks(once, true), false)
      expect(twice).toBe(once)
    }
  })
})
