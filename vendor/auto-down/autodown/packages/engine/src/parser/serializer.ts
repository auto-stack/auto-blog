/**
 * AutoDown Core — block tree -> .ad text serializer (roundtrip-pinned).
 *
 * GENERATED FILE — do not edit by hand.
 * Source: auto/serializer.at (Auto language). Regenerate with: pnpm gen
 * (see auto/README.md for the pipeline and the applied post-fixes)
 */

import { BlockNode, BlockType, InlineSpan, Mark, Attr, Value, attrGet, attrGetStr, attrGetInt, attrGetBool, hasMark, spansText } from "./block-model.js";


export function repeatStr(s: string, n: number): string {
    let out: string = "";
    for (let i = 0; i < n; i++) {
        out = out + s;
    }
    return out;
}

export function endsWith(hay: string, needle: string): boolean {
    const hl: number = Number(hay.length);
    const nl: number = Number(needle.length);
    if (hl < nl) {
        return false;
    }
    return hay.slice(hl - nl, hl) == needle;
}

export function hasNewline(s: string): boolean {
    for (let i = 0; i < Number(s.length); i++) {
        if (s.slice(i, i + 1) == "\n") {
            return true;
        }
    }
    return false;
}

export function spanMd(s: InlineSpan): string {
    


    if (s.text == "\n") {
        return "  \n";
    }
    let t: string = s.text;
    



    const wiki = attrGetStr(s.attrs, "wikilink", "");
    if (Number(wiki.length) > 0) {
        t = "[[" + wiki + "]]";
    }
    

    const math = attrGetStr(s.attrs, "math_inline", "");
    if (Number(math.length) > 0) {
        t = "$" + math + "$";
    }
    if (hasMark(s.marks, Mark.Code)) {
        t = "`" + t + "`";
    }
    if (hasMark(s.marks, Mark.Strong)) {
        t = "**" + t + "**";
    }
    if (hasMark(s.marks, Mark.Em)) {
        t = "*" + t + "*";
    }
    if (hasMark(s.marks, Mark.Underline)) {
        t = "__" + t + "__";
    }
    if (hasMark(s.marks, Mark.Del)) {
        t = "~~" + t + "~~";
    }
    if (hasMark(s.marks, Mark.Link)) {
        const href = attrGetStr(s.attrs, "href", "");
        const title = attrGetStr(s.attrs, "title", "");
        if (Number(title.length) > 0) {
            t = "[" + t + "](" + href + " \"" + title + "\")";
        } else {
            t = "[" + t + "](" + href + ")";
        }
    }
    if (hasMark(s.marks, Mark.Image)) {
        const src = attrGetStr(s.attrs, "src", "");
        const ititle = attrGetStr(s.attrs, "title", "");
        if (Number(ititle.length) > 0) {
            t = "![" + t + "](" + src + " \"" + ititle + "\")";
        } else {
            t = "![" + t + "](" + src + ")";
        }
    }
    return t;
}

export function inlinesMd(spans: InlineSpan[]): string {
    let out: string = "";
    for (const s of spans) {
        out = out + spanMd(s);
    }
    return out;
}

export function alignMarker(align: string): string {
    if (align == "left") {
        return ":---";
    }
    if (align == "center") {
        return ":---:";
    }
    if (align == "right") {
        return "---:";
    }
    return "---";
}

export function tableRowMd(row: BlockNode): string {
    let out: string = "|";
    for (const c of row.children) {
        out = out + " " + inlinesMd(c.inlines) + " |";
    }
    return out;
}

export function tableDelimMd(headerRow: BlockNode): string {
    let out: string = "|";
    for (const c of headerRow.children) {
        out = out + " " + alignMarker(attrGetStr(c.attrs, "align", "")) + " |";
    }
    return out;
}

export function listOfValue(v: Value): Value[] {
        const __auto_is_0 = v;
    if (__auto_is_0._tag === "Null") {
        return [];
    }
    else if (__auto_is_0._tag === "Str") {
        const s = __auto_is_0.value;
        return [];
    }
    else if (__auto_is_0._tag === "Int") {
        const i = __auto_is_0.value;
        return [];
    }
    else if (__auto_is_0._tag === "Bool") {
        const b = __auto_is_0.value;
        return [];
    }
    else if (__auto_is_0._tag === "ListV") {
        const l = __auto_is_0.value;
        return l;
    }
    else if (__auto_is_0._tag === "AttrsV") {
        const m = __auto_is_0.value;
        return [];
    }
    return [];
}

export function attrsOfValue(v: Value): Attr[] {
        const __auto_is_1 = v;
    if (__auto_is_1._tag === "Null") {
        return [];
    }
    else if (__auto_is_1._tag === "Str") {
        const s = __auto_is_1.value;
        return [];
    }
    else if (__auto_is_1._tag === "Int") {
        const i = __auto_is_1.value;
        return [];
    }
    else if (__auto_is_1._tag === "Bool") {
        const b = __auto_is_1.value;
        return [];
    }
    else if (__auto_is_1._tag === "ListV") {
        const l = __auto_is_1.value;
        return [];
    }
    else if (__auto_is_1._tag === "AttrsV") {
        const m = __auto_is_1.value;
        return m;
    }
    return [];
}

