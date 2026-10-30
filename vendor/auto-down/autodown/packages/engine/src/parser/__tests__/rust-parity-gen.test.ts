// Golden generator for the Rust pilot crate's parity test (plan 016 Phase 4).
// Builds the same hand-constructed trees as rust/tests/parity.rs, serializes
// them with the TS emission of serializer.at, and rewrites
// rust/tests/golden/parity.ad. Idempotent: runs as part of `pnpm test`;
// a non-empty `git diff` on the golden afterwards means the TS side changed
// and the Rust crate's parity result must be re-reviewed.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  Attr,
  BlockNode,
  BlockType,
  InlineSpan,
  Mark,
  Value,
  attrSet,
  block,
  leafBlock,
  markedSpan,
  rng,
  span,
} from "../block-model";
import { serialize } from "../serializer";

function doc(children: BlockNode[]): BlockNode {
  return new BlockNode("doc", BlockType.Paragraph, [], children, [], rng(0, 0));
}

function para(id: string, text: string): BlockNode {
  return leafBlock(id, BlockType.Paragraph, text);
}

function caseHeadingParagraphList(): string {
  const h = block("block-0", BlockType.Heading);
  h.attrs = attrSet(h.attrs, "level", Value.Int(1));
  h.inlines = [span("Hello")];

  const p = new BlockNode(
    "block-1",
    BlockType.Paragraph,
    [],
    [],
    [span("a "), markedSpan("bold", [Mark.Strong]), span(" move")],
    rng(0, 0),
  );

  const item = (id: string, text: string): BlockNode =>
    new BlockNode(id, BlockType.ListItem, [], [para(`${id}-0`, text)], [], rng(0, 0));
  const list = block("block-2", BlockType.ListBlock);
  list.attrs = attrSet(list.attrs, "ordered", Value.Bool(false));
  list.children = [item("block-2-0", "one"), item("block-2-1", "two")];

  return serialize(doc([h, p, list]), false);
}

function caseTableWithIal(): string {
  const cell = (id: string, header: boolean, text: string): BlockNode =>
    new BlockNode(
      id,
      BlockType.TableCell,
      attrSet(attrSet([], "header", Value.Bool(header)), "align", Value.Str("")),
      [],
      [span(text)],
      rng(0, 0),
    );
  const row = (id: string, header: boolean, text: string): BlockNode =>
    new BlockNode(id, BlockType.TableRow, [], [cell(`${id}-c0`, header, text)], [], rng(0, 0));
  const ial = Value.AttrsV([
    new Attr("cols", Value.ListV([Value.Int(120), Value.Null()])),
    new Attr("rows", Value.ListV([Value.Int(40)])),
  ]);
  const table = block("block-0", BlockType.Table);
  table.children = [row("block-0-h", true, "a"), row("block-0-r0", false, "1")];
  table.attrs = attrSet(table.attrs, "ial", ial);

  return serialize(doc([table]), false);
}

function caseEmitIds(): string {
  // New anchor semantics: only the  attr (lifted ^token) re-emits
  // under emitIds=true; fallback ids stay internal.
  const h = block("title-1", BlockType.Heading);
  h.attrs = attrSet(h.attrs, "level", Value.Int(2));
  h.attrs = attrSet(h.attrs, "anchor", Value.Str("title-1"));
  h.inlines = [span("Title")];
  const anchored = para("my-anchor", "kept ^my-anchor");
  return serialize(doc([h, anchored]), true);
}

function caseHardbreakAndFence(): string {
  const hb = new BlockNode(
    "block-0",
    BlockType.Paragraph,
    [],
    [],
    [span("line one"), new InlineSpan("\n", [], []), span("line two")],
    rng(0, 0),
  );
  const f = block("block-1", BlockType.Fence);
  f.attrs = attrSet(f.attrs, "language", Value.Str("ts"));
  f.inlines = [span("const x = 1\n")];
  return serialize(doc([hb, f]), false);
}

const CASES: Array<[string, () => string]> = [
  ["heading_paragraph_list", caseHeadingParagraphList],
  ["table_with_ial", caseTableWithIal],
  ["emit_ids", caseEmitIds],
  ["hardbreak_and_fence", caseHardbreakAndFence],
];

describe("rust parity golden generator", () => {
  it("writes rust/tests/golden/parity.ad", () => {
    const golden = CASES.map(([name, build]) => `=== ${name} ===\n${build()}`).join("");
    const out = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../rust/tests/golden/parity.ad",
    );
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, golden, "utf8");
    expect(golden.length).toBeGreaterThan(0);
  });
});
