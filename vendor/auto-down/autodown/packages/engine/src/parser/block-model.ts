/**
 * AutoDown Core — unified block model (block tree, selection, op sequence).
 *
 * GENERATED FILE — do not edit by hand.
 * Source: auto/block_model.at (Auto language). Regenerate with: pnpm gen
 * (see auto/README.md for the pipeline and the applied post-fixes)
 */

export class SourceRange {
    start: number;
    end: number;

    constructor(start: number, end: number) {
        this.start = start;
        this.end = end;
    }
}

export function rng(s: number, e: number): SourceRange {
    return new SourceRange(s, e);
}

export type Value =
    { _tag: "Null" }
    | { _tag: "Str", value: string }
    | { _tag: "Int", value: number }
    | { _tag: "Bool", value: boolean }
    | { _tag: "ListV", value: Value[] }
    | { _tag: "AttrsV", value: Attr[] };

export const Value = {
    Null: () => ({ _tag: "Null" as const }),
    Str: (value: string) => ({ _tag: "Str" as const, value }),
    Int: (value: number) => ({ _tag: "Int" as const, value }),
    Bool: (value: boolean) => ({ _tag: "Bool" as const, value }),
    ListV: (value: Value[]) => ({ _tag: "ListV" as const, value }),
    AttrsV: (value: Attr[]) => ({ _tag: "AttrsV" as const, value })
};


export class Attr {
    key: string;
    value: Value;

    constructor(key: string, value: Value) {
        this.key = key;
        this.value = value;
    }
}

export function attrGet(attrs: Attr[], key: string): Value | null {
    for (let i = 0; i < Number(attrs.length); i++) {
        if (attrs[i].key == key) {
            return attrs[i].value;
        }
    }
    return null;
}

export function attrGetStr(attrs: Attr[], key: string, dflt: string): string {
    const found = attrGet(attrs, key);
    const v = found ?? Value.Str(dflt);
        const __auto_is_0 = v;
    if (__auto_is_0._tag === "Null") {
        return dflt;
    }
    else if (__auto_is_0._tag === "Str") {
        const s = __auto_is_0.value;
        return s;
    }
    else if (__auto_is_0._tag === "Int") {
        const i = __auto_is_0.value;
        return dflt;
    }
    else if (__auto_is_0._tag === "Bool") {
        const b = __auto_is_0.value;
        return dflt;
    }
    else if (__auto_is_0._tag === "ListV") {
        const l = __auto_is_0.value;
        return dflt;
    }
    else if (__auto_is_0._tag === "AttrsV") {
        const m = __auto_is_0.value;
        return dflt;
    }
    return dflt;
}

export function attrGetInt(attrs: Attr[], key: string, dflt: number): number {
    const found = attrGet(attrs, key);
    const v = found ?? Value.Int(dflt);
        const __auto_is_1 = v;
    if (__auto_is_1._tag === "Null") {
        return dflt;
    }
    else if (__auto_is_1._tag === "Str") {
        const s = __auto_is_1.value;
        return dflt;
    }
    else if (__auto_is_1._tag === "Int") {
        const i = __auto_is_1.value;
        return i;
    }
    else if (__auto_is_1._tag === "Bool") {
        const b = __auto_is_1.value;
        return dflt;
    }
    else if (__auto_is_1._tag === "ListV") {
        const l = __auto_is_1.value;
        return dflt;
    }
    else if (__auto_is_1._tag === "AttrsV") {
        const m = __auto_is_1.value;
        return dflt;
    }
    return dflt;
}

export function attrGetBool(attrs: Attr[], key: string, dflt: boolean): boolean {
    const found = attrGet(attrs, key);
    const v = found ?? Value.Bool(dflt);
        const __auto_is_2 = v;
    if (__auto_is_2._tag === "Null") {
        return dflt;
    }
    else if (__auto_is_2._tag === "Str") {
        const s = __auto_is_2.value;
        return dflt;
    }
    else if (__auto_is_2._tag === "Int") {
        const i = __auto_is_2.value;
        return dflt;
    }
    else if (__auto_is_2._tag === "Bool") {
        const b = __auto_is_2.value;
        return b;
    }
    else if (__auto_is_2._tag === "ListV") {
        const l = __auto_is_2.value;
        return dflt;
    }
    else if (__auto_is_2._tag === "AttrsV") {
        const m = __auto_is_2.value;
        return dflt;
    }
    return dflt;
}

