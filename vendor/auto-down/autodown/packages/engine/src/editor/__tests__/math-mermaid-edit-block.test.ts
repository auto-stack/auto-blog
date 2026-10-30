// Math/Mermaid edit faces (plan 031; retargeted to the family widgets in
// plan 033 T6): source + live preview in one chrome. Registration goes
// through EngineEditor's plain script (module scope) onto the BlockComponent
// edit slots — the family widgets (MathBlockWidget / MermaidBlockWidget)
// carry the 031 contracts; the CodeEditorController commit protocol
// (whole-text blur commit, one undo step — math/mermaid source lives in
// inlines since plan 030, exactly the shape the controller writes) is
// unchanged. Mermaid's debounced async preview does not run under SSR (Init
// is onMounted-only), so its SSR contract pins the chrome; the state
// machine is pinned by the demo e2e and the ext-bridge unit tests.

import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { blockText, findBlock } from '../../parser/block-model'
import { parse_blocks } from '../../parser/markdown-parser'
import { serialize } from '../../parser/serializer'
import { EditorEngine } from '../engine/editor-engine'
import { CodeEditorController } from '../engine/code-editor-controller'
import { resolveBlockComponent } from '../../render/block-component'
import type { BlockEditCtx } from '../../render/block-component'
import EngineEditor from '../components/EngineEditor.vue'

const MATH_MD = '%{\ne = mc^2\n}%\n'
const MERMAID_MD = '```mermaid\ngraph TD; A-->B;\n```\n'

function docOf(md: string): { engine: EditorEngine; node: ReturnType<typeof findBlock>; blockId: string } {
  const doc = parse_blocks(md, true)
  const engine = new EditorEngine(doc)
  const node = doc.children[0]
  return { engine, node: node!, blockId: node!.id }
}

function editCtx(engine: EditorEngine, blockId: string, readonly = false): BlockEditCtx {
  return { engine, blockId, readonly }
}

async function ssr(vnode: unknown): Promise<string> {
  const app = createSSRApp({ render: () => h({ render: () => vnode } as any) })
  return (await renderToString(app)).replace(/<!--.*?-->/g, '')
}

describe('edit-slot registration (family widgets, plan 033 T6)', () => {
  it('EngineEditor registers dedicated edit faces for MathBlock and Mermaid', () => {
    void EngineEditor // module-scope registration
    expect(typeof resolveBlockComponent('MathBlock').edit).toBe('function')
    expect(typeof resolveBlockComponent('MathBlock').view).toBe('function')
    expect(typeof resolveBlockComponent('MathBlock').stream).toBe('function')
    expect(typeof resolveBlockComponent('Mermaid').edit).toBe('function')
    expect(typeof resolveBlockComponent('Mermaid').view).toBe('function')
  })

  it('the math edit slot renders the family widget face (not the fence face)', async () => {
    void EngineEditor
    const { engine, node, blockId } = docOf(MATH_MD)
    const html = await ssr(resolveBlockComponent('MathBlock').edit!(node!, editCtx(engine, blockId)))
    expect(html).toContain('autodown-math-editor')
    expect(html).not.toContain('autodown-code-editor')
    expect(html).not.toContain('autodown-codeblock-node')
  })

  it('the math edit face replaces the BlockHost text fallback', async () => {
    void EngineEditor
    const { engine, node, blockId } = docOf(MATH_MD)
    const html = await ssr(resolveBlockComponent('MathBlock').edit!(node!, editCtx(engine, blockId)))
    expect(html).toContain('autodown-math-editor')
    expect(html).toContain('data-block-id')
    expect(html).toContain('data-node-type="MathBlock"')
    expect(html).not.toContain('autodown-block-host')
  })

  it('the mermaid edit face carries its block chrome markers', async () => {
    void EngineEditor
    const { engine, node, blockId } = docOf(MERMAID_MD)
    const html = await ssr(resolveBlockComponent('Mermaid').edit!(node!, editCtx(engine, blockId)))
    expect(html).toContain('autodown-mermaid-editor')
    expect(html).toContain('data-block-id')
    expect(html).toContain('data-node-type="Mermaid"')
    expect(html).toContain('<textarea')
  })
})

