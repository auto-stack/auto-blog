import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// PLAN-051 T3：--ad-accent* 三件套定义单源（Design 22 §7.2 规约行的
// 唯一 vue 投影）——autodown-editor.css 的双根规则喂 .autodown-editor 与
// .streaming-document，StreamingRenderer scoped 段不得再留副本（双定义曾是
// 漂移温床，plan 039 注记的残留结构）。T4 之后 per-accent 覆盖组
// （[data-accent='…']）是合法的第二层声明——剥离组后基规则仍须恰一份。
const stylesDir = dirname(fileURLToPath(import.meta.url))
const editorCss = readFileSync(join(stylesDir, '../autodown-editor.css'), 'utf8')
const rendererVue = readFileSync(
  join(stylesDir, '../../..', 'render/StreamingRenderer.vue'),
  'utf8',
)

const declRe = /--ad-accent[a-z-]*\s*:/g

function count(s: string): number {
  return (s.match(declRe) ?? []).length
}

/** the per-accent override groups ([data-accent='…'] rules) and the .is-dark
 * 档 rule — legitimate re-declarations of the triple (per-palette / dark
 * derivations); strip them before asserting the base inventory. */
function withoutAccentGroups(s: string): string {
  return s
    .replace(/\n?[^{}]*\[data-accent='[a-z]+'\][^{}]*\{[^{}]*\}/g, '')
    .replace(/\n?\.autodown-editor\.is-dark,\s*\.streaming-document\.is-dark\s*\{[^{}]*\}/, '')
}

describe('accent token single source (PLAN-051 T3)', () => {
  it('StreamingRenderer.vue declares no --ad-accent* of its own', () => {
    expect(count(rendererVue)).toBe(0)
  })

  it('base dual-root rule declares the accent triple exactly once', () => {
    const base = withoutAccentGroups(editorCss)
    for (const name of ['--ad-accent:', '--ad-accent-strong:', '--ad-accent-soft:']) {
      expect((base.match(new RegExp(name, 'g')) ?? []).length).toBe(1)
    }
  })

  it('the single base definition rule covers both pane roots', () => {
    const base = withoutAccentGroups(editorCss)
    const m = base.match(/([^{}]+)\{[^{}]*--ad-accent[^{}]*\}/)
    expect(m).not.toBeNull()
    const sel = m![1]
    expect(sel).toContain('.autodown-editor')
    expect(sel).toContain('.streaming-document')
  })
})