export function attrSet(attrs: Attr[], key: string, value: Value): Attr[] {
    



    let out: Attr[] = [];
    let idx: number = -1;
    for (let i = 0; i < Number(attrs.length); i++) {
        if (attrs[i].key == key) {
            idx = i;
        }
        out.push(attrs[i]);
    }
    if (idx >= 0) {
        out[idx] = new Attr(key, value);
    } else {
        out.push(new Attr(key, value));
    }
    return out;
}

export function attrDel(attrs: Attr[], key: string): Attr[] {
    let out: Attr[] = [];
    for (const a of attrs) {
        if (a.key != key) {
            out.push(a);
        }
    }
    return out;
}

export function dupAttrs(attrs: Attr[]): Attr[] {
    let out: Attr[] = [];
    for (const a of attrs) {
        out.push(a);
    }
    return out;
}

export enum Mark {
    Strong,
    Em = 1,
    Code = 2,
    Link = 3,
    Image = 4,
    Del = 5,
    Underline = 6
}

export function hasMark(marks: Mark[], m: Mark): boolean {
    for (let i = 0; i < Number(marks.length); i++) {
        if (marks[i] == m) {
            return true;
        }
    }
    return false;
}

export function addMark(marks: Mark[], m: Mark): Mark[] {
    let out: Mark[] = [];
    let found: boolean = false;
    for (let i = 0; i < Number(marks.length); i++) {
        if (marks[i] == m) {
            found = true;
        }
        out.push(marks[i]);
    }
    if (!found) {
        out.push(m);
    }
    return out;
}

export function delMark(marks: Mark[], m: Mark): Mark[] {
    let out: Mark[] = [];
    for (let i = 0; i < Number(marks.length); i++) {
        if (marks[i] != m) {
            out.push(marks[i]);
        }
    }
    return out;
}

export class InlineSpan {
    text: string;
    marks: Mark[];
    attrs: Attr[];

    constructor(text: string, marks: Mark[], attrs: Attr[]) {
        this.text = text;
        this.marks = marks;
        this.attrs = attrs;
    }
}

export function span(text: string): InlineSpan {
    return new InlineSpan(text, [], []);
}

export function markedSpan(text: string, marks: Mark[]): InlineSpan {
    return new InlineSpan(text, marks, []);
}

export function spanWith(text: string, marks: Mark[], attrs: Attr[]): InlineSpan {
    return new InlineSpan(text, marks, attrs);
}

export function spansText(spans: InlineSpan[]): string {
    let t: string = "";
    for (const s of spans) {
        t = t + s.text;
    }
    return t;
}

export function dupSpans(spans: InlineSpan[]): InlineSpan[] {
    let out: InlineSpan[] = [];
    for (const s of spans) {
        out.push(s);
    }
    return out;
}

export function spansInsert(spans: InlineSpan[], offset: number, text: string): InlineSpan[] {
    let out: InlineSpan[] = [];
    let pos: number = 0;
    let done: boolean = false;
    for (const s of spans) {
        if (done) {
            out.push(s);
        } else {
            const sLen: number = Number(s.text.length);
            if (offset <= pos + sLen) {
                const at: number = offset - pos;
                // plan-062 AC-02: inserting at the exact END of a MARKED span
                // lands OUTSIDE the mark (cursor-out-of-mark — new typing is
                // plain; kills the toggle-continuation pain). Plain spans
                // keep the in-span append (normalizeSpans re-merges).
                if (at === sLen && s.marks.length > 0) {
                    out.push(s);
                    out.push(span(text));
                    done = true;
                } else {
                    const nt: string = s.text.slice(0, at) + text + s.text.slice(at);
                    out.push(new InlineSpan(nt, s.marks, s.attrs));
                    done = true;
                }
            } else {
                out.push(s);
            }
            pos = pos + sLen;
        }
    }
    if (!done) {
        out.push(span(text));
    }
    return out;
}