export function intOfValue(v: Value): number | null {
        const __auto_is_2 = v;
    if (__auto_is_2._tag === "Null") {
        return null;
    }
    else if (__auto_is_2._tag === "Str") {
        const s = __auto_is_2.value;
        return null;
    }
    else if (__auto_is_2._tag === "Int") {
        const i = __auto_is_2.value;
        return i;
    }
    else if (__auto_is_2._tag === "Bool") {
        const b = __auto_is_2.value;
        return null;
    }
    else if (__auto_is_2._tag === "ListV") {
        const l = __auto_is_2.value;
        return null;
    }
    else if (__auto_is_2._tag === "AttrsV") {
        const m = __auto_is_2.value;
        return null;
    }
    return null;
}

export function valueToIntList(v: Value): (number | null)[] {
    const items = listOfValue(v);
    let out: (number | null)[] = [];
    for (let i = 0; i < Number(items.length); i++) {
        out.push(intOfValue(items[i]));
    }
    return out;
}

export function hasAnyInt(arr: (number | null)[]): boolean {
    for (let i = 0; i < Number(arr.length); i++) {
        if (arr[i] != null) {
            return true;
        }
    }
    return false;
}

export function formatIntList(arr: (number | null)[]): string {
    let out: string = "";
    for (let i = 0; i < Number(arr.length); i++) {
        if (i > 0) {
            out = out + ",";
        }
        const v = arr[i];
        if (v == null) {
            out = out + "\"auto\"";
        } else {
            const n: number = v ?? 0;
            out = out + String(n);
        }
    }
    return out;
}

export function ialText(ialAttrs: Attr[]): string {
    const colsFound = attrGet(ialAttrs, "cols");
    const rowsFound = attrGet(ialAttrs, "rows");
    const cols = valueToIntList(colsFound ?? Value.Null());
    const rows = valueToIntList(rowsFound ?? Value.Null());
    let parts: string[] = [];
    if (hasAnyInt(cols)) {
        parts.push("cols:[" + formatIntList(cols) + "]");
    }
    if (hasAnyInt(rows)) {
        parts.push("rows:[" + formatIntList(rows) + "]");
    }
    let out: string = "";
    for (let i = 0; i < Number(parts.length); i++) {
        if (i > 0) {
            out = out + ", ";
        }
        out = out + parts[i];
    }
    return out;
}

export function tableMd(node: BlockNode): string {
    if (Number(node.children.length) == 0) {
        return "";
    }
    let out: string = "";
    for (let i = 0; i < Number(node.children.length); i++) {
        if (i > 0) {
            out = out + "\n";
        }
        const row = node.children[i];
        if (i == 0) {
            out = out + tableRowMd(row) + "\n" + tableDelimMd(row);
        } else {
            out = out + tableRowMd(row);
        }
    }
    const ialFound = attrGet(node.attrs, "ial");
    if (ialFound != null) {
        const body = ialText(attrsOfValue(ialFound ?? Value.Null()));
        if (Number(body.length) > 0) {
            out = out + "\n{" + body + "}";
        }
    }
    return out;
}

export function joinChildren(kids: BlockNode[], withId: boolean): string {
    let out: string = "";
    for (let i = 0; i < Number(kids.length); i++) {
        if (i > 0) {
            if (kids[i].kind == BlockType.ListBlock) {
                out = out + "\n";
            } else {
                out = out + "\n\n";
            }
        }
        out = out + blockMd(kids[i], withId);
    }
    return out;
}

export function quoteMd(node: BlockNode, withId: boolean): string {
    const body = joinChildren(node.children, withId);
    const lines = body.split("\n");
    let out: string = "";
    for (let i = 0; i < Number(lines.length); i++) {
        if (i > 0) {
            out = out + "\n";
        }
        if (Number(lines[i].length) > 0) {
            out = out + "> " + lines[i];
        } else {
            out = out + ">";
        }
    }
    return out;
}

export function listMd(node: BlockNode, withId: boolean): string {
    const ordered = attrGetBool(node.attrs, "ordered", false);
    const start = attrGetInt(node.attrs, "start", 1);
    let out: string = "";
    for (let i = 0; i < Number(node.children.length); i++) {
        if (i > 0) {
            out = out + "\n";
        }
        let marker: string = "- ";
        let padLen: number = 2;
        if (ordered) {
            const n: number = start + i;
            marker = String(n) + ". ";
            padLen = Number(marker.length);
        } else {
            



            const item = node.children[i];
            if (attrGet(item.attrs, "checked") != null) {
                if (attrGetBool(item.attrs, "checked", false)) {
                    marker = "- [x] ";
                } else {
                    marker = "- [ ] ";
                }
            }
        }
        const body = joinChildren(node.children[i].children, withId);
        const lines = body.split("\n");
        const pad = repeatStr(" ", padLen);
        for (let j = 0; j < Number(lines.length); j++) {
            if (j > 0) {
                out = out + "\n";
            }
            if (j == 0) {
                out = out + marker + lines[j];
            } else {
                if (Number(lines[j].length) > 0) {
                    out = out + pad + lines[j];
                }
            }
        }
    }
    return out;
}

