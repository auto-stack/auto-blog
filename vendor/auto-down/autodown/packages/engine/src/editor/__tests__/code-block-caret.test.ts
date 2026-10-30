// CodeBlock edit-face caret + draft contracts (the click-caret fix): the
// parser stores closed-fence code with one trailing "\n" (representation —
// see markdown-parser's fence body join), and the edit face collapses it so
// the caret-bearing textarea doesn't grow a phantom empty last line the
// preview never showed. The controller restores it on commit; the
// view-face click → edit-face caret handoff rides the ext bridge's pending
// store (interactive placement is pinned by the demo e2e — SSR can't click).

import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { findBlock, blockText } from '../../parser/block-model'
import { parse_blocks } from '../../parser/markdown-parser'
import { serialize } from '../../parser/serializer'
import { EditorEngine } from '../engine/editor-engine'
import { CodeEditorController } from '../engine/code-editor-controller'
import {
  draftCodeOf,
  captureCodeClick,
  takePendingCodeCaret,
} from '../ext/code_block_widget_ext'
import CodeBlockWidget from '../components/CodeBlockWidget.vue'

async function ssr(vnode: unknown): Promise<string> {
  const app = createSSRApp({ render: () => h({ render: () => vnode } as any) })
  return (await renderToString(app)).replace(/<!--.*?-->/g, '')
}

function fenceOf(md: string) {
  const doc = parse_blocks(md, true)
  const engine = new EditorEngine(doc)
  const node = doc.children[0]!
  return { engine, node, blockId: node.id }
}

describe('draftCodeOf: the closed-fence representation newline collapses', () => {
  it('strips exactly one trailing newline (the parser representation)', () => {
    const { node } = fenceOf('```js\nconst a = 1\n```')
    expect(blockText(node)).toBe('const a = 1\n')
    expect(draftCodeOf(node)).toBe('const a = 1')
  })

  it('leaves interior newlines and a truly empty body alone', () => {
    const { node } = fenceOf('```js\na\n\nb\n```')
    expect(draftCodeOf(node)).toBe('a\n\nb')
    const empty = fenceOf('```js\n```')
    expect(draftCodeOf(empty.node)).toBe('')
  })
})

describe('CodeEditorController.commitDraft: representation restored, no phantom diff', () => {
  it('an untouched normalized draft stays a no-op (no undo pollution)', () => {
    const { engine, blockId } = fenceOf('```js\nconst a = 1\n```')
    const c = new CodeEditorController(engine, blockId)
    expect(c.code).toBe('const a = 1\n')
    expect(c.commitDraft('const a = 1')).toBe(false)
    expect(blockText(findBlock(engine.doc, blockId)!)).toBe('const a = 1\n')
  })

  it('an edit writes through with the single representation newline intact', () => {
    const { engine, blockId } = fenceOf('```js\nconst a = 1\n```')
    const c = new CodeEditorController(engine, blockId)
    expect(c.commitDraft('const a = 2')).toBe(true)
    expect(blockText(findBlock(engine.doc, blockId)!)).toBe('const a = 2\n')
    // the round trip still serializes a well-formed closed fence
    expect(serialize(engine.doc, true)).toContain('```js\nconst a = 2\n```')
  })

  it('a deliberately added final line survives (two newlines in the model)', () => {
    const { engine, blockId } = fenceOf('```js\nconst a = 1\n```')
    const c = new CodeEditorController(engine, blockId)
    // user pressed Enter at end: the draft gains a real trailing newline on
    // top of the collapsed representation one
    expect(c.commitDraft('const a = 1\n')).toBe(true)
    expect(blockText(findBlock(engine.doc, blockId)!)).toBe('const a = 1\n\n')
  })

  it('model text without the representation newline commits verbatim', () => {
    const { engine, blockId } = fenceOf('```js\nopen tail')
    const c = new CodeEditorController(engine, blockId)
    expect(c.commitDraft('open tail 2')).toBe(true)
    expect(blockText(findBlock(engine.doc, blockId)!)).toBe('open tail 2')
  })

  it('commit stays verbatim (the math/mermaid faces draft the model text)', () => {
    const { engine, blockId } = fenceOf('```js\nconst a = 1\n```')
    const c = new CodeEditorController(engine, blockId)
    expect(c.commit('const a = 1')).toBe(true)
    expect(blockText(findBlock(engine.doc, blockId)!)).toBe('const a = 1')
  })
})

describe('pending click-caret handoff: pure-store contract', () => {
  it('an event without a DOM target (unit/SSR) stores nothing', () => {
    captureCodeClick({ button: 0, currentTarget: null } as unknown as MouseEvent, 'b1')
    expect(takePendingCodeCaret('b1')).toBeNull()
  })

  it('take clears the store and rejects foreign block ids', () => {
    expect(takePendingCodeCaret('b2')).toBeNull()
    // store a hand-made pending entry through the module surface: a real
    // capture needs caretRangeFromPoint (browser), so the e2e owns that leg;
    // here only the consume-side semantics are pinned
    captureCodeClick({ button: 1, currentTarget: null } as unknown as MouseEvent, 'b3')
    expect(takePendingCodeCaret('b3')).toBeNull()
  })
})

describe('edit face SSR: the textarea drafts the collapsed code', () => {
  it('textarea value carries no phantom trailing newline', async () => {
    const { engine, node, blockId } = fenceOf('```rust\nfn a() {}\n```')
    const html = await ssr(
      h(CodeBlockWidget as any, { mode: 'edit', node, ctx: { engine, blockId, readonly: false } }),
    )
    expect(html).toMatch(/<textarea[^>]*>fn a\(\) \{\}<\/textarea>/)
    expect(html).not.toMatch(/fn a\(\) \{\}\n<\/textarea>/)
  })
})