export function spansDelete(spans: InlineSpan[], lo: number, hi: number): InlineSpan[] {
    let out: InlineSpan[] = [];
    let pos: number = 0;
    for (const s of spans) {
        const sLen: number = Number(s.text.length);
        const sEnd: number = pos + sLen;
        let overlapped: boolean = true;
        if (sEnd <= lo) {
            overlapped = false;
        }
        if (pos >= hi) {
            overlapped = false;
        }
        if (overlapped) {
            let nt: string = "";
            if (lo > pos) {
                nt = s.text.slice(0, lo - pos);
            }
            if (hi < sEnd) {
                nt = nt + s.text.slice(hi - pos);
            }
            if (Number(nt.length) > 0) {
                out.push(new InlineSpan(nt, s.marks, s.attrs));
            }
        } else {
            out.push(s);
        }
        pos = sEnd;
    }
    return out;
}

export class SpanSplit {
    before: InlineSpan[];
    after: InlineSpan[];

    constructor(before: InlineSpan[], after: InlineSpan[]) {
        this.before = before;
        this.after = after;
    }
}

export function spansSplitAt(spans: InlineSpan[], offset: number): SpanSplit {
    let before: InlineSpan[] = [];
    let after: InlineSpan[] = [];
    let pos: number = 0;
    let done: boolean = false;
    for (const s of spans) {
        if (done) {
            after.push(s);
        } else {
            const sLen: number = Number(s.text.length);
            const sEnd: number = pos + sLen;
            if (offset <= pos) {
                after.push(s);
                done = true;
            } else {
                if (offset >= sEnd) {
                    before.push(s);
                } else {
                    const lt = s.text.slice(0, offset - pos);
                    const rt = s.text.slice(offset - pos);
                    if (Number(lt.length) > 0) {
                        before.push(new InlineSpan(lt, s.marks, s.attrs));
                    }
                    if (Number(rt.length) > 0) {
                        after.push(new InlineSpan(rt, s.marks, s.attrs));
                    }
                    done = true;
                }
            }
            pos = sEnd;
        }
    }
    return new SpanSplit(before, after);
}

export enum BlockType {
    Heading,
    Paragraph = 1,
    Fence = 2,
    Blockquote = 3,
    ListBlock = 4,
    ListItem = 5,
    Table = 6,
    TableRow = 7,
    TableCell = 8,
    ThematicBreak = 9,
    Callout = 10,
    Details = 11,
    WikilinkBlock = 12,
    QueryBlock = 13,
    BlockEmbed = 14,
    Mermaid = 15,
    MathBlock = 16
}

export class BlockNode {
    id: string;
    kind: BlockType;
    attrs: Attr[];
    children: BlockNode[];
    inlines: InlineSpan[];
    source: SourceRange;

    constructor(id: string, kind: BlockType, attrs: Attr[], children: BlockNode[], inlines: InlineSpan[], source: SourceRange) {
        this.id = id;
        this.kind = kind;
        this.attrs = attrs;
        this.children = children;
        this.inlines = inlines;
        this.source = source;
    }
}

export function block(id: string, kind: BlockType): BlockNode {
    return new BlockNode(id, kind, [], [], [], rng(0, 0));
}

export function blockFull(id: string, kind: BlockType, attrs: Attr[], children: BlockNode[], inlines: InlineSpan[], source: SourceRange): BlockNode {
    return new BlockNode(id, kind, attrs, children, inlines, source);
}

export function attrOf(key: string, value: Value): Attr {
    return new Attr(key, value);
}

export function leafBlock(id: string, kind: BlockType, text: string): BlockNode {
    return new BlockNode(id, kind, [], [], [span(text)], rng(0, Number(text.length)));
}

