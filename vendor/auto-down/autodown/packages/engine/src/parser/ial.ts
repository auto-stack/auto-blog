/**
 * AutoDown Core — Shared types and IAL (Inline Attribute List) utilities.
 *
 * GENERATED FILE — do not edit by hand.
 * Source: auto/ial.at (Auto language). Regenerate with: pnpm gen
 * (see auto/README.md for the pipeline and the applied post-fixes)
 */

export class TableAttr {
    cols: (number | null)[];
    rows: (number | null)[];

    constructor(cols: (number | null)[], rows: (number | null)[]) {
        this.cols = cols;
        this.rows = rows;
    }
}

export class PreDoc {
    md: string;
    tableAttrs: TableAttr[];

    constructor(md: string, tableAttrs: TableAttr[]) {
        this.md = md;
        this.tableAttrs = tableAttrs;
    }
}

export function startsWithStr(s: string, prefix: string): boolean {
    if (Number(s.length) < Number(prefix.length)) {
        return false;
    }
    return s.slice(0, Number(prefix.length)) == prefix;
}

export function startsWithAt(s: string, prefix: string, at: number): boolean {
    if (at < 0) {
        return false;
    }
    if (at + Number(prefix.length) > Number(s.length)) {
        return false;
    }
    return s.slice(at, at + Number(prefix.length)) == prefix;
}

export function endsWithStr(s: string, suffix: string): boolean {
    if (Number(s.length) < Number(suffix.length)) {
        return false;
    }
    return s.slice(Number(s.length) - Number(suffix.length), Number(s.length)) == suffix;
}

export function trimStartStr(s: string): string {
    let p: number = 0;
    while (p < Number(s.length)) {
        const c = s.charCodeAt(p);
        if (c == 32) {
            p += 1;
        } else {
            if (c == 9) {
                p += 1;
            } else {
                break;
            }
        }
    }
    if (p == 0) {
        return s;
    }
    return s.slice(p);
}

export function trimEndStr(s: string): string {
    let end: number = Number(s.length);
    while (end > 0) {
        const c = s.charCodeAt(end - 1);
        if (c == 32) {
            end -= 1;
        } else {
            if (c == 9) {
                end -= 1;
            } else {
                if (c == 10) {
                    end -= 1;
                } else {
                    if (c == 13) {
                        end -= 1;
                    } else {
                        break;
                    }
                }
            }
        }
    }
    if (end == Number(s.length)) {
        return s;
    }
    return s.slice(0, end);
}

export function hasChar(s: string, code: number): boolean {
    let i: number = 0;
    while (i < Number(s.length)) {
        if (s.charCodeAt(i) == code) {
            return true;
        }
        i += 1;
    }
    return false;
}

export function findStr(s: string, needle: string): number {
    const nLen: number = Number(needle.length);
    const sLen: number = Number(s.length);
    if (nLen == 0) {
        return 0;
    }
    if (sLen < nLen) {
        return -1;
    }
    let i: number = 0;
    while (i + nLen <= sLen) {
        if (s.slice(i, i + nLen) == needle) {
            return i;
        }
        i += 1;
    }
    return -1;
}

export function findStrFrom(s: string, needle: string, from: number): number {
    const nLen: number = Number(needle.length);
    const sLen: number = Number(s.length);
    if (nLen == 0) {
        if (from <= sLen) {
            return from;
        }
        return -1;
    }
    let i: number = from;
    if (i < 0) {
        i = 0;
    }
    while (i + nLen <= sLen) {
        if (s.slice(i, i + nLen) == needle) {
            return i;
        }
        i += 1;
    }
    return -1;
}

export function rfindChar(s: string, code: number): number {
    let i: number = Number(s.length) - 1;
    while (i >= 0) {
        if (s.charCodeAt(i) == code) {
            return i;
        }
        i -= 1;
    }
    return -1;
}

