// Wikilink opener seam (plan 036 T5): the retired DOM decorator took the
// app-facing click callback as an argument (EngineEditor's open-wiki-link
// emit); the span renderer sits deeper in the pure render pipeline, so the
// callback registers once here instead. Static renders (MarkdownRender /
// streaming) never register — their wikilink labels render inert, exactly
// as before.

export type WikilinkOpener = (title: string, blockId?: string) => void

let opener: WikilinkOpener | null = null

/** Register (or clear with null) the app-facing wikilink click handler. */
export function registerWikilinkOpener(open: WikilinkOpener | null): void {
  opener = open
}

/** The currently registered handler (identity checks on unmount). */
export function currentWikilinkOpener(): WikilinkOpener | null {
  return opener
}

export function openWikilink(title: string, blockId?: string): void {
  opener?.(title, blockId)
}
