/**
 * @autodown/engine — palette map (render layer).
 *
 * GENERATED FILE — do not edit by hand.
 * Source: auto/palette_map.at (Auto language). Regenerate with: pnpm gen:render
 * (see auto/README.md for the pipeline and the applied post-fixes)
 */

export interface PanelSpec {
    kind: string;
    tag: string;
    class_token: string;
    registry: string;
    extension: boolean;
}

function mkPanelSpec(kind: string, tag: string, class_token: string, registry: string, extension: boolean): PanelSpec {
    return { kind, tag, class_token, registry, extension }
}

export function panelHeading(level: number): PanelSpec {
    let l: number = level;
    if (l < 1) {
        l = 1;
    }
    if (l > 6) {
        l = 6;
    }
    return mkPanelSpec("H" + String(l), "h" + String(l), "heading-node", "Heading", false);
}

export function panelOfBlock(blockType: string): PanelSpec {
    if (blockType == "paragraph") {
        return mkPanelSpec("Text", "p", "paragraph-node", "Text", false);
    }
    if (blockType == "text") {
        return mkPanelSpec("Text", "span", "text-node", "Text", false);
    }
    if (blockType == "heading") {
        return panelHeading(1);
    }
    if (blockType == "thematic_break") {
        return mkPanelSpec("Separator", "hr", "hr-node", "Separator", false);
    }
    if (blockType == "code_block") {
        return mkPanelSpec("Codeblock", "div", "code-block-container", "Codeblock", false);
    }
    if (blockType == "blockquote") {
        return mkPanelSpec("Quote", "blockquote", "blockquote", "Quote", false);
    }
    if (blockType == "list") {
        return mkPanelSpec("List", "ul", "list-node", "List", false);
    }
    if (blockType == "table") {
        return mkPanelSpec("Table", "table", "table-node", "Table", false);
    }
    

    if (blockType == "callout") {
        return mkPanelSpec("Callout", "div", "callout-node", "Callout", true);
    }
    if (blockType == "details") {
        return mkPanelSpec("Details", "div", "details-node", "Details", true);
    }
    if (blockType == "math_block") {
        return mkPanelSpec("MathBlock", "div", "math-block", "MathBlock", true);
    }
    if (blockType == "mermaid") {
        return mkPanelSpec("Mermaid", "div", "mermaid-block-container", "Mermaid", true);
    }
    if (blockType == "query") {
        return mkPanelSpec("Query", "div", "query-block", "Query", true);
    }
    if (blockType == "embed") {
        return mkPanelSpec("Embed", "div", "embed-block", "Embed", true);
    }
    return mkPanelSpec("Unknown", "div", "unknown-node", "", false);
}

export function isExtensionPanel(kind: string): boolean {
    if (kind == "Callout") {
        return true;
    }
    if (kind == "Details") {
        return true;
    }
    if (kind == "MathBlock") {
        return true;
    }
    if (kind == "Mermaid") {
        return true;
    }
    if (kind == "Query") {
        return true;
    }
    if (kind == "Embed") {
        return true;
    }
    return false;
}

export function builtinPanelKinds(): string[] {
    return ["Text", "H1", "H2", "H3", "H4", "H5", "H6", "Separator", "Codeblock", "Quote", "List", "Table"];
}

export function extensionPanelKinds(): string[] {
    return ["Callout", "Details", "MathBlock", "Mermaid", "Query", "Embed"];
}