// artifact-key.ts — the TS side of the rendered-artifact cache key (plan
// 031 D5/D6). The hash ALGORITHM is single-sourced in
// auto/render/artifact_hash.at (emitted to artifact-hash.generated.ts and,
// as a2r, into the autodown-core rust crate); what cannot live there is
// the UTF-16 unit materialization (the .at string ops are not
// cross-target-portable — charCodeAt emits TS-only, char_at rust-only,
// .length counts UTF-16 units in TS vs scalars in rust; see the .at
// header). This wrapper is the TS half of that boundary; the rust half
// (encode_utf16) is appended to the a2r emission by gen.mjs. The parity
// golden (tests/golden/artifact-hash.golden.txt, CJK/emoji/multiline
// corpus) locks the two emissions byte for byte.

import { artifactKeyOf } from './artifact-hash.generated'

/** The artifact cache key: `kind:<utf16 len of source>:<8-hex FNV-1a>`.
 *  Same (kind, source) -> same key on TS and rust (VM/iced disk caches
 *  read what the web side wrote). */
export function artifactHash(kind: string, source: string): string {
  const s = kind + '\u0000' + source
  const units: number[] = new Array<number>(s.length)
  for (let i = 0; i < s.length; i++) units[i] = s.charCodeAt(i)
  return artifactKeyOf(kind, source.length, units)
}