export function blockText(node: BlockNode): string {
    return spansText(node.inlines);
}

export function withInlines(node: BlockNode, spans: InlineSpan[]): BlockNode {
    return new BlockNode(node.id, node.kind, node.attrs, node.children, spans, node.source);
}

export function withKind(node: BlockNode, kind: BlockType): BlockNode {
    return new BlockNode(node.id, kind, node.attrs, node.children, node.inlines, node.source);
}

export function withChildren(node: BlockNode, kids: BlockNode[]): BlockNode {
    return new BlockNode(node.id, node.kind, node.attrs, kids, node.inlines, node.source);
}

export function dupNodes(nodes: BlockNode[]): BlockNode[] {
    let out: BlockNode[] = [];
    for (const n of nodes) {
        out.push(n);
    }
    return out;
}

export function anchorOf(node: BlockNode): string {
    return attrGetStr(node.attrs, "anchor", "");
}

export function withBlockAnchor(node: BlockNode, newId: string): BlockNode {
    return new BlockNode(newId, node.kind, attrSet(node.attrs, "anchor", Value.Str(newId)), node.children, node.inlines, node.source);
}

export function withIdAndAnchor(node: BlockNode, newId: string): BlockNode {
    return new BlockNode(newId, node.kind, attrSet(node.attrs, "anchor", Value.Str(newId)), node.children, node.inlines, node.source);
}

export function hasIdDeep(tree: BlockNode, id: string): boolean {
    if (tree.id == id) {
        return true;
    }
    for (let i = 0; i < Number(tree.children.length); i++) {
        if (hasIdDeep(tree.children[i], id)) {
            return true;
        }
    }
    return false;
}

export function retargetAnchor(tree: BlockNode, id: string, newId: string): BlockNode {
    if (!hasIdDeep(tree, id)) {
        return tree;
    }
    if (tree.id == id) {
        return withBlockAnchor(tree, newId);
    }
    if (Number(tree.children.length) == 0) {
        return tree;
    }
    let out: BlockNode[] = [];
    for (let i = 0; i < Number(tree.children.length); i++) {
        out.push(retargetAnchor(tree.children[i], id, newId));
    }
    return new BlockNode(tree.id, tree.kind, tree.attrs, out, tree.inlines, tree.source);
}

export function findBlock(node: BlockNode, id: string): BlockNode | null {
    if (node.id == id) {
        return node;
    }
    for (let i = 0; i < Number(node.children.length); i++) {
        const r = findBlock(node.children[i], id);
        if (r != null) {
            return r;
        }
    }
    return null;
}

export function parentOf(node: BlockNode, id: string): BlockNode | null {
    for (let i = 0; i < Number(node.children.length); i++) {
        if (node.children[i].id == id) {
            return node;
        }
        const r = parentOf(node.children[i], id);
        if (r != null) {
            return r;
        }
    }
    return null;
}

export function pathOf(node: BlockNode, id: string): string[] {
    if (node.id == id) {
        return [node.id];
    }
    for (let i = 0; i < Number(node.children.length); i++) {
        const sub = pathOf(node.children[i], id);
        if (Number(sub.length) > 0) {
            let out: string[] = [node.id];
            for (const s of sub) {
                out.push(s);
            }
            return out;
        }
    }
    return [];
}

export function childIndex(node: BlockNode, id: string): number {
    for (let i = 0; i < Number(node.children.length); i++) {
        if (node.children[i].id == id) {
            return i;
        }
    }
    return -1;
}

export function spliceChildren(node: BlockNode, id: string, repl: BlockNode[]): BlockNode {
    const idx = childIndex(node, id);
    if (idx >= 0) {
        let kids: BlockNode[] = [];
        for (let i = 0; i < Number(node.children.length); i++) {
            if (i == idx) {
                for (const r of repl) {
                    kids.push(r);
                }
            } else {
                kids.push(node.children[i]);
            }
        }
        return withChildren(node, kids);
    }
    let kids2: BlockNode[] = [];
    for (const c of node.children) {
        kids2.push(spliceChildren(c, id, repl));
    }
    return withChildren(node, kids2);
}

