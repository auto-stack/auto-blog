// Slash command manifest (plan 018 Phase 4) — the 30-item baseSlashItems
// preserved verbatim from the retired auto bridge (auto_down_editor_ext.ts);
// item.command closures run unchanged against the engine chain adapter.
// getCurrentBlockId reads the engine selection via the adapter's __engine.
export { default as SlashMenu } from './menus/SlashMenu.vue'
import {
  Heading1, Heading2, Heading3, Heading4, Heading5, Heading6,
  Text, List, ListOrdered, CheckSquare, Code, Quote, Minus, Image,
  Table as TableIcon, AlertCircle, PanelTop, Sigma, Workflow, Check, X,
  Link, Search, Square, CircleDot, CheckCircle2, Clock, Timer, ArrowUp,
} from 'lucide-vue-next'
import { ensureBlockAnchor } from './engine/commands'
import type { SlashItem } from './menus/slashItem'

function getCurrentBlockId(editor: any): string | null {
  const engine = editor?.__engine
  return engine?.selection?.anchor?.blockId ?? null
}

/** Persistent anchor for the current block: returns the existing ^anchor, or
 *  assigns a fresh short id on demand (lazy Obsidian-style anchoring). */
function getCurrentBlockAnchor(editor: any): string | null {
  const engine = editor?.__engine
  const id = engine?.selection?.anchor?.blockId
  if (!engine || !id) return null
  return ensureBlockAnchor(engine, id)
}

// The original's baseSlashItems + extraSlashItems merge, verbatim. The
// closures capture the props object (read live at command time), exactly
// like the original component's closures captured `props`. Called once at
// setup by the bridge — the original's slashItems const was likewise
// evaluated once (props.extraSlashItems was never reactive).
export function getSlashItems(props: any): SlashItem[] {
  const baseSlashItems: SlashItem[] = [
    {
      title: 'Text',
      description: 'Plain text',
      icon: Text,
      searchTerms: ['p'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
    },
    {
      title: 'Heading 1',
      description: 'Big section heading',
      icon: Heading1,
      searchTerms: ['h1'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run(),
    },
    {
      title: 'Heading 2',
      description: 'Medium section heading',
      icon: Heading2,
      searchTerms: ['h2'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
    },
    {
      title: 'Heading 3',
      description: 'Small section heading',
      icon: Heading3,
      searchTerms: ['h3'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
    },
    {
      title: 'Heading 4',
      description: 'Fourth level heading',
      icon: Heading4,
      searchTerms: ['h4'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 4 }).run(),
    },
    {
      title: 'Heading 5',
      description: 'Fifth level heading',
      icon: Heading5,
      searchTerms: ['h5'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 5 }).run(),
    },
    {
      title: 'Heading 6',
      description: 'Sixth level heading',
      icon: Heading6,
      searchTerms: ['h6'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 6 }).run(),
    },
    {
      title: 'Bullet List',
      description: 'Bullet list',
      icon: List,
      searchTerms: ['ul'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
    },
    {
      title: 'Numbered List',
      description: 'Numbered list',
      icon: ListOrdered,
      searchTerms: ['ol'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
    },
    {
      title: 'Task List',
      description: 'Task list',
      icon: CheckSquare,
      searchTerms: ['task'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
    },
    {
      title: 'Code Block',
      description: 'Code snippet',
      icon: Code,
      searchTerms: ['code'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setCodeBlock({ language: 'text' }).run()
      },
    },
    {
      title: 'Quote',
      description: 'Quote',
      icon: Quote,
      searchTerms: ['blockquote'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
    {
      title: 'Divider',
      description: 'Horizontal rule',
      icon: Minus,
      searchTerms: ['hr'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
    },
    {
      title: 'Image',
      description: 'Embed image',
      icon: Image,
      searchTerms: ['img'],
      command: ({ editor, range }) => {
        const url = window.prompt(props.imageUrlPrompt)
        if (url) editor.chain().focus().deleteRange(range).setImage({ src: url }).run()
      },
    },
    {
      title: 'Table',
      description: 'Add table',
      icon: TableIcon,
      searchTerms: ['table'],
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      title: 'Callout',
      description: 'Admonition / callout box',
      icon: AlertCircle,
      searchTerms: ['callout', 'admonition', 'warning', 'tip', 'note'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setCallout({ type: 'note', title: 'Note' }).run()
      },
    },
    {
      title: 'Details',
      description: 'Collapsible details block',
      icon: PanelTop,
      searchTerms: ['details', 'toggle', 'collapse', 'accordion'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setDetails({ summary: 'Details' }).run()
      },
    },
    {
      title: 'Math',
      description: 'Block math formula (KaTeX)',
      icon: Sigma,
      searchTerms: ['math', 'katex', 'formula', 'equation', 'latex'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setMathBlock().run()
      },
    },
    {
      title: 'Mermaid',
      description: 'Mermaid diagram',
      icon: Workflow,
      searchTerms: ['mermaid', 'diagram', 'chart', 'flowchart'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setMermaidBlock().run()
      },
    },
    {
      title: 'TODO',
      description: 'Insert a TODO task',
      icon: Square,
      searchTerms: ['todo', 'task'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertContent('- TODO ').run(),
    },
    {
      title: 'DOING',
      description: 'Insert a DOING task',
      icon: CircleDot,
      searchTerms: ['doing', 'task'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertContent('- DOING ').run(),
    },
    {
      title: 'DONE',
      description: 'Insert a DONE task',
      icon: CheckCircle2,
      searchTerms: ['done', 'task'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertContent('- DONE ').run(),
    },
    {
      title: 'NOW',
      description: 'Insert a NOW task',
      icon: Clock,
      searchTerms: ['now', 'task'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertContent('- NOW ').run(),
    },
    {
      title: 'LATER',
      description: 'Insert a LATER task',
      icon: Timer,
      searchTerms: ['later', 'task'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertContent('- LATER ').run(),
    },
    {
      title: 'Priority A',
      description: 'Insert [#A] priority',
      icon: ArrowUp,
      searchTerms: ['priority', 'A'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertContent('[#A] ').run(),
    },
    {
      title: 'Priority B',
      description: 'Insert [#B] priority',
      icon: ArrowUp,
      searchTerms: ['priority', 'B'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertContent('[#B] ').run(),
    },
    {
      title: 'Priority C',
      description: 'Insert [#C] priority',
      icon: ArrowUp,
      searchTerms: ['priority', 'C'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertContent('[#C] ').run(),
    },
    {
      title: 'Query',
      description: 'Insert a query macro',
      icon: Search,
      searchTerms: ['query', 'macro'],
      command: ({ editor, range }) => {
        const q = window.prompt('Query (e.g. (task TODO DOING))', '(task TODO)')
        if (q) {
          editor.chain().focus().deleteRange(range).insertContent(`{{query ${q}}}`).run()
        }
      },
    },
    {
      title: 'Block link',
      description: 'Copy link to current block',
      icon: Link,
      searchTerms: ['block link', 'anchor', 'copy link'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run()
        const title = props.pageTitle
        const id = getCurrentBlockAnchor(editor)
        if (title && id) {
          const link = `[[${title}#^${id}]]`
          navigator.clipboard.writeText(link).catch(() => {})
        }
      },
    },
  ]
  return [...baseSlashItems, ...(props.extraSlashItems ?? [])]
}
