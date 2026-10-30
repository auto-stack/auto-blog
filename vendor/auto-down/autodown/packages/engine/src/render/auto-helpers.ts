// Hand-written JS-semantic bridge for the Auto (a2ts) sources in auto/.
//
// a2ts cannot express try/catch, `typeof`, or truthiness coercion — those
// three JS-only semantics live here and nowhere else; everything else is in
// the .at sources. The generated files import from here via `use helpers:`
// (see auto/gen.mjs, post-fix P1 rewrites the module specifier to this
// module).

export interface SafeParseResult {
  ok: boolean
  value: any
}

export function safeJsonParse(s: string): SafeParseResult {
  try {
    return { ok: true, value: JSON.parse(s) }
  } catch {
    return { ok: false, value: null }
  }
}

export function typeOf(v: any): string {
  return typeof v
}

export function isTruthy(v: any): boolean {
  return !!v
}