export function replaceNode(node: BlockNode, id: string, repl: BlockNode[]): BlockNode {
    if (node.id == id) {
        if (Number(repl.length) > 0) {
            return repl[0];
        }
        return node;
    }
    return spliceChildren(node, id, repl);
}

export function spliceRange(node: BlockNode, parentId: string, lo: number, hi: number, repl: BlockNode[]): BlockNode {
    if (node.id == parentId) {
        let kids: BlockNode[] = [];
        for (let i = 0; i < Number(node.children.length); i++) {
            if (i < lo) {
                kids.push(node.children[i]);
            }
            if (i == lo) {
                for (const r of repl) {
                    kids.push(r);
                }
            }
            if (i >= hi) {
                kids.push(node.children[i]);
            }
        }
        return withChildren(node, kids);
    }
    let kids2: BlockNode[] = [];
    for (const c of node.children) {
        kids2.push(spliceRange(c, parentId, lo, hi, repl));
    }
    return withChildren(node, kids2);
}

export class BlockPos {
    blockId: string;
    offset: number;

    constructor(blockId: string, offset: number) {
        this.blockId = blockId;
        this.offset = offset;
    }
}

export class Selection {
    anchor: BlockPos;
    head: BlockPos;

    constructor(anchor: BlockPos, head: BlockPos) {
        this.anchor = anchor;
        this.head = head;
    }
}

export function collapsedSel(blockId: string, offset: number): Selection {
    return new Selection(new BlockPos(blockId, offset), new BlockPos(blockId, offset));
}

export function pos(blockId: string, offset: number): BlockPos {
    return new BlockPos(blockId, offset);
}

export class InsertTextOp {
    pos: BlockPos;
    text: string;

    constructor(pos: BlockPos, text: string) {
        this.pos = pos;
        this.text = text;
    }
}

export class SplitBlockOp {
    pos: BlockPos;
    newId: string;

    constructor(pos: BlockPos, newId: string) {
        this.pos = pos;
        this.newId = newId;
    }
}

export class MergeBlocksOp {
    aId: string;
    bId: string;

    constructor(aId: string, bId: string) {
        this.aId = aId;
        this.bId = bId;
    }
}

export class SetBlockTypeOp {
    id: string;
    kind: BlockType;

    constructor(id: string, kind: BlockType) {
        this.id = id;
        this.kind = kind;
    }
}

export class LiftBlockOp {
    id: string;

    constructor(id: string) {
        this.id = id;
    }
}

export class WrapBlockOp {
    id: string;
    kind: BlockType;
    newId: string;

    constructor(id: string, kind: BlockType, newId: string) {
        this.id = id;
        this.kind = kind;
        this.newId = newId;
    }
}

export class ReplaceRangeOp {
    sel: Selection;
    text: string;

    constructor(sel: Selection, text: string) {
        this.sel = sel;
        this.text = text;
    }
}

export type Op =
    { _tag: "InsertText", value: InsertTextOp }
    | { _tag: "SplitBlock", value: SplitBlockOp }
    | { _tag: "MergeBlocks", value: MergeBlocksOp }
    | { _tag: "SetBlockType", value: SetBlockTypeOp }
    | { _tag: "LiftBlock", value: LiftBlockOp }
    | { _tag: "WrapBlock", value: WrapBlockOp }
    | { _tag: "ReplaceRange", value: ReplaceRangeOp };

export const Op = {
    InsertText: (value: InsertTextOp) => ({ _tag: "InsertText" as const, value }),
    SplitBlock: (value: SplitBlockOp) => ({ _tag: "SplitBlock" as const, value }),
    MergeBlocks: (value: MergeBlocksOp) => ({ _tag: "MergeBlocks" as const, value }),
    SetBlockType: (value: SetBlockTypeOp) => ({ _tag: "SetBlockType" as const, value }),
    LiftBlock: (value: LiftBlockOp) => ({ _tag: "LiftBlock" as const, value }),
    WrapBlock: (value: WrapBlockOp) => ({ _tag: "WrapBlock" as const, value }),
    ReplaceRange: (value: ReplaceRangeOp) => ({ _tag: "ReplaceRange" as const, value })
};


