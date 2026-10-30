/**
 * @autodown/vue — streaming document segmentation.
 *
 * GENERATED FILE — do not edit by hand.
 * Source: auto/streaming.at (Auto language). Regenerate with: pnpm gen
 * (see auto/README.md for the pipeline and the applied post-fixes)
 */

import { safeJsonParse, typeOf, isTruthy } from "./auto-helpers";

export interface MarkdownSegment {
    type: 'markdown';
    text: string;
}

export interface ComponentSegment {
    type: 'component';
    componentType: string;
    props: Record<string, any>;
    final: boolean;
}

export type StreamingSegment = MarkdownSegment | ComponentSegment;


export interface JSONBlock {
    start: number;
    end: number;
    content: string;
    closed: boolean;
}

let COMPONENT_TYPES: string[] = ["table"];

let stickyPropsCache: Record<string, any> = {  };

export function parsePartialJSON(text: string): any {
    const trimmed = text.trim();
    if (trimmed == "") {
        return { value: null, valid: false };
    }
    


    const direct = safeJsonParse(trimmed);
    if (direct.ok) {
        return { value: direct.value, valid: true };
    }
    


    let inString: boolean = false;
    let escape: boolean = false;
    let stack: string[] = [];
    let i: number = 0;
    

    while (i < trimmed.length) {
        const ch = trimmed[i];
        if (escape) {
            escape = false;
            i += 1;
            continue;
        }
        if (ch == "\\") {
            escape = true;
            i += 1;
            continue;
        }
        if (ch == "\"") {
            inString = !inString;
            i += 1;
            continue;
        }
        if (inString) {
            i += 1;
            continue;
        }
        

        if (ch == "{" || ch == "[") {
            if (ch == "{") {
                stack.push("}");
            } else {
                stack.push("]");
            }
            i += 1;
            continue;
        }
        

        let isCloser: boolean = false;
        if (ch == "}") {
            isCloser = true;
        }
        if (ch == "]") {
            isCloser = true;
        }
        if (isCloser) {
            

            if (stack.length > 0) {
                const expected = stack[stack.length - 1];
                if (ch == expected) {
                    stack.pop();
                }
            }
        }
        i += 1;
    }
    

    let completion: string = "";
    if (inString) {
        completion = completion + "\"";
    }
    completion = completion + stack.reverse().join("");
    

    const repaired = safeJsonParse(trimmed + completion);
    if (repaired.ok) {
        return { value: repaired.value, valid: false };
    }
    return { value: null, valid: false };
}

export function findJSONBlocks(text: string): JSONBlock[] {
    let blocks: JSONBlock[] = [];
    let i: number = 0;
    while (i < text.length) {
        const fenceStart = text.indexOf("```json\n", i);
        if (fenceStart == -1) {
            break;
        }
        

        const contentStart: number = fenceStart + 8;
        const fenceEnd = text.indexOf("\n```", contentStart);
        

        if (fenceEnd != -1) {
            const end: number = fenceEnd + 4;
            const content = text.slice(contentStart, fenceEnd);
            blocks.push({ start: fenceStart, end: end, content: content, closed: true });
            i = end;
        } else {
            const tail = text.slice(contentStart);
            blocks.push({ start: fenceStart, end: text.length, content: tail, closed: false });
            break;
        }
    }
    return blocks;
}

export function isComponentJSON(value: any): boolean {
    if (!isTruthy(value)) {
        return false;
    }
    const kind = typeOf(value);
    if (kind != "object") {
        return false;
    }
    const t = value["type"];
    const tk = typeOf(t);
    if (tk != "string") {
        return false;
    }
    return COMPONENT_TYPES.includes(t);
}

export function detectComponentType(raw: string): string | null {
    const re = RegExp("\"type\"\\s*:\\s*\"([^\"]*)\"");
    const m = raw.match(re);
    if (m == null) {
        return null;
    }
    const partial = m[1];
    for (const t of COMPONENT_TYPES) {
        const a = t.startsWith(partial);
        const b = partial.startsWith(t);
        if (a || b) {
            return t;
        }
    }
    return null;
}

export function buildSegments(text: string): StreamingSegment[] {
    const blocks = findJSONBlocks(text);
    let segments: any[] = [];
    let cursor: number = 0;
    

    for (const block of blocks) {
        const cacheKey: string = String(block.start);
        

        if (block.start > cursor) {
            segments.push({ type: "markdown", text: text.slice(cursor, block.start) });
        }
        


        const parsed = parsePartialJSON(block.content);
        const value = parsed.value;
        const valid = parsed.valid;
        const hintedType = detectComponentType(block.content);
        

        if (isComponentJSON(value)) {
            

            let props: Record<string, any> = {  };
            for (const [k, v] of Object.entries(value)) {
                if (k != "type") {
                    props[k] = v;
                }
            }
            stickyPropsCache[cacheKey] = props;
            segments.push({ type: "component", componentType: value["type"], props: props, final: valid && block.closed });
        } else {
            if (hintedType != null) {
                




                let sticky = stickyPropsCache[cacheKey];
                let defaults: Record<string, any> = {  };
                if (hintedType == "table") {
                    defaults = { columns: [], rows: [] };
                }
                

                let props2 = value;
                if (props2 == null) {
                    props2 = sticky;
                }
                if (props2 == null) {
                    props2 = defaults;
                }
                if (isTruthy(value)) {
                    stickyPropsCache[cacheKey] = value;
                }
                segments.push({ type: "component", componentType: hintedType, props: props2, final: valid && block.closed });
            } else {
                

                let fence: string = text.slice(block.start, block.end);
                if (!block.closed) {
                    fence = fence + "\n```";
                }
                segments.push({ type: "markdown", text: fence });
            }
        }
        

        cursor = block.end;
    }
    


    if (cursor < text.length) {
        segments.push({ type: "markdown", text: text.slice(cursor) });
    }
    

    return segments;
}