export function scanIntPrefix(s: string): number | null {
    let i: number = 0;
    let neg: boolean = false;
    if (Number(s.length) > 0) {
        if (s.charCodeAt(0) == 45) {
            neg = true;
            i = 1;
        } else {
            if (s.charCodeAt(0) == 43) {
                i = 1;
            }
        }
    }
    let val: number = 0;
    let digits: number = 0;
    while (i < Number(s.length)) {
        const c = s.charCodeAt(i);
        if (c >= 48) {
            if (c <= 57) {
                val = val * 10 + c - 48;
                digits += 1;
                i += 1;
            } else {
                break;
            }
        } else {
            break;
        }
    }
    if (digits == 0) {
        return null;
    }
    if (neg) {
        val = -val;
    }
    return val;
}

export function stripQuotes(s: string): string {
    const t = s.trim();
    if (Number(t.length) == 0) {
        return t;
    }
    let start: number = 0;
    let end: number = Number(t.length);
    const c0 = t.charCodeAt(0);
    if (c0 == 34) {
        start = 1;
    } else {
        if (c0 == 39) {
            start = 1;
        }
    }
    if (end > start) {
        const cl = t.charCodeAt(end - 1);
        if (cl == 34) {
            end = end - 1;
        } else {
            if (cl == 39) {
                end = end - 1;
            }
        }
    }
    return t.slice(start, end);
}

export function parseValue(s: string): number | null {
    const trimmed = stripQuotes(s);
    if (trimmed == "auto") {
        return null;
    }
    return scanIntPrefix(trimmed);
}

export function parseArray(s: string): (number | null)[] {
    const parts = s.split(",");
    let out: (number | null)[] = [];
    let i: number = 0;
    while (i < Number(parts.length)) {
        const p = parts[i];
        out.push(parseValue(p));
        i += 1;
    }
    return out;
}

export function parseRows(s: string | null): (number | null)[] {
    const sv: string | null = s ?? "";
    if (sv == "") {
        return [];
    }
    return parseArray(sv);
}

export function formatValue(v: number | null): string {
    if (v == null) {
        return "\"auto\"";
    }
    return String(v ?? 0);
}

export function formatArray(arr: (number | null)[]): string {
    let parts: string[] = [];
    for (const v of arr) {
        parts.push(formatValue(v));
    }
    return parts.join(",");
}

export function hasAnyValue(arr: (number | null)[]): boolean {
    let i: number = 0;
    while (i < Number(arr.length)) {
        const v = arr[i];
        if (v != null) {
            return true;
        }
        i += 1;
    }
    return false;
}

export function isPipeRow(line: string): boolean {
    let end: number = Number(line.length);
    while (end > 0) {
        const c = line.charCodeAt(end - 1);
        if (c == 32) {
            end -= 1;
        } else {
            if (c == 9) {
                end -= 1;
            } else {
                break;
            }
        }
    }
    if (end < 2) {
        return false;
    }
    if (line.charCodeAt(0) != 124) {
        return false;
    }
    if (line.charCodeAt(end - 1) != 124) {
        return false;
    }
    return true;
}

export function isDelimRow(line: string): boolean {
    let end: number = Number(line.length);
    while (end > 0) {
        const c = line.charCodeAt(end - 1);
        if (c == 32) {
            end -= 1;
        } else {
            if (c == 9) {
                end -= 1;
            } else {
                break;
            }
        }
    }
    if (end < 3) {
        return false;
    }
    if (line.charCodeAt(0) != 124) {
        return false;
    }
    if (line.charCodeAt(end - 1) != 124) {
        return false;
    }
    let i: number = 1;
    while (i < end - 1) {
        const c = line.charCodeAt(i);
        let ok: boolean = false;
        if (c == 45) {
            ok = true;
        } else {
            if (c == 58) {
                ok = true;
            } else {
                if (c == 124) {
                    ok = true;
                } else {
                    if (c == 32) {
                        ok = true;
                    } else {
                        if (c == 9) {
                            ok = true;
                        }
                    }
                }
            }
        }
        if (!ok) {
            return false;
        }
        i += 1;
    }
    return true;
}