export function fenceMd(node: BlockNode): string {
    const lang = attrGetStr(node.attrs, "language", "");
    const code = spansText(node.inlines);
    let out: string = "```" + lang + "\n" + code;
    if (Number(code.length) > 0) {
        if (!endsWith(code, "\n")) {
            out = out + "\n";
        }
    }
    out = out + "```";
    return out;
}

export function headingMd(node: BlockNode, withId: boolean): string {
    const level = attrGetInt(node.attrs, "level", 1);
    let t: string = inlinesMd(node.inlines);
    if (withId) {
        t = withIdSuffix(t, attrGetStr(node.attrs, "anchor", ""));
    }
    if (level <= 2) {
        if (hasNewline(t)) {
            let underline: string = "---";
            if (level == 1) {
                underline = "===";
            }
            return t + "\n" + underline;
        }
    }
    return repeatStr("#", level) + " " + t;
}

export function quotedArg(k: string, v: string): string {
    return k + ": \"" + v + "\"";
}

export function componentBlockMd(name: string, argsText: string, node: BlockNode, withId: boolean): string {
    return "$" + name + "(" + argsText + ") {\n" + joinChildren(node.children, withId) + "\n}";
}

export function calloutMd(node: BlockNode, withId: boolean): string {
    let argsText: string = quotedArg("type", attrGetStr(node.attrs, "type", ""));
    const title = attrGetStr(node.attrs, "title", "");
    if (Number(title.length) > 0) {
        argsText = argsText + ", " + quotedArg("title", title);
    }
    return componentBlockMd("callout", argsText, node, withId);
}

export function detailsMd(node: BlockNode, withId: boolean): string {
    let argsText: string = quotedArg("summary", attrGetStr(node.attrs, "summary", ""));
    if (attrGetBool(node.attrs, "open", false)) {
        argsText = argsText + ", open: true";
    }
    return componentBlockMd("details", argsText, node, withId);
}

export function wikilinkMd(node: BlockNode): string {
    const target = attrGetStr(node.attrs, "target", "");
    const anchor = attrGetStr(node.attrs, "anchor", "");
    if (Number(anchor.length) > 0) {
        return "[[" + target + "#" + anchor + "]]";
    }
    return "[[" + target + "]]";
}

export function blockMd(node: BlockNode, withId: boolean): string {
    const k = node.kind;
    if (k == BlockType.Heading) {
        return headingMd(node, withId);
    }
    if (k == BlockType.Fence) {
        return fenceMd(node);
    }
    if (k == BlockType.Blockquote) {
        return quoteMd(node, withId);
    }
    if (k == BlockType.ListBlock) {
        return listMd(node, withId);
    }
    if (k == BlockType.ListItem) {
        return joinChildren(node.children, withId);
    }
    if (k == BlockType.Table) {
        return tableMd(node);
    }
    if (k == BlockType.TableRow) {
        return tableRowMd(node);
    }
    if (k == BlockType.TableCell) {
        return inlinesMd(node.inlines);
    }
    if (k == BlockType.ThematicBreak) {
        return "---";
    }
    if (k == BlockType.Callout) {
        return calloutMd(node, withId);
    }
    if (k == BlockType.Details) {
        return detailsMd(node, withId);
    }
    if (k == BlockType.WikilinkBlock) {
        return wikilinkMd(node);
    }
    if (k == BlockType.QueryBlock) {
        return "$query(" + attrGetStr(node.attrs, "query", "") + ")";
    }
    if (k == BlockType.BlockEmbed) {
        return "$embed(src: \"" + attrGetStr(node.attrs, "src", "") + "\")";
    }
    if (k == BlockType.Mermaid) {
        return "```mermaid\n" + spansText(node.inlines) + "\n```";
    }
    if (k == BlockType.MathBlock) {
        return "%{\n" + spansText(node.inlines) + "\n}%";
    }
    

    const t = inlinesMd(node.inlines);
    if (withId) {
        return withIdSuffix(t, attrGetStr(node.attrs, "anchor", ""));
    }
    return t;
}

export function withIdSuffix(text: string, id: string): string {
    const tok: string = "^" + id;
    if (Number(id.length) == 0) {
        return text;
    }
    if (endsWith(text, tok)) {
        return text;
    }
    return text + " " + tok;
}

export function serializeBlocks(blocks: BlockNode[], emitIds: boolean): string {
    let out: string = "";
    for (let i = 0; i < Number(blocks.length); i++) {
        if (i > 0) {
            out = out + "\n\n";
        }
        const b = blocks[i];
        


        out = out + blockMd(b, emitIds);
    }
    return out;
}

export function serialize(root: BlockNode, emitIds: boolean): string {
    const body = serializeBlocks(root.children, emitIds);
    if (Number(body.length) == 0) {
        return "";
    }
    return body + "\n";
}