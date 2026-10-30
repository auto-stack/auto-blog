/**
 * @autodown/engine — rendered-artifact cache key (render layer).
 *
 * GENERATED FILE — do not edit by hand.
 * Source: auto/artifact_hash.at (Auto language). Regenerate with: pnpm gen:render
 * (see auto/README.md for the pipeline and the applied post-fixes)
 */

export function fnvOffsetBasis(): number {
    return 2000000000 + 166136261;
}

export function fnvPrime(): number {
    return 16777619;
}

export function u32Modulus(): number {
    return 65536 * 65536;
}

export function bitAt(x: number, p: number): number {
    const r: number = x % p;
    const t: number = x - r;
    const q: number = t / p;
    return q % 2;
}

export function xor32(a: number, b: number): number {
    let r: number = 0;
    let p: number = 1;
    let i: number = 0;
    while (i < 32) {
        const ab: number = bitAt(a, p);
        const bb: number = bitAt(b, p);
        if (ab != bb) {
            r = r + p;
        }
        p = p * 2;
        i = i + 1;
    }
    return r;
}

export function mulMod32(a: number, b: number): number {
    const lo: number = a % 65536;
    const t: number = a - lo;
    const hi: number = t / 65536;
    const ph: number = hi * b;
    const pl: number = lo * b;
    const phr: number = ph % u32Modulus();
    const plr: number = pl % u32Modulus();
    const s1: number = phr * 65536;
    const s: number = s1 + plr;
    return s % u32Modulus();
}

export function fnvStep(h: number, u: number): number {
    const x: number = xor32(h, u);
    return mulMod32(x, fnvPrime());
}

export function hexDigit(d: number): string {
    const digits: string = "0123456789abcdef";
    return digits.slice(d, d + 1);
}

export function hex32(v: number): string {
    let out: string = "";
    let x: number = v;
    let i: number = 0;
    while (i < 8) {
        const d: number = x % 16;
        out = hexDigit(d) + out;
        const t: number = x - d;
        x = t / 16;
        i = i + 1;
    }
    return out;
}

export function artifactKeyOf(kind: string, source_len: number, units: number[]): string {
    let h: number = fnvOffsetBasis();
    for (let i = 0; i < Number(units.length); i++) {
        h = fnvStep(h, units[i]);
    }
    return kind + ":" + String(source_len) + ":" + hex32(h);
}