export function parseIalLine(line: string): TableAttr | null {
    let end: number = Number(line.length);
    while (end > 0) {
        const c = line.charCodeAt(end - 1);
        if (c == 32) {
            end -= 1;
        } else {
            if (c == 9) {
                end -= 1;
            } else {
                break;
            }
        }
    }
    if (end < 9) {
        return null;
    }
    const s = line.slice(0, end);
    if (!startsWithStr(s, "{cols:[")) {
        return null;
    }
    if (!endsWithStr(s, "}")) {
        return null;
    }
    const bodyEnd: number = Number(s.length) - 1;
    let c1: number = -1;
    let i: number = 7;
    while (i < bodyEnd) {
        if (s.charCodeAt(i) == 93) {
            c1 = i;
            break;
        }
        i += 1;
    }
    if (c1 == -1) {
        return null;
    }
    const cols = parseArray(s.slice(7, c1));
    let rows: (number | null)[] = [];
    const rest = s.slice(c1 + 1, bodyEnd);
    if (rest != "") {
        if (!startsWithStr(rest, ",")) {
            return null;
        }
        let r = rest.slice(1);
        let advancing: boolean = true;
        while (advancing) {
            advancing = false;
            if (Number(r.length) > 0) {
                const c = r.charCodeAt(0);
                if (c == 32) {
                    r = r.slice(1);
                    advancing = true;
                } else {
                    if (c == 9) {
                        r = r.slice(1);
                        advancing = true;
                    } else {
                        if (c == 10) {
                            r = r.slice(1);
                            advancing = true;
                        } else {
                            if (c == 13) {
                                r = r.slice(1);
                                advancing = true;
                            }
                        }
                    }
                }
            }
        }
        if (!startsWithStr(r, "rows:[")) {
            return null;
        }
        const r2 = r.slice(6);
        let c2: number = -1;
        let k: number = 0;
        while (k < Number(r2.length)) {
            if (r2.charCodeAt(k) == 93) {
                c2 = k;
                break;
            }
            k += 1;
        }
        if (c2 == -1) {
            return null;
        }
        if (c2 + 1 != Number(r2.length)) {
            return null;
        }
        rows = parseArray(r2.slice(0, c2));
    }
    return new TableAttr(cols, rows);
}

export function preprocessMarkdown(md: string): PreDoc {
    const lines = md.split("\n");
    let attrs: TableAttr[] = [];
    let out: string[] = [];
    let i: number = 0;
    while (i < Number(lines.length)) {
        let matched: boolean = false;
        if (i + 1 < Number(lines.length)) {
            if (isPipeRow(lines[i])) {
                if (isDelimRow(lines[i + 1])) {
                    let j: number = i + 2;
                    let dataCount: number = 0;
                    let scanning: boolean = true;
                    while (scanning) {
                        scanning = false;
                        if (j < Number(lines.length)) {
                            if (isPipeRow(lines[j])) {
                                j += 1;
                                dataCount += 1;
                                scanning = true;
                            }
                        }
                    }
                    if (dataCount >= 1) {
                        if (j < Number(lines.length)) {
                            const ial = parseIalLine(lines[j]);
                            if (ial != null) {
                                attrs.push(ial ?? new TableAttr([], []));
                                let k: number = i;
                                while (k < j) {
                                    out.push(lines[k]);
                                    k += 1;
                                }
                                i = j + 1;
                                matched = true;
                            }
                        }
                    }
                }
            }
        }
        if (!matched) {
            out.push(lines[i]);
            i += 1;
        }
    }
    return new PreDoc(out.join("\n"), attrs);
}

export function buildIAL(colwidth: (number | null)[], rowheight: (number | null)[]): string | null {
    const hasCols = hasAnyValue(colwidth);
    const hasRows = hasAnyValue(rowheight);
    if (!hasCols) {
        if (!hasRows) {
            return null;
        }
    }
    let parts: string[] = [];
    if (hasCols) {
        parts.push("cols:[" + formatArray(colwidth) + "]");
    }
    if (hasRows) {
        parts.push("rows:[" + formatArray(rowheight) + "]");
    }
    return "{" + parts.join(", ") + "}\n";
}