export class EditResult {
    tree: BlockNode;
    selection: Selection;

    constructor(tree: BlockNode, selection: Selection) {
        this.tree = tree;
        this.selection = selection;
    }
}

export function missingBlock(): BlockNode {
    return block("", BlockType.Paragraph);
}

export function splitTailKind(kind: BlockType): BlockType {
    if (kind == BlockType.Heading) {
        return BlockType.Paragraph;
    }
    return kind;
}

export function splitTailAttrs(kind: BlockType, attrs: Attr[]): Attr[] {
    if (kind == BlockType.Heading) {
        const empty: Attr[] = [];
        return empty;
    }
    return dupAttrs(attrs);
}

export function applyOp(tree: BlockNode, selection: Selection, op: Op): EditResult {
        const __auto_is_3 = op;
    if (__auto_is_3._tag === "InsertText") {
        const a = __auto_is_3.value;
        const found = findBlock(tree, a.pos.blockId);
        const target = found ?? missingBlock();
        if (target.id == "") {
            return new EditResult(tree, selection);
        }
        const spans2 = spansInsert(target.inlines, a.pos.offset, a.text);
        const tree2 = replaceNode(tree, target.id, [withInlines(target, spans2)]);
        return new EditResult(tree2, collapsedSel(a.pos.blockId, a.pos.offset + Number(a.text.length)));
    }
    else if (__auto_is_3._tag === "SplitBlock") {
        const a = __auto_is_3.value;
        const found = findBlock(tree, a.pos.blockId);
        const target = found ?? missingBlock();
        if (target.id == "") {
            return new EditResult(tree, selection);
        }
        const split = spansSplitAt(target.inlines, a.pos.offset);
        const left = new BlockNode(target.id, target.kind, dupAttrs(target.attrs), dupNodes(target.children), split.before, rng(target.source.start, target.source.start + a.pos.offset));
        const right = new BlockNode(a.newId, splitTailKind(target.kind), splitTailAttrs(target.kind, target.attrs), dupNodes(target.children), split.after, rng(target.source.start + a.pos.offset, target.source.end));
        const tree2 = replaceNode(tree, target.id, [left, right]);
        return new EditResult(tree2, collapsedSel(a.newId, 0));
    }
    else if (__auto_is_3._tag === "MergeBlocks") {
        const a = __auto_is_3.value;
        const foundA = findBlock(tree, a.aId);
        const nodeA = foundA ?? missingBlock();
        const foundB = findBlock(tree, a.bId);
        const nodeB = foundB ?? missingBlock();
        if (nodeA.id == "") {
            return new EditResult(tree, selection);
        }
        if (nodeB.id == "") {
            return new EditResult(tree, selection);
        }
        const junction: number = Number(blockText(nodeA).length);
        let merged: InlineSpan[] = [];
        for (const s of nodeA.inlines) {
            merged.push(s);
        }
        for (const s of nodeB.inlines) {
            merged.push(s);
        }
        let kids: BlockNode[] = [];
        for (const c of nodeA.children) {
            kids.push(c);
        }
        for (const c of nodeB.children) {
            kids.push(c);
        }
        const a2 = new BlockNode(nodeA.id, nodeA.kind, nodeA.attrs, kids, merged, rng(nodeA.source.start, nodeB.source.end));
        const tree1 = replaceNode(tree, a.bId, []);
        const tree2 = replaceNode(tree1, a.aId, [a2]);
        return new EditResult(tree2, collapsedSel(a.aId, junction));
    }
    else if (__auto_is_3._tag === "SetBlockType") {
        const a = __auto_is_3.value;
        const found = findBlock(tree, a.id);
        const target = found ?? missingBlock();
        if (target.id == "") {
            return new EditResult(tree, selection);
        }
        const tree2 = replaceNode(tree, a.id, [withKind(target, a.kind)]);
        return new EditResult(tree2, selection);
    }
    else if (__auto_is_3._tag === "LiftBlock") {
        const a = __auto_is_3.value;
        const foundT = findBlock(tree, a.id);
        const target = foundT ?? missingBlock();
        if (target.id == "") {
            return new EditResult(tree, selection);
        }
        const foundP = parentOf(tree, a.id);
        const parent = foundP ?? missingBlock();
        if (parent.id == "") {
            return new EditResult(tree, selection);
        }
        if (parent.id == tree.id) {
            return new EditResult(tree, selection);
        }
        const idx = childIndex(parent, a.id);
        let beforeKids: BlockNode[] = [];
        let afterKids: BlockNode[] = [];
        for (let i = 0; i < Number(parent.children.length); i++) {
            if (i < idx) {
                beforeKids.push(parent.children[i]);
            }
            if (i > idx) {
                afterKids.push(parent.children[i]);
            }
        }
        let repl: BlockNode[] = [];
        if (Number(beforeKids.length) > 0) {
            repl.push(new BlockNode(parent.id, parent.kind, dupAttrs(parent.attrs), beforeKids, parent.inlines, parent.source));
        }
        repl.push(target);
        if (Number(afterKids.length) > 0) {
            repl.push(new BlockNode(parent.id + "-l", parent.kind, dupAttrs(parent.attrs), afterKids, parent.inlines, parent.source));
        }
        const tree2 = replaceNode(tree, parent.id, repl);
        return new EditResult(tree2, selection);
    }
    else if (__auto_is_3._tag === "WrapBlock") {
        const a = __auto_is_3.value;
        const found = findBlock(tree, a.id);
        const target = found ?? missingBlock();
        if (target.id == "") {
            return new EditResult(tree, selection);
        }
        const wrapper = new BlockNode(a.newId, a.kind, [], [target], [], rng(target.source.start, target.source.end));
        const tree2 = replaceNode(tree, a.id, [wrapper]);
        return new EditResult(tree2, selection);
    }
    else if (__auto_is_3._tag === "ReplaceRange") {
        const a = __auto_is_3.value;
        const sel: Selection = a.sel;
        if (sel.anchor.blockId == sel.head.blockId) {
            const found = findBlock(tree, sel.anchor.blockId);
            const target = found ?? missingBlock();
            if (target.id == "") {
                return new EditResult(tree, selection);
            }
            let lo: number = sel.anchor.offset;
            let hi: number = sel.head.offset;
            if (lo > hi) {
                const tmp: number = lo;
                lo = hi;
                hi = tmp;
            }
            const spans2 = spansInsert(spansDelete(target.inlines, lo, hi), lo, a.text);
            const tree2 = replaceNode(tree, target.id, [withInlines(target, spans2)]);
            return new EditResult(tree2, collapsedSel(sel.anchor.blockId, lo + Number(a.text.length)));
        }
        const foundPA = parentOf(tree, sel.anchor.blockId);
        const pa = foundPA ?? missingBlock();
        const foundPH = parentOf(tree, sel.head.blockId);
        const ph = foundPH ?? missingBlock();
        if (pa.id == "") {
            return new EditResult(tree, selection);
        }
        if (ph.id == "") {
            return new EditResult(tree, selection);
        }
        if (pa.id != ph.id) {
            return new EditResult(tree, selection);
        }
        const ai = childIndex(pa, sel.anchor.blockId);
        const hi2 = childIndex(pa, sel.head.blockId);
        if (ai < 0) {
            return new EditResult(tree, selection);
        }
        if (hi2 < 0) {
            return new EditResult(tree, selection);
        }
        if (ai > hi2) {
            return new EditResult(tree, selection);
        }
        const aBlock = pa.children[ai];
        const hBlock = pa.children[hi2];
        const mergedText: string = blockText(aBlock).slice(0, sel.anchor.offset) + a.text + blockText(hBlock).slice(sel.head.offset);
        let kids3: BlockNode[] = [];
        for (const c of aBlock.children) {
            kids3.push(c);
        }
        for (const c of hBlock.children) {
            kids3.push(c);
        }
        const merged = new BlockNode(aBlock.id, aBlock.kind, aBlock.attrs, kids3, [span(mergedText)], rng(aBlock.source.start, hBlock.source.end));
        const tree2 = spliceRange(tree, pa.id, ai, hi2 + 1, [merged]);
        return new EditResult(tree2, collapsedSel(sel.anchor.blockId, sel.anchor.offset + Number(a.text.length)));
    }
    return new EditResult(tree, selection);
}

