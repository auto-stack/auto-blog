// Vue platform's highlighter: lowlight (highlight.js AST -> HTML).
// Bound as the default implementation by the render layer; a VM backend
// never imports this — it registers its own impl through
// enableHighlight/setHighlightImpl instead.

import { common, createLowlight } from 'lowlight'
import { toHtml } from 'hast-util-to-html'
import type { HighlightFn } from './highlight'

const lowlight = createLowlight(common)

export const lowlightHighlighter: HighlightFn = (code, language) => {
  if (!code || !language || language === 'text' || language === 'plaintext') return undefined
  try {
    if (!lowlight.registered(language)) return undefined
    return toHtml(lowlight.highlight(language, code))
  } catch {
    return undefined
  }
}
