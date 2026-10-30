import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import StreamingRenderer from '../StreamingRenderer.vue'

// PLAN-051 T4：引擎主题声明入口——`darkMode`/`accent` props 让「引擎渲染
// 哪一档」成为视图树里两轨都看得见的声明（DSL `dark_mode:`/`accent:`
// 绑定的落点），而非 vue 环境里无源的 CSS 事实。默认档（false/'indigo'）
// 必须与现状零差异；选档落点=组件根 `.is-dark` + `data-accent`，CSS 值
// 逐条来自 auto-lang Design 22 §7 规约行（浅=vue 现值，深=VM zinc 基准）。
// 挂载口径=引擎测试惯例（createApp/h，无 test-utils 依赖），根属性断言
// 走 SSR 串最轻（block-widget-parity.test.ts 同族）。
const here = dirname(fileURLToPath(import.meta.url))
const editorCss = readFileSync(
  join(here, '../../editor/styles/autodown-editor.css'),
  'utf8',
)
const rendererVue = readFileSync(join(here, '../StreamingRenderer.vue'), 'utf8')

async function renderRoot(props: Record<string, unknown>): Promise<string> {
  // h(component as any, props)：引擎测试惯例（block-widget-parity 同款）
  // ——宽松 props 走运行时校验，编译期不做形状断言。
  return renderToString(createSSRApp({ render: () => h(StreamingRenderer as any, props) }))
}

describe('StreamingRenderer theme props (PLAN-051 T4)', () => {
  it('default mount stays light/indigo — no is-dark, data-accent=indigo', async () => {
    const html = await renderRoot({ source: '# Hello', streaming: false })
    expect(html).toContain('class="streaming-document')
    expect(html).not.toContain('is-dark')
    expect(html).toContain('data-accent="indigo"')
  })

  it('darkMode/accent props drive root .is-dark + data-accent', async () => {
    const html = await renderRoot({
      source: '# Hello', streaming: false, darkMode: true, accent: 'coral',
    })
    expect(html).toMatch(/class="streaming-document[^"]*\bis-dark\b/)
    expect(html).toContain('data-accent="coral"')
  })

  it('unknown accent falls back to indigo declaration', async () => {
    const html = await renderRoot({
      source: 'x', streaming: false, accent: 'mauve' as unknown as string,
    })
    expect(html).toContain('data-accent="indigo"')
  })
})

describe('theme CSS rule groups (Design 22 §7 projections)', () => {
  it('autodown-editor.css carries the five accent override groups', () => {
    for (const name of ['indigo', 'coral', 'ocean', 'sage', 'amber']) {
      expect(editorCss).toMatch(new RegExp(`\\[data-accent='${name}'\\]`))
    }
  })

  it('autodown-editor.css carries the .is-dark token override on both roots', () => {
    const m = editorCss.match(/\.autodown-editor\.is-dark,\s*\.streaming-document\.is-dark\s*\{/)
    expect(m).not.toBeNull()
  })

  it('dark rule groups exist for fence chrome, callout alpha, hljs tokens (editor side)', () => {
    expect(editorCss).toMatch(/is-dark[^{]*code-block-container/)
    expect(editorCss).toMatch(/is-dark[^{]*autodown-callout-note/)
    expect(editorCss).toMatch(/is-dark[^{]*hljs-keyword/)
  })

  it('StreamingRenderer scoped styles carry streaming-side dark overrides', () => {
    expect(rendererVue).toMatch(/streaming-document\.is-dark[\s\S]{0,200}:deep\(\.code-block-container\)/)
    expect(rendererVue).toMatch(/streaming-document\.is-dark[\s\S]{0,200}:deep\(\.admonition-note\)/)
    expect(rendererVue).toMatch(/streaming-document\.is-dark[\s\S]{0,300}hljs-keyword/)
  })
})