describe('math edit-face SSR contract (031 T1 carried over)', () => {
  async function ssrFace(source: string, readonly: boolean): Promise<string> {
    const { engine, node, blockId } = docOf(MATH_MD)
    const withSource = { ...node!, inlines: [{ text: source, marks: [], attrs: [] }] }
    return ssr(resolveBlockComponent('MathBlock').edit!(withSource, editCtx(engine, blockId, readonly)))
  }

  it('renders the live katex preview over the source textarea', async () => {
    const html = await ssrFace('e = mc^2', false)
    expect(html).toContain('autodown-math-editor')
    expect(html).toContain('autodown-math-preview')
    expect(html).toContain('katex')
    expect(html).toContain('<textarea')
    expect(html).toContain('data-node-type="MathBlock"')
    expect(html).not.toContain('autodown-stream-banner')
  })

  it('invalid source renders the error banner and drops the preview', async () => {
    const html = await ssrFace('\\frac{1{', false)
    expect(html).toContain('autodown-math-error')
    expect(html).toContain('Math preview error')
    expect(html).not.toContain('autodown-math-preview')
  })

  it('readonly (streaming) renders the banner and disables the textarea', async () => {
    const html = await ssrFace('e = mc^2', true)
    expect(html).toContain('autodown-stream-banner')
    expect(html).toContain('流式生成中')
    expect(html).toContain('disabled')
  })
})

describe('mermaid edit-face SSR contract (031 T2 carried over)', () => {
  async function ssrFace(source: string, readonly: boolean): Promise<string> {
    const { engine, node, blockId } = docOf(MERMAID_MD)
    const withSource = { ...node!, inlines: [{ text: source, marks: [], attrs: [] }] }
    return ssr(resolveBlockComponent('Mermaid').edit!(withSource, editCtx(engine, blockId, readonly)))
  }

  it('renders the source textarea (async preview starts on mount, not SSR)', async () => {
    const html = await ssrFace('graph TD; A-->B;', false)
    expect(html).toContain('autodown-mermaid-editor')
    expect(html).toContain('<textarea')
    expect(html).toContain('graph TD; A--&gt;B;')
    expect(html).not.toContain('autodown-mermaid-preview')
    expect(html).not.toContain('autodown-stream-banner')
  })

  it('readonly (streaming) renders the banner and disables the textarea', async () => {
    const html = await ssrFace('graph TD; A-->B;', true)
    expect(html).toContain('autodown-stream-banner')
    expect(html).toContain('流式生成中')
    expect(html).toContain('disabled')
  })
})

describe('blur-commit semantics via the shared controller (D4)', () => {
  it('math edit blur-commit rewrites the source (one undo step, roundtrip stable)', () => {
    const { engine, blockId } = docOf(MATH_MD)
    const ctrl = new CodeEditorController(engine, blockId)
    expect(ctrl.code).toBe('e = mc^2')
    expect(ctrl.commit('E = mc^{2}')).toBe(true)
    expect(blockText(findBlock(engine.doc, blockId)!)).toBe('E = mc^{2}')
    expect(engine.canUndo).toBe(true)
    engine.undo()
    expect(blockText(findBlock(engine.doc, blockId)!)).toBe('e = mc^2')
    const md = serialize(engine.doc, true)
    expect(md).toContain('%{')
    expect(md).toContain('e = mc^2')
  })

  it('mermaid edit blur-commit rewrites the source inside the fence', () => {
    const { engine, blockId } = docOf(MERMAID_MD)
    const ctrl = new CodeEditorController(engine, blockId)
    // mermaid source (unlike the fence body) carries no trailing newline
    expect(ctrl.code).toBe('graph TD; A-->B;')
    expect(ctrl.commit('graph LR; A-->B;\n')).toBe(true)
    const md = serialize(engine.doc, true)
    expect(md).toContain('```mermaid')
    expect(md).toContain('graph LR; A-->B;')
  })
})
