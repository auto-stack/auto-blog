// Tri-state stream corpus (plan 032 D1): one entry per BlockType kind (17),
// each with the streaming prefix states the stream pipe actually sees:
//
//   unclosed — the prefix has not completed the construct yet; the default
//              markdown path must degrade safely (paragraph literal, or an
//              already-complete line construct for kinds that never "close")
//   open     — a multi-line construct is open (fence 族 only, plus the table's
//              header-first state); null when the kind has no open state
//   closed   — the complete construct (demo content.ts dialect)
//
// Container members (ListItem / TableRow / TableCell / WikilinkBlock) have no
// standalone streaming state — their tri-state IS their container's (D2 row
// 随容器); they are marked ridesContainer and carry no fixtures.
//
// closedKind is the WNode type the closed fixture must parse to (the T2 DOM
// assertions consume this same corpus — fixture and ruling stay same-source).

export interface TriStateDoc {
  /** streaming prefix: construct not yet recognizable as its final kind */
  unclosed: string | null
  /** streaming prefix: construct open but incomplete (fence 族 / table) */
  open: string | null
  /** complete construct */
  closed: string | null
  /** WNode type parseDocument(closed, true) must yield at top level */
  closedKind: string | null
  /** container member — no standalone stream state (states ride the container) */
  ridesContainer?: boolean
}

/** The 17 BlockType kinds, in BlockType enum order (block-model.ts). */
export const TRI_STATE_KINDS: readonly string[] = [
  'Heading',
  'Paragraph',
  'Fence',
  'Blockquote',
  'ListBlock',
  'ListItem',
  'Table',
  'TableRow',
  'TableCell',
  'ThematicBreak',
  'Callout',
  'Details',
  'WikilinkBlock',
  'QueryBlock',
  'BlockEmbed',
  'Mermaid',
  'MathBlock',
] as const

export const TRI_STATE: Record<string, TriStateDoc> = {
  // Line constructs — complete the moment their line arrives (即刻完整):
  // unclosed is just a mid-line prefix of the same kind.
  Heading: {
    unclosed: '## 流式标题正在',
    open: null,
    closed: '## 流式标题',
    closedKind: 'heading',
  },
  Paragraph: {
    unclosed: '这段话还在流式输出中，句子尚未',
    open: null,
    closed: '这段话已经流式完成，句子完整。',
    closedKind: 'paragraph',
  },
  Blockquote: {
    unclosed: '> 引用行还在流式',
    open: null,
    closed: '> 引用第一行。\n> 引用第二行。',
    closedKind: 'blockquote',
  },
  ListBlock: {
    unclosed: '- 列表项还在流式',
    open: null,
    closed: '- 列表项甲\n- 列表项乙\n  - 嵌套项',
    closedKind: 'list',
  },
  ThematicBreak: {
    unclosed: '--',
    open: null,
    closed: '---',
    closedKind: 'thematic_break',
  },

  // Fence 族 — the only kinds with a real open state: the fence is open, the
  // source is necessarily incomplete, the node is a loading code block.
  Fence: {
    unclosed: '``',
    open: '```rust\nfn streaming_example(x: i32) -> i32 {\n    x * 2',
    closed: '```rust\nfn streaming_example(x: i32) -> i32 {\n    x * 2\n}\n```',
    closedKind: 'code_block',
  },
  Mermaid: {
    // language still streaming ("```m" is a generic code block, not mermaid)
    unclosed: '```m',
    open: '```mermaid\ngraph TD;\n  A --> B',
    closed: '```mermaid\ngraph TD;\n  A --> B;\n```',
    closedKind: 'mermaid',
  },

  // Table — unclosed: header row without delimiter = paragraph literal;
  // open: delimiter arrived, header renders, rows stream in (列头先行).
  Table: {
    unclosed: '| 名称 | 值 |',
    open: '| 名称 | 值 |\n| --- | --- |\n| 甲 | 1',
    closed: '| 名称 | 值 |\n| --- | --- |\n| 甲 | 1 |\n| 乙 | 2 |',
    closedKind: 'table',
  },

  // Container comps — unclosed (brace not closed) = whole thing paragraph
  // literal (030 rule); no open state (no partial card).
  Callout: {
    unclosed: '$callout(type: "warning", title: "注意") {\n正文还在流式',
    open: null,
    closed: '$callout(type: "warning", title: "注意") {\n**警告** 卡片正文。\n}',
    closedKind: 'callout',
  },
  Details: {
    unclosed: '$details(summary: "点击展开") {\n内容还在流式',
    open: null,
    closed: '$details(summary: "点击展开") {\n折叠内容正文。\n}',
    closedKind: 'details',
  },

  // Leaf comps — unclosed paren = paragraph literal; complete on one line.
  QueryBlock: {
    unclosed: '$query(TAG #proj',
    open: null,
    closed: '$query(TAG #project)',
    closedKind: 'query',
  },
  BlockEmbed: {
    unclosed: '$embed(src: "https://example.com/x',
    open: null,
    closed: '$embed(src: "https://example.com/x")',
    closedKind: 'embed',
  },

  // Math — %{ without }% = paragraph literal (031 pinned); no open state.
  MathBlock: {
    unclosed: '%{\ne = mc^2',
    open: null,
    closed: '%{\ne = mc^2\n}%',
    closedKind: 'math_block',
  },

  // Container members — no standalone stream state.
  ListItem: { unclosed: null, open: null, closed: null, closedKind: null, ridesContainer: true },
  TableRow: { unclosed: null, open: null, closed: null, closedKind: null, ridesContainer: true },
  TableCell: { unclosed: null, open: null, closed: null, closedKind: null, ridesContainer: true },
  // WikilinkBlock is an engine-side kind — the render parse subset emits no
  // wikilink syntax at all; wherever one could ride, its container's tri-state
  // governs (D2 row 随容器).
  WikilinkBlock: { unclosed: null, open: null, closed: null, closedKind: null, ridesContainer: true },
}