export function textInRange(tree: BlockNode, sel: Selection): string {
    if (sel.anchor.blockId == sel.head.blockId) {
        const found = findBlock(tree, sel.anchor.blockId);
        const target = found ?? missingBlock();
        if (target.id == "") {
            return "";
        }
        let lo: number = sel.anchor.offset;
        let hi: number = sel.head.offset;
        if (lo > hi) {
            const tmp: number = lo;
            lo = hi;
            hi = tmp;
        }
        return blockText(target).slice(lo, hi);
    }
    const foundA = findBlock(tree, sel.anchor.blockId);
    const a = foundA ?? missingBlock();
    const foundH = findBlock(tree, sel.head.blockId);
    const h = foundH ?? missingBlock();
    return blockText(a) + blockText(h);
}

export function invertOp(tree: BlockNode, op: Op): Op {
        const __auto_is_4 = op;
    if (__auto_is_4._tag === "InsertText") {
        const a = __auto_is_4.value;
        return Op.ReplaceRange(new ReplaceRangeOp(new Selection(a.pos, new BlockPos(a.pos.blockId, a.pos.offset + Number(a.text.length))), ""));
    }
    else if (__auto_is_4._tag === "SplitBlock") {
        const a = __auto_is_4.value;
        return Op.MergeBlocks(new MergeBlocksOp(a.pos.blockId, a.newId));
    }
    else if (__auto_is_4._tag === "MergeBlocks") {
        const a = __auto_is_4.value;
        const foundA = findBlock(tree, a.aId);
        const nodeA = foundA ?? missingBlock();
        return Op.SplitBlock(new SplitBlockOp(new BlockPos(a.aId, Number(blockText(nodeA).length)), a.bId));
    }
    else if (__auto_is_4._tag === "SetBlockType") {
        const a = __auto_is_4.value;
        const found = findBlock(tree, a.id);
        const target = found ?? missingBlock();
        return Op.SetBlockType(new SetBlockTypeOp(a.id, target.kind));
    }
    else if (__auto_is_4._tag === "LiftBlock") {
        const a = __auto_is_4.value;
        const foundP = parentOf(tree, a.id);
        const parent = foundP ?? missingBlock();
        if (parent.id == "") {
            return Op.SetBlockType(new SetBlockTypeOp(a.id, BlockType.Paragraph));
        }
        if (parent.id == tree.id) {
            return Op.SetBlockType(new SetBlockTypeOp(a.id, BlockType.Paragraph));
        }
        return Op.WrapBlock(new WrapBlockOp(a.id, parent.kind, parent.id));
    }
    else if (__auto_is_4._tag === "WrapBlock") {
        const a = __auto_is_4.value;
        return Op.LiftBlock(new LiftBlockOp(a.id));
    }
    else if (__auto_is_4._tag === "ReplaceRange") {
        const a = __auto_is_4.value;
        const oldText = textInRange(tree, a.sel);
        return Op.ReplaceRange(new ReplaceRangeOp(new Selection(a.sel.anchor, new BlockPos(a.sel.anchor.blockId, a.sel.anchor.offset + Number(a.text.length))), oldText));
    }
    return Op.SetBlockType(new SetBlockTypeOp("", BlockType.Paragraph));
}