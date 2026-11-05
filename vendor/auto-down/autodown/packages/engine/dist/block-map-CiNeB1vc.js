import { ref as k, getCurrentInstance as Qn, onBeforeUnmount as Ee, defineComponent as te, computed as m, onMounted as fe, openBlock as p, createBlock as ee, resolveDynamicComponent as pe, withModifiers as De, normalizeClass as xe, h as se, unref as ue, withCtx as Xe, createElementBlock as x, Fragment as Ce, renderList as Ke, createCommentVNode as $, nextTick as le, onUnmounted as Ct, normalizeStyle as bn, createElementVNode as b, withDirectives as ct, withKeys as ze, vModelText as xt, toDisplayString as W, watch as Le, inject as zn, provide as Gn, createTextVNode as et, vShow as jn, createVNode as pt, mergeProps as Yn } from "vue";
import { a0 as tt, O as Jn, J as Xn, ab as Kt, T as wn, M as q, B as T, f as J, a1 as nt, u as Zn, a2 as Wt, i as Rt, Q as Pe, V as Ie, r as ye, b as me, $ as Ze, a7 as yn, d as dt, ac as Ge, k as eo, S as gt, K as je, h as _n } from "./parser-BfX0E-c9.js";
import { H as to, I as no, J as St, K as Vt, L as oo, M as lo, N as Cn, O as ao, a as Qt, c as io, t as ro, b as so, P as uo, Q as It, R as Sn, S as ot, T as In, U as Mt, V as Bn, W as lt, X as Et, Y as Tn, _ as ft, Z as xn, $ as co, a0 as fo, a1 as ho, a2 as vo, a3 as mo, a4 as at, a5 as po, y as Re, l as We, a6 as go, a7 as ko, w as ht, a8 as bo, p as zt, a9 as wo, B as yo, F as Ve, aa as vt, ab as _o, ac as Co, ad as kt, ae as So, af as Io, ag as Gt, ah as jt, G as Bo, ai as bt, aj as To, ak as Yt, al as xo } from "./render-node-BgT731Tv.js";
import { Link as Rn, Code as Mn, Strikethrough as Ro, Underline as Mo, Italic as Eo, Bold as Ao, Check as Lo, Text as Oo, Heading1 as Do, Heading2 as $o, Heading3 as qo, Heading4 as No, Heading5 as Ho, Heading6 as Po, List as Fo, ListOrdered as Uo, CheckSquare as Ko, Quote as Wo, Minus as Vo, Image as Qo, Table as zo, AlertCircle as Go, PanelTop as jo, Sigma as Yo, Workflow as Jo, Square as Xo, CircleDot as Zo, CheckCircle2 as el, Clock as tl, Timer as nl, ArrowUp as wt, Search as ol } from "lucide-vue-next";
class ll {
  constructor(n, e) {
    var o;
    this.undoStack = [], this.redoStack = [], this.listeners = [], this.tree = n, this.sel = e ?? tt(((o = n.children[0]) == null ? void 0 : o.id) ?? "", 0);
  }
  get doc() {
    return this.tree;
  }
  get selection() {
    return this.sel;
  }
  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }
  onChange(n) {
    this.listeners.push(n);
  }
  /** Apply one op through the 016 kernel, recording an undo entry.
   *  Adjacent InsertText typing coalesces into the previous entry. */
  apply(n, e = {}) {
    const o = this.undoStack[this.undoStack.length - 1], l = o != null && o.ops.length === 1 ? o.ops[0] : void 0;
    if (e.coalesce !== !1 && l != null && l._tag === "InsertText" && n._tag === "InsertText" && l.value.pos.blockId === n.value.pos.blockId && l.value.pos.offset + l.value.text.length === n.value.pos.offset && o) {
      const s = l.value, u = n.value;
      o.ops[0] = Jn.InsertText(new Xn(s.pos, s.text + u.text));
    } else
      this.undoStack.push({ preTree: this.tree, preSel: this.sel, ops: [n] });
    this.redoStack = [];
    const i = Kt(this.tree, this.sel, n);
    return this.tree = i.tree, this.sel = i.selection, this.emit(!1), i;
  }
  /** Apply a composed op group as ONE undo step (input rules etc.). */
  applyGroup(n, e) {
    n.length === 0 && e == null || (this.undoStack.push({ preTree: this.tree, preSel: this.sel, ops: [...n], after: e }), this.redoStack = [], this.thread(n, e), this.emit(!1));
  }
  /** Apply a pure tree transform as ONE undo step (command layer:
   *  insertTemplate / table ops / moveBlock — Phase 3). */
  applyTree(n) {
    this.applyGroup([], n);
  }
  /** Set the selection without a document change (focus moves). */
  select(n) {
    this.sel = n, this.emit(!1);
  }
  thread(n, e) {
    let o = this.tree, l = this.sel;
    for (const a of n) {
      const i = Kt(o, l, a);
      o = i.tree, l = i.selection;
    }
    e && (o = e(o)), this.tree = o, this.sel = l;
  }
  undo() {
    const n = this.undoStack.pop();
    return n ? (this.redoStack.push(n), this.tree = n.preTree, this.sel = n.preSel, this.emit(!0), !0) : !1;
  }
  redo() {
    const n = this.redoStack.pop();
    if (!n) return !1;
    const e = this.tree, o = this.sel;
    return this.thread(n.ops, n.after), this.undoStack.push({ preTree: e, preSel: o, ops: n.ops, after: n.after }), this.emit(!0), !0;
  }
  /** Streaming append (plan 018 待澄清 1 — 追加分流裁定): AI/stream blocks
   *  land at the document tail without touching the focused block or the
   *  selection; not an undoable user edit. */
  appendBlocks(n) {
    n.length !== 0 && (this.tree = wn(this.tree, [...this.tree.children, ...n]), this.emit(!1));
  }
  /** External document replacement (file load, full paste). Not undoable —
   *  callers that need undo wrap it in their own op. */
  replaceDoc(n, e) {
    var o;
    this.tree = n, this.sel = e ?? tt(((o = n.children[0]) == null ? void 0 : o.id) ?? "", 0), this.undoStack = [], this.redoStack = [], this.emit(!1);
  }
  emit(n) {
    for (const e of this.listeners) e({ tree: this.tree, selection: this.sel, history: n });
  }
}
function al(t) {
  if (!t.ctrlKey && !t.metaKey) return null;
  const n = t.key.toLowerCase();
  return n === "z" ? t.shiftKey ? "redo" : "undo" : n === "y" ? "redo" : null;
}
function il(t, n, e) {
  const o = e === "undo" ? t.undo() : t.redo();
  if (o) for (const l of n) l.syncFromModel();
  return o;
}
function At(t) {
  return t.nodeType === 3 ? { raw: t, isText: !0, text: t.textContent ?? "", children: [] } : { raw: t, isText: !1, text: "", children: Array.from(t.childNodes).map(At) };
}
function En(t) {
  const n = [];
  let e = 0;
  const o = (l) => {
    l.isText ? (n.push({ node: l, start: e, len: l.text.length }), e += l.text.length) : l.children.forEach(o);
  };
  return o(t), { leaves: n, total: e };
}
function Lt(t, n) {
  if (t.raw === n) return t;
  for (const e of t.children) {
    const o = Lt(e, n);
    if (o) return o;
  }
  return null;
}
function Jt(t, n, e) {
  const o = Lt(t, n);
  if (!o) return -1;
  const { leaves: l } = En(t);
  if (o.isText) {
    const c = l.find((f) => f.node.raw === n);
    return c ? c.start + Math.max(0, Math.min(e, c.len)) : -1;
  }
  const a = Math.max(0, e), i = l.find((c) => {
    let f = c.node, d;
    for (; f && f !== o; )
      d = f, f = An(t, f);
    return !f || !d ? !1 : o.children.indexOf(d) >= a;
  });
  if (i) return i.start;
  const s = l.filter((c) => rl(o, c.node.raw));
  if (s.length === 0) return -1;
  const u = s[s.length - 1];
  return u.start + u.len;
}
function An(t, n) {
  for (const e of t.children) {
    if (e === n) return t;
    const o = An(e, n);
    if (o) return o;
  }
}
function rl(t, n) {
  return !!Lt(t, n);
}
function Xt(t, n) {
  const { leaves: e, total: o } = En(t);
  if (e.length === 0) return null;
  const l = Math.max(0, Math.min(n, o));
  for (const i of e)
    if (l <= i.start + i.len) return { raw: i.node.raw, inner: l - i.start };
  const a = e[e.length - 1];
  return { raw: a.node.raw, inner: a.len };
}
function sl(t, n) {
  const e = typeof window > "u" ? null : window.getSelection();
  if (!e || e.rangeCount === 0) return null;
  const o = e.getRangeAt(0);
  if (o.collapsed || !t.contains(o.startContainer) || !t.contains(o.endContainer)) return null;
  const l = At(t), a = Jt(l, o.startContainer, o.startOffset), i = Jt(l, o.endContainer, o.endOffset);
  return a < 0 || i < 0 ? null : { blockId: n, lo: Math.min(a, i), hi: Math.max(a, i) };
}
function ul(t, n, e) {
  const o = At(t), a = t.ownerDocument.createRange(), i = Xt(o, Math.min(n, e)), s = Xt(o, Math.max(n, e));
  return !i || !s ? (a.selectNodeContents(t), a) : (a.setStart(i.raw, i.inner), a.setEnd(s.raw, s.inner), a);
}
let Te = null;
function Ot(t) {
  Te = t;
}
function Ln() {
  return Te;
}
const it = {
  strong: ["strong", "b"],
  em: ["em", "i"],
  del: ["del", "s"],
  u: ["u"],
  code: ["code"]
}, Fe = {
  [q.Strong]: "strong",
  [q.Em]: "em",
  [q.Del]: "del",
  [q.Underline]: "u",
  [q.Code]: "code"
};
function Ye(t) {
  const n = typeof window > "u" ? null : window.getSelection();
  if (!n || n.rangeCount === 0) return null;
  const e = n.getRangeAt(0);
  return e.collapsed || !t.contains(e.startContainer) || !t.contains(e.endContainer) ? null : e;
}
function de(t, n, e) {
  let o = n;
  for (; o && o !== t; ) {
    if (o.nodeType === 1) {
      const l = o;
      if (e.includes(l.tagName.toLowerCase())) return l;
    }
    o = o.parentNode;
  }
  return null;
}
function Zt(t, n, e) {
  const o = document.createRange();
  o.selectNodeContents(t);
  try {
    o.setEnd(n, e);
  } catch {
    return 0;
  }
  return o.toString().replace(/\u00A0/g, " ").length;
}
function en(t, n, e) {
  const o = de(t, n.startContainer, e);
  return o != null && o === de(t, n.endContainer, e) && o.contains(n.commonAncestorContainer);
}
function On(t) {
  const n = t.parentNode;
  if (n) {
    for (; t.firstChild; ) n.insertBefore(t.firstChild, t);
    n.removeChild(t), n.normalize();
  }
}
function tn(t, n, e) {
  try {
    t.surroundContents(n);
  } catch {
    const o = t.extractContents();
    n.appendChild(o), t.insertNode(n);
  }
}
const oe = {
  getSelection() {
    const t = Te;
    if (!t) return null;
    const n = Ye(t);
    return n ? {
      blockId: t.dataset.blockId ?? "",
      start: Zt(t, n.startContainer, n.startOffset),
      end: Zt(t, n.endContainer, n.endOffset)
    } : null;
  },
  isActive(t) {
    const n = Te;
    if (!n) return !1;
    const e = Ye(n);
    if (!e) return !1;
    if (t === q.Link) {
      const l = de(n, e.startContainer, ["a"]);
      return l != null && l === de(n, e.endContainer, ["a"]);
    }
    const o = Fe[t];
    return o == null ? !1 : en(n, e, it[o]);
  },
  applyMark(t, n) {
    const e = Te;
    if (!e) return !1;
    const o = Ye(e);
    if (!o) return !1;
    if (t === q.Link) {
      if (n == null || n === "") return oe.removeMark(q.Link);
      const i = de(e, o.startContainer, ["a"]);
      if (i && i === de(e, o.endContainer, ["a"]))
        return i.setAttribute("href", n), i.setAttribute("contenteditable", "false"), i.setAttribute("data-autodown-link", ""), !0;
      const s = e.ownerDocument.createElement("a");
      return s.setAttribute("href", n), s.setAttribute("contenteditable", "false"), s.setAttribute("data-autodown-link", ""), tn(o, s), !0;
    }
    const l = Fe[t];
    if (l == null) return !1;
    const a = e.ownerDocument.createElement(l);
    return tn(o, a), !0;
  },
  removeMark(t) {
    const n = Te;
    if (!n) return !1;
    const e = Ye(n);
    if (!e) return !1;
    if (t === q.Link) {
      const a = de(n, e.startContainer, ["a"]);
      if (a && a === de(n, e.endContainer, ["a"])) {
        const i = a.parentNode;
        if (i) {
          for (; a.firstChild; ) i.insertBefore(a.firstChild, a);
          i.removeChild(a);
        }
        return !0;
      }
      return !1;
    }
    const o = Fe[t];
    if (o == null) return !1;
    const l = it[o];
    return en(n, e, l) ? (On(de(n, e.startContainer, l)), !0) : !1;
  }
};
function Dn() {
  const t = Te, n = typeof window > "u" ? null : window.getSelection();
  if (!t || !n || n.rangeCount === 0) return [];
  const e = n.getRangeAt(0);
  if (!t.contains(e.startContainer)) return [];
  const o = [];
  for (const l of [q.Strong, q.Em, q.Underline, q.Del, q.Code]) {
    const a = Fe[l];
    a != null && de(t, e.startContainer, it[a] ?? [a]) && o.push(l);
  }
  return o;
}
function cl(t) {
  const n = Te, e = typeof window > "u" ? null : window.getSelection();
  if (!n || !e || e.rangeCount === 0) return !1;
  const o = e.getRangeAt(0);
  if (!n.contains(o.startContainer)) return !1;
  const l = Fe[t];
  if (l == null) return !1;
  const a = de(n, o.startContainer, it[l] ?? [l]);
  return a ? (On(a), !0) : !1;
}
function Be(t, n) {
  return t === oe && t.getSelection() == null ? cl(n) : t.isActive(n) ? t.removeMark(n) : t.applyMark(n);
}
const dl = {
  setParagraph: T.Paragraph,
  setMathBlock: T.MathBlock,
  setMermaidBlock: T.Mermaid,
  setHorizontalRule: T.ThematicBreak,
  toggleBulletList: T.ListItem,
  toggleOrderedList: T.ListItem,
  toggleBlockquote: T.Blockquote
}, fl = {
  bold: q.Strong,
  strong: q.Strong,
  italic: q.Em,
  em: q.Em,
  strike: q.Del,
  strikethrough: q.Del,
  underline: q.Underline,
  code: q.Code,
  link: q.Link
}, nn = {
  table: T.Table,
  codeBlock: T.Fence,
  fence: T.Fence,
  blockquote: T.Blockquote,
  bulletList: T.ListBlock,
  orderedList: T.ListBlock,
  listItem: T.ListItem,
  heading: T.Heading,
  details: T.Details,
  callout: T.Callout,
  mathBlock: T.MathBlock,
  mermaid: T.Mermaid,
  queryBlock: T.QueryBlock,
  blockEmbed: T.BlockEmbed
};
function Bt(t, n, e) {
  if (t.id === n)
    return e.add(t.kind), !0;
  for (const o of t.children)
    if (Bt(o, n, e))
      return e.add(t.kind), !0;
  return !1;
}
function on(t) {
  const n = {};
  for (const e of t) {
    const o = e.value;
    n[e.key] = o != null && (o._tag === "Str" || o._tag === "Int" || o._tag === "Bool") ? o.value : null;
  }
  return n;
}
function hl(t, n) {
  return t.anchor.blockId === n.anchor.blockId && t.anchor.offset === n.anchor.offset && t.head.blockId === n.head.blockId && t.head.offset === n.head.offset;
}
function vl(t) {
  const n = k(0), e = /* @__PURE__ */ new Map();
  let o = t.selection;
  const l = (i) => {
    const s = e.get(i);
    if (s)
      for (const u of [...s]) u();
  };
  return t.onChange((i) => {
    n.value++, hl(i.selection, o) || (o = i.selection, l("selectionUpdate"));
  }), {
    storage: { "slash-command": { query: "", range: null, handled: !1 } },
    isEditable: !0,
    on: (i, s) => {
      let u = e.get(i);
      u || (u = /* @__PURE__ */ new Set(), e.set(i, u)), u.add(s);
    },
    off: (i, s) => {
      var u;
      (u = e.get(i)) == null || u.delete(s);
    },
    isActive: (i) => {
      n.value;
      const s = fl[i];
      if (s != null) {
        const f = Dn();
        return f.length > 0 ? f.includes(s) : Zn(to(t, t.selection), s);
      }
      const u = nn[i];
      if (u == null) return !1;
      const c = /* @__PURE__ */ new Set();
      return Bt(t.doc, t.selection.anchor.blockId, c), c.has(u);
    },
    getAttributes: (i) => {
      n.value;
      const s = nn[i];
      if (s == null) return {};
      const u = J(t.doc, t.selection.anchor.blockId);
      if (u && u.kind === s) return on(u.attrs);
      if (u) {
        const c = /* @__PURE__ */ new Set();
        if (Bt(t.doc, u.id, c) && c.has(s)) {
          let f = u;
          for (; f; ) {
            if (f.kind === s) return on(f.attrs);
            f = nt(t.doc, f.id) ?? null;
          }
        }
      }
      return {};
    },
    view: {
      get dom() {
        return typeof document > "u" ? null : document.querySelector(".autodown-editor-content");
      },
      get state() {
        return {
          selection: {
            from: t.selection.anchor.offset,
            to: t.selection.head.offset
          }
        };
      },
      nodeDOM(i) {
        if (typeof document > "u") return null;
        const s = document.querySelector(".autodown-editor-content");
        if (!s) return null;
        const u = t.selection.anchor.blockId;
        for (const c of s.querySelectorAll("[data-block-id]"))
          if (c.dataset.blockId === u) return c;
        return null;
      },
      /** Caret viewport coords (plan 028 P3T1, 021-F5): the focused rich
       *  host's char offset → blockRangeToDomRange → first client rect
       *  (whole-host rect fallback). ProseMirror coordsAtPos shape — the
       *  generated floating menus (SlashMenu two-stage positioning) consume
       *  it to open at the caret instead of the default corner. */
      coordsAtPos(i) {
        if (typeof document > "u") return null;
        const s = t.selection.anchor.blockId, u = Ln() ?? document.querySelector(`.autodown-block-host[data-block-id="${s}"]`);
        if (!u) return null;
        const c = ul(u, i, i), f = c.getClientRects(), d = f.length > 0 ? f[0] : c.getBoundingClientRect();
        return { top: d.top, left: d.left, right: d.right, bottom: d.bottom };
      }
    },
    chain: () => ml(t),
    __engine: t,
    __bump: () => {
      n.value++;
    }
  };
}
function Me(t) {
  const n = t.selection.anchor.blockId, e = J(t.doc, n);
  if (!e) return null;
  if (e.kind === T.Table) return { tableId: n, rowId: null, rowIdx: null, colIdx: null };
  if (e.kind !== T.TableCell) return null;
  const o = nt(t.doc, n);
  if (!o || o.kind !== T.TableRow) return null;
  const l = nt(t.doc, o.id);
  return !l || l.kind !== T.Table ? null : { tableId: l.id, rowId: o.id, rowIdx: Wt(l, o.id), colIdx: Wt(o, n) };
}
function Ne(t, n) {
  var e;
  return ((e = J(t.doc, n)) == null ? void 0 : e.children) ?? [];
}
function ml(t) {
  const n = [], e = {
    focus: () => e,
    run: () => (t.applyTree((l) => n.reduce((a, i) => i(a), l)), !J(t.doc, t.selection.anchor.blockId) && t.doc.children[0] && t.select(tt(t.doc.children[0].id, 0)), !0),
    setHeading: (l) => (n.push((a) => He(a, t, T.Heading, [{ key: "level", value: Ie.Int((l == null ? void 0 : l.level) ?? 1) }])), e),
    insertContent: (l) => {
      const a = String(l ?? "");
      return n.push((i) => {
        if (!a.includes(`
`)) return yt(i, t, a);
        const u = yn(a, !0).children;
        if (u.length === 0) return i;
        const c = Ae(t), f = J(i, c);
        if (!f) return i;
        const d = i.children, B = d.findIndex((h) => h.id === c), D = me(f) === "" ? [] : [f], O = [...d.slice(0, B), ...D, ...u, ...d.slice(B + 1)];
        return wn(i, O);
      }), e;
    },
    deleteRange: (l) => (n.push((a) => {
      const i = Ae(t), s = J(a, i);
      if (!s) return a;
      const u = me(s), c = Math.max(0, Math.min(l.from, u.length)), f = Math.max(c, Math.min(l.to, u.length));
      return ye(a, i, [Ze(i, s.kind, u.slice(0, c) + u.slice(f))]);
    }), e),
    insertTable: (l) => (n.push((a) => yt(a, t, `| a | b |
| --- | --- |
|  |  |
|  |  |`)), e),
    setImage: (l) => {
      const a = String((l == null ? void 0 : l.src) ?? ""), i = String((l == null ? void 0 : l.alt) ?? "");
      return n.push((s) => yt(s, t, `![${i}](${a})`)), e;
    },
    // table verbs (plan 026 P0T3): forward to the commands.ts table transforms,
    // resolved against the focused cell (table-level focus takes the
    // table-ends defaults); tree-level so a chain stays ONE undo.
    addRowAfter: () => {
      var s;
      const l = Me(t);
      if (!l) return e;
      const a = Ne(t, l.tableId), i = l.rowId ?? ((s = a[a.length - 1]) == null ? void 0 : s.id) ?? null;
      return n.push((u) => Vt(u, l.tableId, i)), e;
    },
    addRowBefore: () => {
      const l = Me(t);
      if (!l) return e;
      const a = Ne(t, l.tableId), i = l.rowIdx != null && l.rowIdx > 0 ? a[l.rowIdx - 1].id : null;
      return n.push((s) => Vt(s, l.tableId, i)), e;
    },
    deleteRow: () => {
      const l = Me(t);
      if (!l) return e;
      const a = Ne(t, l.tableId);
      if (a.length <= 1) return e;
      const i = l.rowId ?? a[a.length - 1].id;
      return n.push((s) => ye(s, i, [])), e;
    },
    addColumnBefore: () => {
      const l = Me(t);
      return l && n.push((a) => St(a, l.tableId, l.colIdx ?? 0)), e;
    },
    addColumnAfter: () => {
      var i;
      const l = Me(t);
      if (!l) return e;
      const a = ((i = Ne(t, l.tableId)[0]) == null ? void 0 : i.children.length) ?? 0;
      return n.push((s) => St(s, l.tableId, l.colIdx != null ? l.colIdx + 1 : a)), e;
    },
    deleteColumn: () => {
      var s;
      const l = Me(t);
      if (!l) return e;
      const a = Ne(t, l.tableId), i = Math.max(0, (((s = a[0]) == null ? void 0 : s.children.length) ?? 1) - 1);
      return n.push((u) => no(u, l.tableId, l.colIdx ?? i)), e;
    },
    deleteTable: () => {
      const l = Me(t);
      return l && n.push((a) => ye(a, l.tableId, [])), e;
    },
    // code language channel (plan 026 P0T3): setBlockAttrs on the focused
    // Fence (023's IAL ruling); converts the kind when not a Fence yet.
    setCodeBlockLanguage: (l) => (n.push((a) => He(a, t, T.Fence, [{ key: "language", value: Ie.Str(String(l ?? "")) }])), e),
    setCodeBlock: (l) => (l == null ? void 0 : l.language) != null ? e.setCodeBlockLanguage(l.language) : (n.push((a) => He(a, t, T.Fence)), e),
    // slash manifest's Details template carries { summary } (plan 026 P2T3):
    // kind conversion + summary attr so the mounted node-view shows it.
    // Converting an inline leaf moves its text into a child paragraph — a
    // Details renders children, inlines would serialize away (data loss).
    setDetails: (l) => (n.push((a) => {
      const i = Ae(t), s = J(a, i);
      if (!s) return a;
      const u = s.children.length > 0 ? s.children : me(s).length > 0 ? [Ze(`${i}-p`, T.Paragraph, me(s))] : [];
      let c = { ...s, kind: T.Details, children: u };
      return (l == null ? void 0 : l.summary) != null && (c = { ...c, attrs: Pe(c.attrs, "summary", Ie.Str(String(l.summary))) }), ye(a, i, [c]);
    }), e),
    // slash Callout template carries { type, title } (plan 030 T7): same
    // conversion shape as setDetails — before this the kind-only KIND_COMMANDS
    // path silently dropped both attrs (the lost-title roundtrip break).
    setCallout: (l) => (n.push((a) => {
      const i = Ae(t), s = J(a, i);
      if (!s) return a;
      const u = s.children.length > 0 ? s.children : me(s).length > 0 ? [Ze(`${i}-p`, T.Paragraph, me(s))] : [];
      let c = { ...s, kind: T.Callout, children: u };
      return (l == null ? void 0 : l.type) != null && (c = { ...c, attrs: Pe(c.attrs, "type", Ie.Str(String(l.type))) }), (l == null ? void 0 : l.title) != null && (c = { ...c, attrs: Pe(c.attrs, "title", Ie.Str(String(l.title))) }), ye(a, i, [c]);
    }), e),
    // task list (plan 030 T7): a real verb distinct from toggleBulletList —
    // the focused ListItem (a caret usually sits on its child paragraph, so
    // resolve the ListItem ancestor first — the list-commands 选中定位
    // discipline) gains/loses the `checked` attr (task ⇄ plain bullet);
    // outside a list it converts like the bullet verb.
    toggleTaskList: () => (n.push((l) => {
      const a = Ae(t);
      let i = J(l, a);
      for (; i != null && i.kind !== T.ListItem; )
        i = nt(l, i.id);
      if (i == null) return He(l, t, T.ListItem);
      const u = Rt(i.attrs, "checked") != null ? i.attrs.filter((c) => c.key !== "checked") : Pe(i.attrs, "checked", Ie.Bool(!1));
      return ye(l, i.id, [{ ...i, attrs: u }]);
    }), e),
    // inline mark toggles (plan 024 P3T1; adapter-routed plan 036 T3): wrap
    // the FOCUSED host's live DOM through the SelectionAdapter — the model
    // catches up on the blur writeback. No focused host → no-op.
    toggleBold: () => (Be(oe, q.Strong), e),
    toggleItalic: () => (Be(oe, q.Em), e),
    toggleStrike: () => (Be(oe, q.Del), e),
    toggleCode: () => (Be(oe, q.Code), e),
    // underline (plan 028 P2T2): same DOM-wrap protocol as the others —
    // the model catches up on the blur writeback (u → Mark.Underline)
    toggleUnderline: () => (Be(oe, q.Underline), e),
    setLink: (l) => {
      const a = String((l == null ? void 0 : l.href) ?? "");
      return a ? oe.applyMark(q.Link, a) : oe.removeMark(q.Link), e;
    },
    unsetLink: () => (oe.removeMark(q.Link), e)
  }, o = e;
  for (const [l, a] of Object.entries(dl))
    o[l] = () => (n.push((i) => He(i, t, a)), e);
  return e;
}
function Ae(t) {
  var n;
  return t.selection.anchor.blockId || ((n = t.doc.children[0]) == null ? void 0 : n.id) || "";
}
function He(t, n, e, o) {
  const l = Ae(n), a = J(t, l);
  if (!a) return t;
  let i = { ...a, kind: e };
  if (o)
    for (const s of o) i = { ...i, attrs: Pe(i.attrs, s.key, s.value) };
  return ye(t, l, [i]);
}
function yt(t, n, e) {
  const o = Ae(n), l = J(t, o);
  if (!l) return t;
  const a = me(l) + e;
  return ye(t, o, [Ze(o, l.kind, a)]);
}
function pl(t, n) {
  const o = t.slice(0, n).match(/(?:^|\s)\/([^\s/]*)$/);
  return o ? o[1] : null;
}
function gl(t, n, e) {
  if (t == null) {
    document.dispatchEvent(new CustomEvent("autodown:slash-close", { detail: {} }));
    return;
  }
  const o = {
    query: t,
    range: { from: e - t.length - 1, to: e },
    items: [],
    blockId: n
  };
  document.dispatchEvent(new CustomEvent("autodown:slash-open", { detail: o }));
}
function kl(t, n) {
  return $n(t, n).tag;
}
function bl(t, n) {
  const e = $n(t, n);
  return e.cls ? `autodown-block-host ${e.cls}` : "autodown-block-host";
}
function $n(t, n) {
  if (t === "Heading") {
    const e = Math.min(6, Math.max(1, n ?? 1));
    return { tag: `h${e}`, cls: `heading-node heading-${e}` };
  }
  return t === "Paragraph" ? { tag: "p", cls: "paragraph-node" } : { tag: "div", cls: "" };
}
const rt = /* @__PURE__ */ new WeakSet();
function wl(t, n) {
  var a;
  const e = Qn(), o = ((a = e == null ? void 0 : e.proxy) == null ? void 0 : a.$el) ?? null;
  if (!o) return;
  rt.add(o), o.innerHTML = t, o.focus();
  const l = n ? oo(n) : null;
  (!l || !lo(o, l)) && Dt(o), Ee(() => {
    rt.delete(o), Ln() === o && Ot(null);
  });
}
function Dt(t) {
  const n = document.createRange();
  n.selectNodeContents(t), n.collapse(!1);
  const e = window.getSelection();
  e == null || e.removeAllRanges(), e == null || e.addRange(n);
}
function yl(t, n) {
  const e = t.ownerDocument.createTreeWalker(t, NodeFilter.SHOW_TEXT);
  let o = Math.max(0, n), l = null, a = !1;
  for (; l = e.nextNode(); ) {
    const i = l.data.length;
    if (o <= i) {
      const s = document.createRange();
      if (o === i) {
        const c = l.parentElement;
        if (c && c !== t) {
          const f = t.ownerDocument.createTextNode(_l);
          c.after(f), s.setStart(f, 1), s.collapse(!0);
          const d = window.getSelection();
          d == null || d.removeAllRanges(), d == null || d.addRange(s), a = !0;
          break;
        }
      }
      s.setStart(l, o), s.collapse(!0);
      const u = window.getSelection();
      u == null || u.removeAllRanges(), u == null || u.addRange(s), a = !0;
      break;
    }
    o -= i;
  }
  a || Dt(t);
}
const _l = "​";
function st(t) {
  return (t.textContent ?? "").replace(/\u00A0/g, " ").replace(/\u200B/g, "");
}
function Ue(t) {
  const n = window.getSelection();
  if (!n || n.rangeCount === 0) return 0;
  const e = n.getRangeAt(0).cloneRange();
  return e.selectNodeContents(t), e.setEnd(n.getRangeAt(0).endContainer, n.getRangeAt(0).endOffset), e.toString().length;
}
function ln(t) {
  const n = t.getClientRects(), e = [];
  for (let o = 0; o < n.length; o++)
    n[o].height > 0 && e.push(n[o].top);
  return e;
}
function qn(t) {
  const n = window.getSelection();
  if (!n || n.rangeCount === 0) return { preTops: [], postTops: [] };
  const e = n.getRangeAt(0);
  if (!e.collapsed) return { preTops: [], postTops: [] };
  const o = document.createRange();
  o.selectNodeContents(t), o.setEnd(e.startContainer, e.startOffset);
  const l = document.createRange();
  return l.selectNodeContents(t), l.setStart(e.startContainer, e.startOffset), { preTops: ln(o), postTops: ln(l) };
}
function Cl(t) {
  const { preTops: n, postTops: e } = qn(t), o = e.length > 0 ? e[0] : n[n.length - 1];
  return o == null ? !0 : !n.some((l) => l < o - 1);
}
function Sl(t) {
  const { preTops: n, postTops: e } = qn(t), o = n.length > 0 ? n[n.length - 1] : e[0];
  return o == null ? !0 : !e.some((l) => l > o + 1);
}
function Il(t) {
  setTimeout(() => {
    const n = document.querySelector(`.autodown-block-host[data-block-id="${t}"]`);
    if (!n) return;
    const e = document.createRange();
    e.selectNodeContents(n), e.collapse(!0);
    const o = window.getSelection();
    o == null || o.removeAllRanges(), o == null || o.addRange(e);
  }, 0);
}
function Bl(t, n) {
  const e = st(t);
  if (n.onInput(e), !n.composition.composing && st(t) !== n.text) {
    t.innerHTML = Cn(n.inlines);
    const o = n.desiredCaretOffset();
    o == null ? Dt(t) : yl(t, o);
  }
  typeof document < "u" && gl(pl(n.text, Ue(t)), n.id, Ue(t));
}
function Tl(t, n) {
  if (n.composition.composing) return;
  const e = t.currentTarget ?? t.target;
  if (t.ctrlKey || t.metaKey) {
    const o = t.key.toLowerCase();
    if (o === "b") {
      t.preventDefault(), Be(oe, q.Strong);
      return;
    }
    if (o === "i") {
      t.preventDefault(), Be(oe, q.Em);
      return;
    }
    if (o === "u") {
      t.preventDefault(), Be(oe, q.Underline);
      return;
    }
    if (o === "k") {
      t.preventDefault();
      const l = window.prompt("Enter URL");
      l && oe.applyMark(q.Link, l);
      return;
    }
  }
  if (t.key === "Enter")
    t.preventDefault(), n.onEnter(Ue(e), `b-${Math.random().toString(36).slice(2, 8)}`);
  else if (t.key === "Backspace" && Ue(e) === 0)
    n.onBackspaceAtStart(n.prevSiblingId()) && t.preventDefault();
  else if (t.key === "ArrowUp" && Cl(e))
    n.navigateUp() && t.preventDefault();
  else if (t.key === "ArrowDown" && Sl(e)) {
    const o = n.navigateDown();
    o && (t.preventDefault(), Il(o));
  } else t.key === "Tab" && n.onTab(t.shiftKey) && t.preventDefault();
}
function xl(t, n) {
  var l;
  const e = ((l = t.clipboardData) == null ? void 0 : l.getData("text/plain")) ?? "";
  if (!e) return;
  t.preventDefault();
  const o = e.trim();
  if (!o.includes(`
`) && !/^[#>*`\-\d]/.test(o)) {
    n.onInput(n.text + o);
    return;
  }
  n.onPasteMarkdown(o);
}
function Rl(t, n) {
  n.compositionBegin(n.text, Ue(t));
}
function Ml(t, n) {
  n.compositionUpdate(t.data ?? "");
}
function El(t, n) {
  n.compositionCommit(st(t));
}
function Al(t, n) {
  rt.has(t) && Ot(t);
}
function Ll(t, n) {
  if (Ot(null), !rt.has(t)) return;
  const e = st(t);
  e !== n.text && n.onInput(e), n.onRichBlur(t);
}
const Ol = /* @__PURE__ */ te({
  __name: "RichTextHost",
  props: {
    controller: {},
    blockId: {},
    blockKind: {},
    level: {},
    initial_html: {}
  },
  emits: ["Init", "ClickStop", "Input", "Keydown", "Paste", "Focus", "Blur", "CompositionStart", "CompositionUpdate", "CompositionEnd"],
  setup(t, { emit: n }) {
    const e = t, o = m(() => kl(e.blockKind, e.level)), l = m(() => bl(e.blockKind, e.level)), a = n;
    function i(h) {
      Ll(h.target, e.controller), a("Blur", h);
    }
    function s(h) {
      a("ClickStop", h);
    }
    function u(h) {
      El(h.target, e.controller), a("CompositionEnd", h);
    }
    function c(h) {
      Rl(h.target, e.controller), a("CompositionStart", h);
    }
    function f(h) {
      Ml(h, e.controller), a("CompositionUpdate", h);
    }
    function d(h) {
      Al(h.target, e.controller), a("Focus", h);
    }
    function B(h) {
      Bl(h.target, e.controller), a("Input", h);
    }
    function D(h) {
      Tl(h, e.controller), a("Keydown", h);
    }
    function O(h) {
      xl(h, e.controller), a("Paste", h);
    }
    return fe(() => {
      wl(e.initial_html, e.blockId);
    }), (h, g) => (p(), ee(pe(o.value), {
      class: xe(l.value),
      contenteditable: !0,
      "data-block-id": t.blockId,
      "data-node-type": t.blockKind,
      dir: "auto",
      spellcheck: "false",
      onBlur: g[0] || (g[0] = (L) => i(L)),
      onClick: g[1] || (g[1] = De((L) => s(L), ["stop"])),
      onCompositionend: g[2] || (g[2] = (L) => u(L)),
      onCompositionstart: g[3] || (g[3] = (L) => c(L)),
      onCompositionupdate: g[4] || (g[4] = (L) => f(L)),
      onFocus: g[5] || (g[5] = (L) => d(L)),
      onInput: g[6] || (g[6] = (L) => B(L)),
      onKeydown: g[7] || (g[7] = (L) => D(L)),
      onPaste: g[8] || (g[8] = (L) => O(L))
    }, null, 40, ["class", "data-block-id", "data-node-type"]));
  }
});
function Dl(t) {
  return t.startsWith("bottom") ? { vertical: "bottom", horizontal: t.endsWith("end") ? "right" : "left" } : { vertical: "top", horizontal: t.endsWith("end") ? "right" : "left" };
}
function _e(t, n, e, o, l = "bottom", a = 8, i = "left") {
  const { vertical: s, horizontal: u } = Dl(l);
  let c;
  if (s === "bottom") {
    if (c = t.bottom + a, c + e > o.height) {
      const d = t.top - e - a;
      d >= 0 ? c = d : c = Math.max(0, o.height - e);
    }
  } else if (c = t.top - e - a, c < 0) {
    const d = t.bottom + a;
    d + e <= o.height ? c = d : c = 0;
  }
  let f = u === "right" || i === "right" ? t.right - n : t.left;
  return f + n > o.width && (f = Math.max(0, o.width - n)), f < 0 && (f = 0), { top: c, left: f };
}
const $l = {
  bold: Ao,
  italic: Eo,
  underline: Mo,
  strike: Ro,
  code: Mn,
  link: Rn
};
function Oe(t) {
  return $l[t];
}
function ql({
  editor: t,
  state: n
}) {
  if (!t.isEditable || t.isActive("image"))
    return !1;
  const { empty: e } = n.selection;
  return e ? Array.isArray(n.marks) && n.marks.length > 0 : !0;
}
function Nl(t, n) {
  var e, o, l, a;
  if (t.isActive("link"))
    (o = (e = t.chain().focus()).unsetLink) == null || o.call(e).run();
  else {
    const i = window.prompt(n ?? "Enter URL");
    i && ((a = (l = t.chain().focus()).setLink) == null || a.call(l, { href: i }).run());
  }
}
function Hl(t) {
  const n = t.selection;
  return { selection: { empty: n.anchor.blockId === n.head.blockId && n.anchor.offset === n.head.offset } };
}
const Pl = te({
  name: "EngineBubbleMenu",
  props: {
    editor: { type: Object, default: null },
    options: { type: Object, default: null },
    shouldShow: { type: Function, default: null }
  },
  setup(t, { slots: n }) {
    const e = k(!1), o = k("0px"), l = k("0px"), a = k(null);
    let i = null;
    const s = () => {
      var K, X, _, S, C, w;
      const d = (K = t.editor) == null ? void 0 : K.__engine;
      if (!d) {
        e.value = !1;
        return;
      }
      (_ = (X = t.editor) == null ? void 0 : X.__bump) == null || _.call(X);
      const B = typeof window > "u" ? null : window.getSelection(), D = B && B.rangeCount > 0 ? B.getRangeAt(0) : null;
      if (!D) {
        e.value = !1;
        return;
      }
      let O;
      D.collapsed && (O = Dn());
      const h = { editor: t.editor, state: { ...Hl(d), marks: O } };
      if (e.value = t.shouldShow ? !!t.shouldShow(h) : !1, !e.value) return;
      const g = (S = D.startContainer.nodeType === 3 ? D.startContainer.parentElement : D.startContainer) == null ? void 0 : S.closest(".autodown-block-host"), L = g == null ? void 0 : g.closest(".autodown-editor");
      if (!g || !L || !L.contains(g)) {
        e.value = !1;
        return;
      }
      const V = D.getBoundingClientRect(), A = L.getBoundingClientRect(), ne = {
        top: V.top - A.top,
        left: V.left - A.left,
        bottom: V.bottom - A.top,
        right: V.right - A.left,
        width: V.width,
        height: V.height
      }, ae = _e(
        ne,
        ((C = a.value) == null ? void 0 : C.offsetWidth) ?? 0,
        ((w = a.value) == null ? void 0 : w.offsetHeight) ?? 0,
        { width: L.clientWidth, height: L.clientHeight },
        "top"
      );
      l.value = `${ae.left}px`, o.value = `${ae.top}px`;
    }, u = (d) => {
      var B, D;
      e.value && !((D = (B = d.target) == null ? void 0 : B.closest) != null && D.call(B, ".autodown-bubble-menu")) && (e.value = !1);
    }, c = (d) => {
      d.key === "Escape" && e.value && (e.value = !1);
    }, f = () => s();
    return fe(() => {
      var B;
      const d = (B = t.editor) == null ? void 0 : B.__engine;
      d && (d.onChange(f), i = () => {
      }), document.addEventListener("pointerdown", u), document.addEventListener("keydown", c), document.addEventListener("selectionchange", f), s();
    }), Ee(() => {
      i == null || i(), document.removeEventListener("pointerdown", u), document.removeEventListener("keydown", c), document.removeEventListener("selectionchange", f);
    }), () => {
      var d;
      return e.value ? se(
        "div",
        {
          ref: a,
          class: "autodown-bubble-menu",
          style: { position: "absolute", top: o.value, left: l.value },
          // plan 024 P3T2: preventDefault keeps the contenteditable
          // host focused (and its selection alive) through button
          // clicks — the mark chains wrap the live host DOM.
          onMousedown: (B) => B.preventDefault()
        },
        (d = n.default) == null ? void 0 : d.call(n)
      ) : null;
    };
  }
}), Fl = ["title", "onClick"], Ul = /* @__PURE__ */ te({
  __name: "BubbleMenu",
  props: {
    editor: {},
    linkPrompt: { default: "Enter URL" },
    tooltips: { default: null }
  },
  emits: ["RunButton"],
  setup(t, { emit: n }) {
    const e = t, o = m(() => [{ name: "bold", title: e.tooltips && e.tooltips.bold || "Bold", icon: Oe("bold"), active: e.editor.isActive("bold"), action: () => e.editor.chain().focus().toggleBold().run() }, { name: "italic", title: e.tooltips && e.tooltips.italic || "Italic", icon: Oe("italic"), active: e.editor.isActive("italic"), action: () => e.editor.chain().focus().toggleItalic().run() }, { name: "underline", title: e.tooltips && e.tooltips.underline || "Underline", icon: Oe("underline"), active: e.editor.isActive("underline"), action: () => e.editor.chain().focus().toggleUnderline().run() }, { name: "strike", title: e.tooltips && e.tooltips.strike || "Strikethrough", icon: Oe("strike"), active: e.editor.isActive("strike"), action: () => e.editor.chain().focus().toggleStrike().run() }, { name: "code", title: e.tooltips && e.tooltips.code || "Inline Code", icon: Oe("code"), active: e.editor.isActive("code"), action: () => e.editor.chain().focus().toggleCode().run() }, { name: "link", title: e.tooltips && e.tooltips.link || "Link", icon: Oe("link"), active: e.editor.isActive("link"), action: () => Nl(e.editor, e.linkPrompt) }]), l = n;
    function a(i) {
      i.action(), l("RunButton", i);
    }
    return (i, s) => t.editor ? (p(), ee(ue(Pl), {
      class: xe("autodown-bubble-menu"),
      editor: t.editor,
      options: { placement: "top" },
      shouldShow: ue(ql),
      key: "TiptapBubbleMenu-1"
    }, {
      default: Xe(() => [
        (p(!0), x(Ce, null, Ke(o.value, (u) => (p(), x("button", {
          class: xe(["autodown-bubble-btn", { active: u.active }]),
          key: u.title,
          title: u.title,
          onClick: (c) => a(u)
        }, [
          (p(), ee(pe(u.icon), { size: 14 }))
        ], 10, Fl))), 128))
      ]),
      _: 1
    }, 8, ["editor", "shouldShow"])) : $("", !0);
  }
});
function Kl() {
  return Lo;
}
const Wl = [
  { id: "text", label: "Text", aliases: [] },
  { id: "bash", label: "Bash", aliases: ["sh", "shell", "zsh"] },
  { id: "c", label: "C", aliases: [] },
  { id: "cpp", label: "C++", aliases: ["c++", "cxx"] },
  { id: "csharp", label: "C#", aliases: ["c#", "cs"] },
  { id: "css", label: "CSS", aliases: [] },
  { id: "dockerfile", label: "Dockerfile", aliases: ["docker"] },
  { id: "go", label: "Go", aliases: ["golang"] },
  { id: "html", label: "HTML", aliases: [] },
  { id: "java", label: "Java", aliases: [] },
  { id: "javascript", label: "JavaScript", aliases: ["js"] },
  { id: "json", label: "JSON", aliases: [] },
  { id: "kotlin", label: "Kotlin", aliases: ["kt"] },
  { id: "lua", label: "Lua", aliases: [] },
  { id: "markdown", label: "Markdown", aliases: ["md"] },
  { id: "php", label: "PHP", aliases: [] },
  { id: "python", label: "Python", aliases: ["py"] },
  { id: "r", label: "R", aliases: [] },
  { id: "ruby", label: "Ruby", aliases: ["rb"] },
  { id: "rust", label: "Rust", aliases: ["rs"] },
  { id: "scss", label: "SCSS", aliases: ["sass"] },
  { id: "sql", label: "SQL", aliases: [] },
  { id: "swift", label: "Swift", aliases: [] },
  { id: "toml", label: "TOML", aliases: [] },
  { id: "typescript", label: "TypeScript", aliases: ["ts", "tsx"] },
  { id: "xml", label: "XML", aliases: [] },
  { id: "yaml", label: "YAML", aliases: ["yml"] }
];
function an() {
  return Wl;
}
const Vl = { class: "autodown-codeblock-menu-header" }, Ql = ["onKeydown"], zl = ["onClick", "onMouseenter"], Gl = { class: "autodown-codeblock-menu-item-label" }, jl = {
  key: 0,
  class: "autodown-codeblock-menu-empty"
}, Yl = /* @__PURE__ */ te({
  __name: "CodeBlockMenu",
  props: {
    editor: {}
  },
  emits: ["Init", "Destroy", "SearchInput", "MoveDown", "MoveUp", "SelectHighlighted", "SelectItem", "HoverItem", "Close", "OutsideClick"],
  setup(t, { emit: n }) {
    const e = t, o = k(!1), l = k(""), a = k(0), i = k(""), s = k(""), u = k(""), c = k(""), f = k(null), d = k(null), B = k(null), D = k(null), O = k(0), h = k(null), g = k(null), L = k(null), V = k(null), A = k(null), ne = k(null), ae = k(null), K = m(() => an().filter((M) => [M.id, M.label].concat(M.aliases).join(" ").toLowerCase().includes(l.value.toLowerCase().trim()))), X = m(() => K.value.length === 0), _ = m(() => Kl()), S = n;
    function C() {
      o.value = !1, l.value = "", a.value = 0, f.value = null, S("Close");
    }
    function w(M) {
      a.value = M, S("HoverItem", M);
    }
    function R() {
      a.value < K.value.length - 1 && (a.value = a.value + 1, le(() => {
        let M = null;
        if (d.value != null && (M = d.value.querySelector(".autodown-codeblock-menu")), M != null) {
          let U = M.querySelector(".autodown-codeblock-menu-list"), Q = M.querySelector(".autodown-codeblock-menu-item.active");
          if (U != null && Q != null) {
            let Z = U.getBoundingClientRect(), ce = Q.getBoundingClientRect(), be = ce.top - Z.top - Z.height / 2 + ce.height / 2;
            U.scrollTop = U.scrollTop + be;
          }
        }
      })), S("MoveDown");
    }
    function j() {
      a.value > 0 && (a.value = a.value - 1, le(() => {
        let M = null;
        if (d.value != null && (M = d.value.querySelector(".autodown-codeblock-menu")), M != null) {
          let U = M.querySelector(".autodown-codeblock-menu-list"), Q = M.querySelector(".autodown-codeblock-menu-item.active");
          if (U != null && Q != null) {
            let Z = U.getBoundingClientRect(), ce = Q.getBoundingClientRect(), be = ce.top - Z.top - Z.height / 2 + ce.height / 2;
            U.scrollTop = U.scrollTop + be;
          }
        }
      })), S("MoveUp");
    }
    function ge(M) {
      if (o.value) {
        let U = null;
        d.value != null && (U = d.value.querySelector(".autodown-codeblock-menu")), U != null && (U.contains(M.target) || (o.value = !1, l.value = "", a.value = 0, f.value = null));
      }
      S("OutsideClick", M);
    }
    function he(M) {
      l.value = M.target.value, S("SearchInput", M);
    }
    function ie() {
      if (K.value.length == 1) {
        let M = K.value[0];
        e.editor.chain().focus().setCodeBlock({ language: M.id }).run(), o.value = !1, l.value = "", a.value = 0, f.value = null;
      }
      if (K.value.length != 1) {
        let M = K.value[a.value];
        M != null && (e.editor.chain().focus().setCodeBlock({ language: M.id }).run(), o.value = !1, l.value = "", a.value = 0, f.value = null);
      }
      S("SelectHighlighted");
    }
    function ke(M) {
      e.editor.chain().focus().setCodeBlock({ language: M.id }).run(), o.value = !1, l.value = "", a.value = 0, f.value = null, S("SelectItem", M);
    }
    fe(async () => {
      var be, qe;
      await le();
      const M = ((qe = (be = e.editor) == null ? void 0 : be.view) == null ? void 0 : qe.dom) ?? null;
      if (M == null) return;
      B.value = M, d.value = M.closest(".autodown-editor"), D.value = M.closest(".autodown-editor-content-wrapper");
      let U = () => {
        O.value != 0 && cancelAnimationFrame(O.value), O.value = requestAnimationFrame(() => {
          if (O.value = 0, o.value && d.value != null) {
            let N = d.value.getBoundingClientRect(), H = f.value;
            if (H == null) {
              let P = e.editor.view, r = P.nodeDOM(P.state.selection.from);
              r != null && r.closest != null && (H = r.closest("pre[data-language]"), H == null && (H = r.closest(".autodown-codeblock-node")));
            }
            if (H == null && (o.value = !1, l.value = "", a.value = 0, f.value = null), H != null) {
              let P = H.querySelector("[data-codeblock-language-badge]"), r = H;
              P != null && (r = P);
              let v = r.getBoundingClientRect(), I = { top: v.top - N.top + 6, left: v.left - N.left, bottom: v.bottom - N.top + 6, right: v.right - N.left, width: v.width, height: v.height }, y = { width: N.width, height: N.height }, E = _e(I, 0, 0, y, "bottom-end", 0);
              s.value = E.top + "px", u.value = E.left + "px", c.value = "hidden", le(() => {
                let F = d.value.querySelector(".autodown-codeblock-menu");
                if (F != null) {
                  let z = F.getBoundingClientRect(), Y = _e(I, z.width, z.height, y, "bottom-end", 0);
                  s.value = Y.top + "px", u.value = Y.left + "px", c.value = "visible";
                }
              });
            }
          }
        });
      };
      V.value = U;
      let Q = (N) => {
        if (o.value) {
          let H = null;
          if (d.value != null && (H = d.value.querySelector(".autodown-codeblock-menu")), H != null && H.contains(N.target)) {
            N.preventDefault(), N.stopPropagation();
            let P = H.querySelector(".autodown-codeblock-menu-list");
            if (P != null) {
              let r = P.scrollTop + P.clientHeight < P.scrollHeight, v = P.scrollTop > 0;
              N.deltaY > 0 && r && (P.scrollTop = P.scrollTop + N.deltaY), N.deltaY < 0 && v && (P.scrollTop = P.scrollTop + N.deltaY);
            }
          }
          H == null && (N.preventDefault(), N.stopPropagation()), H != null && !H.contains(N.target) && (N.preventDefault(), N.stopPropagation());
        }
      };
      h.value = Q, document.addEventListener("wheel", h.value, { passive: !1, capture: !0 });
      let Z = (N) => {
        let H = N.target, P = null, r = null, v = null, I = null;
        H.closest != null && (P = H.closest("[data-codeblock-language-badge]"), r = H.closest("[data-codeblock-copy-btn]"), v = H.closest("[data-codeblock-expand-btn]"), I = H.closest("[data-codeblock-more-btn]")), (P != null || r != null || v != null || I != null) && (N.preventDefault(), N.stopPropagation());
      };
      g.value = Z, M.addEventListener("mousedown", g.value, { capture: !0 });
      let ce = (N) => {
        let H = N.target, P = null, r = null, v = null, I = null;
        if (H.closest != null && (P = H.closest("[data-codeblock-copy-btn]"), r = H.closest("[data-codeblock-expand-btn]"), v = H.closest("[data-codeblock-language-badge]"), I = H.closest("[data-codeblock-more-btn]")), P != null) {
          N.preventDefault(), N.stopPropagation();
          let y = P.closest("pre");
          if (y == null) {
            let F = P.closest(".code-block-container");
            F != null && (y = F.querySelector("pre[data-language]"));
          }
          let E = "";
          if (y != null) {
            let F = y.querySelector("code");
            F != null && (E = F.textContent ?? "");
          }
          navigator.clipboard.writeText(E);
        }
        if (P == null && r != null) {
          N.preventDefault(), N.stopPropagation();
          let y = r.closest("pre");
          if (y == null) {
            let E = r.closest(".code-block-container");
            E != null && (y = E.querySelector("pre[data-language]"));
          }
          y != null && y.classList.toggle("is-collapsed");
        }
        if (P == null && r == null) {
          let y = v;
          if (y == null && (y = I), y != null) {
            let E = y.closest("pre");
            E == null && (E = y.closest(".autodown-codeblock-node"));
            let F = !1;
            if (E == null && (E = y.closest(".code-block-container"), E != null && (F = !0)), N.preventDefault(), F == !1 && N.stopPropagation(), E == null && (E = y.closest(".code-block-container")), E == null) {
              let Y = e.editor.view, G = Y.nodeDOM(Y.state.selection.from);
              G != null && G.closest != null && (E = G.closest("pre[data-language]"), E == null && (E = G.closest(".autodown-codeblock-node")));
            }
            if (f.value = E, i.value = "", f.value != null && (i.value = f.value.getAttribute("data-language") ?? "", i.value == "")) {
              let Y = f.value.querySelector("pre[data-language]");
              Y != null && (i.value = Y.getAttribute("data-language") ?? "");
            }
            i.value == "" && (i.value = e.editor.getAttributes("codeBlock").language ?? ""), o.value = !0, l.value = "";
            let z = an().findIndex((Y) => Y.id == i.value);
            a.value = z, z < 0 && (a.value = 0), le(() => {
              let Y = null;
              if (d.value != null && (Y = d.value.querySelector(".autodown-codeblock-menu")), Y != null) {
                let G = Y.querySelector(".autodown-codeblock-menu-search");
                G != null && G.focus();
              }
              if (d.value != null) {
                let G = d.value.getBoundingClientRect(), re = f.value;
                if (re == null) {
                  let Se = e.editor.view, ve = Se.nodeDOM(Se.state.selection.from);
                  ve != null && ve.closest != null && (re = ve.closest("pre[data-language]"), re == null && (re = ve.closest(".autodown-codeblock-node")));
                }
                if (re == null && (o.value = !1, l.value = "", a.value = 0, f.value = null), re != null) {
                  let Se = re.querySelector("[data-codeblock-language-badge]"), ve = re;
                  Se != null && (ve = Se);
                  let we = ve.getBoundingClientRect(), Qe = { top: we.top - G.top + 6, left: we.left - G.left, bottom: we.bottom - G.top + 6, right: we.right - G.left, width: we.width, height: we.height }, Nt = { width: G.width, height: G.height }, Ht = _e(Qe, 0, 0, Nt, "bottom-end", 0);
                  s.value = Ht.top + "px", u.value = Ht.left + "px", c.value = "hidden", le(() => {
                    let Pt = d.value.querySelector(".autodown-codeblock-menu");
                    if (Pt != null) {
                      let Ft = Pt.getBoundingClientRect(), Ut = _e(Qe, Ft.width, Ft.height, Nt, "bottom-end", 0);
                      s.value = Ut.top + "px", u.value = Ut.left + "px", c.value = "visible";
                    }
                  });
                }
              }
              le(() => {
                let G = null;
                if (d.value != null && (G = d.value.querySelector(".autodown-codeblock-menu")), G != null) {
                  let re = G.querySelector(".autodown-codeblock-menu-list"), Se = G.querySelector(".autodown-codeblock-menu-item.active");
                  if (re != null && Se != null) {
                    let ve = re.getBoundingClientRect(), we = Se.getBoundingClientRect(), Qe = we.top - ve.top - ve.height / 2 + we.height / 2;
                    re.scrollTop = re.scrollTop + Qe;
                  }
                }
              });
            });
          }
        }
      };
      L.value = ce, M.addEventListener("click", L.value, { capture: !0 }), D.value != null && D.value.addEventListener("scroll", V.value, { passive: !0 });
    }), Ct(() => {
      document.removeEventListener("wheel", h.value, { capture: !0 }), B.value != null && (B.value.removeEventListener("mousedown", g.value, { capture: !0 }), B.value.removeEventListener("click", L.value, { capture: !0 })), D.value != null && D.value.removeEventListener("scroll", V.value);
    });
    function $e(M) {
      ge(M);
    }
    return fe(() => {
      document.addEventListener("mousedown", $e);
    }), Ct(() => {
      document.removeEventListener("mousedown", $e);
    }), (M, U) => o.value ? (p(), x("div", {
      key: 0,
      class: "autodown-codeblock-menu",
      ref_key: "menuEl",
      ref: A,
      style: bn({ top: s.value, left: u.value, visibility: c.value })
    }, [
      b("div", Vl, [
        ct(b("input", {
          class: "autodown-codeblock-menu-search",
          placeholder: "Search language…",
          ref_key: "searchEl",
          ref: ne,
          "onUpdate:modelValue": U[0] || (U[0] = (Q) => l.value = Q),
          onInput: U[1] || (U[1] = (Q) => he(Q)),
          onKeydown: [
            ze(De(R, ["prevent"]), ["down"]),
            ze(De(ie, ["prevent"]), ["enter"]),
            ze(C, ["esc"]),
            ze(De(j, ["prevent"]), ["up"])
          ]
        }, null, 40, Ql), [
          [xt, l.value]
        ])
      ]),
      b("div", {
        class: "autodown-codeblock-menu-list",
        ref_key: "listEl",
        ref: ae
      }, [
        (p(!0), x(Ce, null, Ke(K.value, (Q, Z) => (p(), x("button", {
          class: xe(["autodown-codeblock-menu-item", { active: Z == a.value, selected: Q.id == i.value }]),
          key: Q.id,
          onClick: (ce) => ke(Q),
          onMouseenter: (ce) => w(Z)
        }, [
          b("span", Gl, [
            b("span", null, W(Q.label), 1)
          ]),
          Q.id == i.value ? (p(), ee(pe(_.value), {
            key: 0,
            class: "autodown-codeblock-menu-check",
            size: 13
          })) : $("", !0)
        ], 42, zl))), 128)),
        X.value ? (p(), x("div", jl, [...U[2] || (U[2] = [
          b("span", null, "No matching languages", -1)
        ])])) : $("", !0)
      ], 512)
    ], 4)) : $("", !0);
  }
}), Jl = { class: "autodown-slash-menu-items" }, Xl = ["onClick", "onMouseenter"], Zl = { class: "autodown-slash-menu-info" }, ea = { class: "autodown-slash-menu-title" }, ta = { class: "autodown-slash-menu-desc" }, na = {
  key: 0,
  class: "autodown-slash-menu-empty"
}, oa = /* @__PURE__ */ te({
  __name: "SlashMenu",
  props: {
    editor: {},
    items: {},
    noResultsText: { default: "No results" }
  },
  emits: ["OnOpen", "OnUpdate", "OnClose", "OnKeydown", "SelectItem", "HoverItem"],
  setup(t, { emit: n }) {
    const e = t, o = k(!1), l = k(""), a = k(null), i = k(0), s = k(""), u = k(""), c = k(""), f = k(null), d = m(() => e.items.filter((_) => [_.title, _.description].concat(_.searchTerms).join(" ").toLowerCase().includes(l.value.toLowerCase()))), B = m(() => d.value.length === 0), D = m(() => e.noResultsText ?? "No results"), O = n;
    Le(d, () => {
      i.value = 0;
    });
    function h(_) {
      i.value = _, O("HoverItem", _);
    }
    function g() {
      o.value = !1, l.value = "", a.value = null, i.value = 0, O("OnClose");
    }
    function L(_) {
      if (o.value) {
        if (_.detail.event.key == "ArrowDown") {
          _.detail.event.preventDefault();
          let S = i.value + 1;
          i.value = S % d.value.length, le(() => {
            if (f.value) {
              let C = f.value.querySelector(".autodown-slash-menu-item.active");
              C != null && C.scrollIntoView({ block: "nearest", behavior: "auto" });
            }
          }), e.editor.storage["slash-command"] != null && (e.editor.storage["slash-command"].handled = !0);
        }
        if (_.detail.event.key == "ArrowUp") {
          _.detail.event.preventDefault();
          let S = i.value - 1 + d.value.length;
          i.value = S % d.value.length, le(() => {
            if (f.value) {
              let C = f.value.querySelector(".autodown-slash-menu-item.active");
              C != null && C.scrollIntoView({ block: "nearest", behavior: "auto" });
            }
          }), e.editor.storage["slash-command"] != null && (e.editor.storage["slash-command"].handled = !0);
        }
        if (_.detail.event.key == "Enter" || _.detail.event.key == "NumpadEnter") {
          _.detail.event.preventDefault();
          let S = d.value[i.value];
          S != null && a.value != null && (S.command({ editor: e.editor, range: a.value }), o.value = !1, l.value = "", a.value = null, i.value = 0), e.editor.storage["slash-command"] != null && (e.editor.storage["slash-command"].handled = !0);
        }
        _.detail.event.key == "Escape" && (_.detail.event.preventDefault(), o.value = !1, l.value = "", a.value = null, i.value = 0, e.editor.storage["slash-command"] != null && (e.editor.storage["slash-command"].handled = !0));
      }
      O("OnKeydown", _);
    }
    function V(_) {
      l.value = _.detail.query, a.value = _.detail.range, o.value = !0, i.value = 0, le(() => {
        if (a.value != null && e.editor.view) {
          let S = e.editor.view.coordsAtPos(a.value.from), C = e.editor.view.dom.closest(".autodown-editor");
          if (C != null) {
            let w = C.getBoundingClientRect(), R = { top: S.top - w.top, left: S.left - w.left, bottom: S.bottom - w.top, right: S.right - w.left, width: S.right - S.left, height: S.bottom - S.top }, j = { width: w.width, height: w.height }, ge = _e(R, 0, 0, j, "bottom", 8, "left");
            s.value = ge.top + "px", u.value = ge.left + "px", c.value = "hidden", le(() => {
              let he = C.querySelector(".autodown-slash-menu");
              if (he != null) {
                let ie = he.getBoundingClientRect(), ke = _e(R, ie.width, ie.height, j, "bottom", 8, "left");
                s.value = ke.top + "px", u.value = ke.left + "px", c.value = "visible";
              }
            });
          }
        }
      }), O("OnOpen", _);
    }
    function A(_) {
      l.value = _.detail.query, a.value = _.detail.range, le(() => {
        if (a.value != null && e.editor.view) {
          let S = e.editor.view.coordsAtPos(a.value.from), C = e.editor.view.dom.closest(".autodown-editor");
          if (C != null) {
            let w = C.getBoundingClientRect(), R = { top: S.top - w.top, left: S.left - w.left, bottom: S.bottom - w.top, right: S.right - w.left, width: S.right - S.left, height: S.bottom - S.top }, j = { width: w.width, height: w.height }, ge = _e(R, 0, 0, j, "bottom", 8, "left");
            s.value = ge.top + "px", u.value = ge.left + "px", c.value = "hidden", le(() => {
              let he = C.querySelector(".autodown-slash-menu");
              if (he != null) {
                let ie = he.getBoundingClientRect(), ke = _e(R, ie.width, ie.height, j, "bottom", 8, "left");
                s.value = ke.top + "px", u.value = ke.left + "px", c.value = "visible";
              }
            });
          }
        }
      }), O("OnUpdate", _);
    }
    function ne(_) {
      let S = d.value[_];
      S != null && a.value != null && (S.command({ editor: e.editor, range: a.value }), o.value = !1, l.value = "", a.value = null, i.value = 0), O("SelectItem", _);
    }
    function ae(_) {
      L(_);
    }
    function K(_) {
      V(_);
    }
    function X(_) {
      A(_);
    }
    return fe(() => {
      document.addEventListener("autodown:slash-close", g), document.addEventListener("autodown:slash-keydown", ae), document.addEventListener("autodown:slash-open", K), document.addEventListener("autodown:slash-update", X);
    }), Ct(() => {
      document.removeEventListener("autodown:slash-close", g), document.removeEventListener("autodown:slash-keydown", ae), document.removeEventListener("autodown:slash-open", K), document.removeEventListener("autodown:slash-update", X);
    }), (_, S) => o.value ? (p(), x("div", {
      key: 0,
      class: "autodown-slash-menu",
      ref_key: "menuEl",
      ref: f,
      style: bn({ top: s.value, left: u.value, visibility: c.value })
    }, [
      b("div", Jl, [
        (p(!0), x(Ce, null, Ke(d.value, (C, w) => (p(), x("button", {
          class: xe(["autodown-slash-menu-item", { active: w == i.value }]),
          key: C.title,
          onClick: (R) => ne(w),
          onMouseenter: (R) => h(w)
        }, [
          (p(), ee(pe(C.icon), {
            class: "autodown-slash-menu-icon",
            size: 16
          })),
          b("div", Zl, [
            b("div", ea, [
              b("span", null, W(C.title), 1)
            ]),
            b("div", ta, [
              b("span", null, W(C.description), 1)
            ])
          ])
        ], 42, Xl))), 128)),
        B.value ? (p(), x("div", na, [
          b("span", null, W(D.value), 1)
        ])) : $("", !0)
      ])
    ], 4)) : $("", !0);
  }
});
function la(t) {
  var o, l;
  const n = t == null ? void 0 : t.__engine, e = (l = (o = n == null ? void 0 : n.selection) == null ? void 0 : o.anchor) == null ? void 0 : l.blockId;
  return !n || !e ? null : ao(n, e);
}
function aa(t) {
  return [...[
    {
      title: "Text",
      description: "Plain text",
      icon: Oo,
      searchTerms: ["p"],
      command: ({ editor: e, range: o }) => e.chain().focus().deleteRange(o).setParagraph().run()
    },
    {
      title: "Heading 1",
      description: "Big section heading",
      icon: Do,
      searchTerms: ["h1"],
      command: ({ editor: e, range: o }) => e.chain().focus().deleteRange(o).setHeading({ level: 1 }).run()
    },
    {
      title: "Heading 2",
      description: "Medium section heading",
      icon: $o,
      searchTerms: ["h2"],
      command: ({ editor: e, range: o }) => e.chain().focus().deleteRange(o).setHeading({ level: 2 }).run()
    },
    {
      title: "Heading 3",
      description: "Small section heading",
      icon: qo,
      searchTerms: ["h3"],
      command: ({ editor: e, range: o }) => e.chain().focus().deleteRange(o).setHeading({ level: 3 }).run()
    },
    {
      title: "Heading 4",
      description: "Fourth level heading",
      icon: No,
      searchTerms: ["h4"],
      command: ({ editor: e, range: o }) => e.chain().focus().deleteRange(o).setHeading({ level: 4 }).run()
    },
    {
      title: "Heading 5",
      description: "Fifth level heading",
      icon: Ho,
      searchTerms: ["h5"],
      command: ({ editor: e, range: o }) => e.chain().focus().deleteRange(o).setHeading({ level: 5 }).run()
    },
    {
      title: "Heading 6",
      description: "Sixth level heading",
      icon: Po,
      searchTerms: ["h6"],
      command: ({ editor: e, range: o }) => e.chain().focus().deleteRange(o).setHeading({ level: 6 }).run()
    },
    {
      title: "Bullet List",
      description: "Bullet list",
      icon: Fo,
      searchTerms: ["ul"],
      command: ({ editor: e, range: o }) => e.chain().focus().deleteRange(o).toggleBulletList().run()
    },
    {
      title: "Numbered List",
      description: "Numbered list",
      icon: Uo,
      searchTerms: ["ol"],
      command: ({ editor: e, range: o }) => e.chain().focus().deleteRange(o).toggleOrderedList().run()
    },
    {
      title: "Task List",
      description: "Task list",
      icon: Ko,
      searchTerms: ["task"],
      command: ({ editor: e, range: o }) => e.chain().focus().deleteRange(o).toggleTaskList().run()
    },
    {
      title: "Code Block",
      description: "Code snippet",
      icon: Mn,
      searchTerms: ["code"],
      command: ({ editor: e, range: o }) => {
        e.chain().focus().deleteRange(o).setCodeBlock({ language: "text" }).run();
      }
    },
    {
      title: "Quote",
      description: "Quote",
      icon: Wo,
      searchTerms: ["blockquote"],
      command: ({ editor: e, range: o }) => e.chain().focus().deleteRange(o).toggleBlockquote().run()
    },
    {
      title: "Divider",
      description: "Horizontal rule",
      icon: Vo,
      searchTerms: ["hr"],
      command: ({ editor: e, range: o }) => e.chain().focus().deleteRange(o).setHorizontalRule().run()
    },
    {
      title: "Image",
      description: "Embed image",
      icon: Qo,
      searchTerms: ["img"],
      command: ({ editor: e, range: o }) => {
        const l = window.prompt(t.imageUrlPrompt);
        l && e.chain().focus().deleteRange(o).setImage({ src: l }).run();
      }
    },
    {
      title: "Table",
      description: "Add table",
      icon: zo,
      searchTerms: ["table"],
      command: ({ editor: e, range: o }) => e.chain().focus().deleteRange(o).insertTable({ rows: 3, cols: 3, withHeaderRow: !0 }).run()
    },
    {
      title: "Callout",
      description: "Admonition / callout box",
      icon: Go,
      searchTerms: ["callout", "admonition", "warning", "tip", "note"],
      command: ({ editor: e, range: o }) => {
        e.chain().focus().deleteRange(o).setCallout({ type: "note", title: "Note" }).run();
      }
    },
    {
      title: "Details",
      description: "Collapsible details block",
      icon: jo,
      searchTerms: ["details", "toggle", "collapse", "accordion"],
      command: ({ editor: e, range: o }) => {
        e.chain().focus().deleteRange(o).setDetails({ summary: "Details" }).run();
      }
    },
    {
      title: "Math",
      description: "Block math formula (KaTeX)",
      icon: Yo,
      searchTerms: ["math", "katex", "formula", "equation", "latex"],
      command: ({ editor: e, range: o }) => {
        e.chain().focus().deleteRange(o).setMathBlock().run();
      }
    },
    {
      title: "Mermaid",
      description: "Mermaid diagram",
      icon: Jo,
      searchTerms: ["mermaid", "diagram", "chart", "flowchart"],
      command: ({ editor: e, range: o }) => {
        e.chain().focus().deleteRange(o).setMermaidBlock().run();
      }
    },
    {
      title: "TODO",
      description: "Insert a TODO task",
      icon: Xo,
      searchTerms: ["todo", "task"],
      command: ({ editor: e, range: o }) => e.chain().focus().deleteRange(o).insertContent("- TODO ").run()
    },
    {
      title: "DOING",
      description: "Insert a DOING task",
      icon: Zo,
      searchTerms: ["doing", "task"],
      command: ({ editor: e, range: o }) => e.chain().focus().deleteRange(o).insertContent("- DOING ").run()
    },
    {
      title: "DONE",
      description: "Insert a DONE task",
      icon: el,
      searchTerms: ["done", "task"],
      command: ({ editor: e, range: o }) => e.chain().focus().deleteRange(o).insertContent("- DONE ").run()
    },
    {
      title: "NOW",
      description: "Insert a NOW task",
      icon: tl,
      searchTerms: ["now", "task"],
      command: ({ editor: e, range: o }) => e.chain().focus().deleteRange(o).insertContent("- NOW ").run()
    },
    {
      title: "LATER",
      description: "Insert a LATER task",
      icon: nl,
      searchTerms: ["later", "task"],
      command: ({ editor: e, range: o }) => e.chain().focus().deleteRange(o).insertContent("- LATER ").run()
    },
    {
      title: "Priority A",
      description: "Insert [#A] priority",
      icon: wt,
      searchTerms: ["priority", "A"],
      command: ({ editor: e, range: o }) => e.chain().focus().deleteRange(o).insertContent("[#A] ").run()
    },
    {
      title: "Priority B",
      description: "Insert [#B] priority",
      icon: wt,
      searchTerms: ["priority", "B"],
      command: ({ editor: e, range: o }) => e.chain().focus().deleteRange(o).insertContent("[#B] ").run()
    },
    {
      title: "Priority C",
      description: "Insert [#C] priority",
      icon: wt,
      searchTerms: ["priority", "C"],
      command: ({ editor: e, range: o }) => e.chain().focus().deleteRange(o).insertContent("[#C] ").run()
    },
    {
      title: "Query",
      description: "Insert a query macro",
      icon: ol,
      searchTerms: ["query", "macro"],
      command: ({ editor: e, range: o }) => {
        const l = window.prompt("Query (e.g. (task TODO DOING))", "(task TODO)");
        l && e.chain().focus().deleteRange(o).insertContent(`{{query ${l}}}`).run();
      }
    },
    {
      title: "Block link",
      description: "Copy link to current block",
      icon: Rn,
      searchTerms: ["block link", "anchor", "copy link"],
      command: ({ editor: e, range: o }) => {
        e.chain().focus().deleteRange(o).run();
        const l = t.pageTitle, a = la(e);
        if (l && a) {
          const i = `[[${l}#^${a}]]`;
          navigator.clipboard.writeText(i).catch(() => {
          });
        }
      }
    }
  ], ...t.extraSlashItems ?? []];
}
const Nn = "autodown-node-view-content";
te({
  name: "NodeViewWrapper",
  props: {
    as: { type: [String, Object], default: "div" }
  },
  setup(t, { slots: n, attrs: e }) {
    return () => {
      var o;
      return se(t.as, { ...e, "data-node-view-wrapper": "" }, (o = n.default) == null ? void 0 : o.call(n));
    };
  }
});
te({
  name: "NodeViewContent",
  props: {
    as: { type: [String, Object], default: "div" }
  },
  setup(t, { slots: n, attrs: e }) {
    const o = zn(Nn, null);
    return () => {
      var a;
      const l = o ? o() : ((a = n.default) == null ? void 0 : a.call(n)) ?? [];
      return se(t.as, { ...e, "data-node-view-content": "" }, l);
    };
  }
});
let Hn = {};
function _t(t) {
  Hn = { runQuery: t.runQuery, loadBlock: t.loadBlock };
}
function $t() {
  return Hn;
}
const ut = [];
function ia(t) {
  ut.push(t);
}
function ra() {
  ut.pop();
}
function sa() {
  return ut[ut.length - 1];
}
te({
  name: "NodeViewContentProvider",
  props: { content: { type: Function, required: !0 } },
  setup(t, { slots: n }) {
    return Gn(Nn, () => t.content()), () => {
      var e;
      return (e = n.default) == null ? void 0 : e.call(n);
    };
  }
});
class ua {
  constructor(n, e) {
    this.engine = n, this.tableId = e;
  }
  table() {
    return J(this.engine.doc, this.tableId);
  }
  get rows() {
    var n;
    return ((n = this.table()) == null ? void 0 : n.children) ?? [];
  }
  cellText(n) {
    const e = J(this.engine.doc, n);
    return e ? me(e) : "";
  }
  /** Append an empty row after the last row (or after the header when only
   *  the header exists). One undo step. */
  addRow() {
    const n = this.rows[this.rows.length - 1];
    Qt(this.engine, this.tableId, (n == null ? void 0 : n.id) ?? null);
  }
  /** Insert an empty row ABOVE the header (TableMenu absorption, plan 026
   *  adjudication #1 — single table entry). One undo step. */
  addRowAbove() {
    Qt(this.engine, this.tableId, null);
  }
  /** Insert an empty column at index 0. One undo step. */
  addColumnBefore() {
    this.engine.applyTree((n) => St(n, this.tableId, 0));
  }
  /** Remove the whole table; the dangling selection collapses to the first
   *  block (the menu chain's deleteTable repair, same semantics). */
  deleteTable() {
    this.engine.applyTree((n) => ye(n, this.tableId, [])), !J(this.engine.doc, this.engine.selection.anchor.blockId) && this.engine.doc.children[0] && this.engine.select(tt(this.engine.doc.children[0].id, 0));
  }
  /** Remove the last row. Refused (no-op) when only the header remains. */
  deleteRow() {
    return this.rows.length <= 1 ? !1 : (io(this.engine, this.rows[this.rows.length - 1].id), !0);
  }
  /** Append an empty column. One undo step. */
  addColumn() {
    ro(this.engine, this.tableId);
  }
  /** Remove the last column. Refused (no-op) below one column. */
  deleteColumn() {
    var e;
    return (((e = this.rows[0]) == null ? void 0 : e.children.length) ?? 0) <= 1 ? !1 : (so(this.engine, this.tableId), !0);
  }
  /** Cell blur-commit: old→new text as one diff op (BlockHost protocol).
   *  The selection stays anchored on the TABLE — the op's position points at
   *  the cell and applyOp would otherwise drag the anchor into it, dropping
   *  the top-level focus that assembles this editing face (found live in the
   *  demo: committing a cell unmounted the table editor).
   *  Returns false when the text is unchanged or the cell is gone. */
  commitCell(n, e) {
    const o = J(this.engine.doc, n);
    if (!o || o.kind !== T.TableCell) return !1;
    const l = me(o);
    if (l === e) return !1;
    const a = uo(n, l, e);
    if (!a) return !1;
    const i = this.engine.selection;
    return this.engine.apply(a), this.engine.selection.anchor.blockId !== i.anchor.blockId && this.engine.select(i), !0;
  }
}
function rn(t) {
  const n = It(t, !0);
  return n.error === "" && Sn("MathBlock", t, { kind: "html", body: n.html, error: "" }), n;
}
function Pn(t) {
  const n = t.split(`
`).length;
  return String(Math.max(4, Math.min(24, n + 1)));
}
const ca = ["data-block-id", "data-math-block", "data-node-type"], da = {
  key: 0,
  class: "autodown-stream-banner"
}, fa = { class: "math-editor-stack" }, ha = ["innerHTML"], va = {
  key: 1,
  class: "autodown-math-error",
  title: "Math preview error"
}, ma = ["disabled", "rows"], pa = ["innerHTML"], ga = {
  key: 1,
  class: "autodown-math-error",
  title: "Math preview error"
}, ka = { class: "math-block-source" }, ba = /* @__PURE__ */ te({
  __name: "MathBlockWidget",
  props: {
    mode: {},
    node: {},
    ctx: {},
    final: { type: Boolean }
  },
  emits: ["Init", "AreaInput", "Blur"],
  setup(t, { emit: n }) {
    const e = t, o = k(""), l = k(""), a = k(ot(e.node)), i = k(In(e.ctx)), s = k(null), u = m(() => e.mode === "edit"), c = m(() => ot(e.node)), f = m(() => Mt(e.ctx)), d = m(() => u.value ? f.value ? "autodown-math-editor is-readonly" : "autodown-math-editor" : "autodown-math-block"), B = m(() => Bn(e.mode)), D = m(() => lt(e.mode, Et(e.ctx))), O = m(() => lt(e.mode, "MathBlock")), h = m(() => {
      var C;
      return (C = It(a.value, !0)) == null ? void 0 : C.html;
    }), g = m(() => {
      var C;
      return (C = It(a.value, !0)) == null ? void 0 : C.error;
    }), L = m(() => !g.value), V = m(() => !!g.value), A = m(() => Pn(a.value)), ne = m(() => !l.value), ae = m(() => !!l.value), K = m(() => "code"), X = n;
    Le(c, () => {
      if (!u.value) {
        let C = rn(c.value);
        o.value = C.html, l.value = C.error;
      }
    });
    function _(C) {
      a.value = C.target.value, X("AreaInput", C);
    }
    function S(C) {
      f.value || i.value.commit(C.target.value), X("Blur", C);
    }
    return fe(() => {
      if (u.value && Tn(s.value, f.value), !u.value) {
        let C = rn(c.value);
        o.value = C.html, l.value = C.error;
      }
    }), (C, w) => (p(), x("div", {
      class: xe(d.value),
      "data-block-id": D.value,
      "data-math-block": B.value,
      "data-node-type": O.value
    }, [
      u.value ? (p(), x(Ce, { key: 0 }, [
        f.value ? (p(), x("div", da, [...w[3] || (w[3] = [
          b("span", null, "流式生成中", -1)
        ])])) : $("", !0),
        b("div", fa, [
          L.value ? (p(), x("div", {
            key: 0,
            class: "autodown-math-preview",
            innerHTML: h.value
          }, null, 8, ha)) : $("", !0),
          V.value ? (p(), x("div", va, [
            b("span", null, W(g.value), 1)
          ])) : $("", !0),
          ct(b("textarea", {
            class: "math-editor-textarea",
            disabled: f.value,
            ref_key: "area",
            ref: s,
            rows: A.value,
            spellcheck: "false",
            "onUpdate:modelValue": w[0] || (w[0] = (R) => a.value = R),
            onBlur: w[1] || (w[1] = (R) => S(R)),
            onInput: w[2] || (w[2] = (R) => _(R))
          }, null, 40, ma), [
            [xt, a.value]
          ])
        ])
      ], 64)) : $("", !0),
      u.value ? $("", !0) : (p(), x(Ce, { key: 1 }, [
        ne.value ? (p(), x("div", {
          key: 0,
          class: "autodown-math-preview",
          innerHTML: o.value
        }, null, 8, pa)) : $("", !0),
        ae.value ? (p(), x("div", ga, [
          b("span", null, W(l.value), 1)
        ])) : $("", !0),
        b("pre", ka, [
          w[4] || (w[4] = et("          ", -1)),
          (p(), ee(pe(K.value))),
          w[5] || (w[5] = et(`
        `, -1))
        ])
      ], 64))
    ], 10, ca));
  }
}), Fn = /* @__PURE__ */ ft(ba, [["__scopeId", "data-v-bf30707d"]]);
async function sn(t) {
  const n = await xn(t);
  return n.error === "" && Sn("Mermaid", t, { kind: "svg", body: n.svg, error: "" }), n;
}
let Je = null, un = 0;
const wa = 300;
function cn(t, n) {
  const e = ++un;
  if (Je != null && clearTimeout(Je), t.trim() === "") {
    n({ svg: "", error: "", loading: !1 });
    return;
  }
  Je = setTimeout(() => {
    Je = null, n({ svg: "", error: "", loading: !0 }), xn(t).then((o) => {
      e === un && n({ svg: o.svg, error: o.error, loading: !1 });
    });
  }, wa);
}
const ya = ["data-block-id", "data-mermaid-block", "data-node-type"], _a = {
  key: 0,
  class: "autodown-stream-banner"
}, Ca = { class: "mermaid-editor-stack" }, Sa = ["innerHTML"], Ia = {
  key: 1,
  class: "autodown-mermaid-error",
  title: "Mermaid render error"
}, Ba = {
  key: 2,
  class: "mermaid-editor-loading"
}, Ta = ["disabled", "rows"], xa = ["innerHTML"], Ra = {
  key: 1,
  class: "autodown-mermaid-error",
  title: "Mermaid render error"
}, Ma = { class: "mermaid-source" }, Ea = /* @__PURE__ */ te({
  __name: "MermaidBlockWidget",
  props: {
    mode: {},
    node: {},
    ctx: {},
    final: { type: Boolean }
  },
  emits: ["Init", "AreaInput", "Blur"],
  setup(t, { emit: n }) {
    const e = t, o = k(""), l = k(""), a = k(ot(e.node)), i = k(""), s = k(""), u = k(!1), c = k(In(e.ctx)), f = k(null), d = m(() => e.mode === "edit"), B = m(() => ot(e.node)), D = m(() => Mt(e.ctx)), O = m(() => d.value ? D.value ? "autodown-mermaid-editor is-readonly" : "autodown-mermaid-editor" : "autodown-mermaid-block"), h = m(() => Bn(e.mode)), g = m(() => lt(e.mode, Et(e.ctx))), L = m(() => lt(e.mode, "Mermaid")), V = m(() => u.value === !1 && !s.value && !!i.value), A = m(() => u.value === !1 && !!s.value), ne = m(() => Pn(a.value)), ae = m(() => !!o.value), K = m(() => !o.value && !!l.value), X = m(() => "code"), _ = n;
    Le(B, () => {
      d.value || (B.value.trim() == "" && (o.value = "", l.value = ""), B.value.trim() != "" && sn(B.value).then((R) => {
        o.value = R.svg, l.value = R.error;
      }));
    });
    function S(w) {
      a.value = w.target.value, u.value = !0, cn(a.value, (R) => {
        i.value = R.svg, s.value = R.error, u.value = R.loading;
      }), _("AreaInput", w);
    }
    function C(w) {
      D.value || c.value.commit(w.target.value), _("Blur", w);
    }
    return fe(() => {
      d.value && (Tn(f.value, D.value), u.value = !0, cn(B.value, (w) => {
        i.value = w.svg, s.value = w.error, u.value = w.loading;
      })), d.value || (B.value.trim() == "" && (o.value = "", l.value = ""), B.value.trim() != "" && sn(B.value).then((R) => {
        o.value = R.svg, l.value = R.error;
      }));
    }), (w, R) => (p(), x("div", {
      class: xe(O.value),
      "data-block-id": g.value,
      "data-mermaid-block": h.value,
      "data-node-type": L.value
    }, [
      d.value ? (p(), x(Ce, { key: 0 }, [
        D.value ? (p(), x("div", _a, [...R[3] || (R[3] = [
          b("span", null, "流式生成中", -1)
        ])])) : $("", !0),
        b("div", Ca, [
          V.value ? (p(), x("div", {
            key: 0,
            class: "autodown-mermaid-preview",
            innerHTML: i.value
          }, null, 8, Sa)) : $("", !0),
          A.value ? (p(), x("div", Ia, [
            b("span", null, W(s.value), 1)
          ])) : $("", !0),
          u.value ? (p(), x("div", Ba, [...R[4] || (R[4] = [
            b("span", null, "渲染中…", -1)
          ])])) : $("", !0),
          ct(b("textarea", {
            class: "mermaid-editor-textarea",
            disabled: D.value,
            ref_key: "area",
            ref: f,
            rows: ne.value,
            spellcheck: "false",
            "onUpdate:modelValue": R[0] || (R[0] = (j) => a.value = j),
            onBlur: R[1] || (R[1] = (j) => C(j)),
            onInput: R[2] || (R[2] = (j) => S(j))
          }, null, 40, Ta), [
            [xt, a.value]
          ])
        ])
      ], 64)) : $("", !0),
      d.value ? $("", !0) : (p(), x(Ce, { key: 1 }, [
        ae.value ? (p(), x("div", {
          key: 0,
          class: "autodown-mermaid-preview",
          innerHTML: o.value
        }, null, 8, xa)) : $("", !0),
        K.value ? (p(), x("div", Ra, [
          b("span", null, W(l.value), 1)
        ])) : $("", !0),
        b("pre", Ma, [
          R[5] || (R[5] = et("          ", -1)),
          (p(), ee(pe(X.value))),
          R[6] || (R[6] = et(`
        `, -1))
        ])
      ], 64))
    ], 10, ya));
  }
}), Un = /* @__PURE__ */ ft(Ea, [["__scopeId", "data-v-08feae74"]]), Aa = ["data-open"], La = { class: "autodown-details-summary" }, Oa = { class: "autodown-details-content" }, Da = {
  key: 0,
  class: "markdown-renderer"
}, Tt = /* @__PURE__ */ te({
  __name: "DetailsBlockWidget",
  props: {
    mode: {},
    node: {},
    ctx: {},
    final: { type: Boolean },
    children: {},
    version: {}
  },
  emits: ["ToggleOpen"],
  setup(t, { emit: n }) {
    const e = t, o = m(() => e.mode === "edit"), l = m(() => Mt(e.ctx));
    m(() => Et(e.ctx));
    const a = m(() => co(e.ctx)), i = m(() => fo(e.node, e.ctx)), s = m(() => ho(e.node, "open")), u = m(() => s.value ? "▼" : "▶"), c = m(() => vo(e.node, "summary")), f = m(() => c.value ? c.value : "Details"), d = n;
    function B() {
      po(a.value, i.value, s.value), d("ToggleOpen");
    }
    return (D, O) => (p(), x("div", {
      class: "autodown-details",
      "data-open": s.value
    }, [
      b("div", La, [
        b("span", {
          class: "autodown-details-marker",
          "aria-hidden": "true",
          title: "点击展开详细内容",
          onClick: De(B, ["stop"])
        }, [
          b("span", null, W(u.value), 1)
        ]),
        o.value ? (p(), ee(ue(mo), {
          attr_key: "summary",
          blockId: i.value,
          controller: a.value,
          host_class: "autodown-details-summary-text",
          placeholder: "Details",
          readonly: l.value,
          value: c.value,
          version: t.version,
          key: "AttrHost-1"
        }, null, 8, ["blockId", "controller", "readonly", "value", "version"])) : $("", !0),
        o.value ? $("", !0) : (p(), x("span", {
          key: 1,
          class: "autodown-details-summary-text",
          onClick: De(B, ["stop"])
        }, [
          b("span", null, W(f.value), 1)
        ]))
      ]),
      ct(b("div", Oa, [
        o.value ? (p(), x("div", Da, [
          (p(), ee(ue(at), {
            children_slot: t.children,
            key: "BlockChildren-2"
          }, null, 8, ["children_slot"]))
        ])) : $("", !0),
        o.value ? $("", !0) : (p(), ee(ue(at), {
          children_slot: t.children,
          key: "BlockChildren-3"
        }, null, 8, ["children_slot"]))
      ], 512), [
        [jn, s.value]
      ])
    ], 8, Aa));
  }
});
function $a(t) {
  return dt((t == null ? void 0 : t.attrs) ?? [], "query", "");
}
function dn() {
  return $t().runQuery ?? null;
}
function fn(t) {
  return (t && t.results || []).map((e) => ({
    ...e,
    source: e.title || e.page_path,
    priority_label: e.priority ? `[#${e.priority}]` : ""
  }));
}
function hn(t) {
  return (t == null ? void 0 : t.message) || String(t);
}
const qa = {
  class: "autodown-query-block",
  "data-query-block": ""
}, Na = { class: "query-header" }, Ha = {
  key: 0,
  class: "query-state"
}, Pa = {
  key: 1,
  class: "query-state query-error"
}, Fa = { class: "result-marker" }, Ua = {
  key: 0,
  class: "result-priority"
}, Ka = { class: "result-content" }, Wa = { class: "result-source" }, Va = {
  key: 3,
  class: "query-state"
}, Qa = /* @__PURE__ */ te({
  __name: "QueryBlockWidget",
  props: {
    mode: {},
    node: {},
    ctx: {},
    final: { type: Boolean }
  },
  emits: ["Init"],
  setup(t, { emit: n }) {
    const e = t, o = k([]), l = k(!1), a = k(""), i = m(() => $a(e.node)), s = m(() => "code"), u = m(() => "ul"), c = m(() => "li"), f = m(() => l.value || !e.final), d = m(() => e.final && !l.value && !!a.value), B = m(() => e.final && !l.value && !a.value && o.value.length > 0), D = m(() => e.final && !l.value && !a.value && o.value.length === 0);
    return Le(i, async () => {
      if (e.final) {
        let O = dn();
        if ((O == null || i.value == "") && (a.value = "No query runner configured"), O != null && i.value != "") {
          l.value = !0, a.value = "";
          try {
            let h = await O(i.value);
            o.value = fn(h);
          } catch (h) {
            a.value = hn(h), o.value = [];
          } finally {
            l.value = !1;
          }
        }
      }
    }), fe(async () => {
      if (e.final) {
        let O = dn();
        if ((O == null || i.value == "") && (a.value = "No query runner configured"), O != null && i.value != "") {
          l.value = !0, a.value = "";
          try {
            let h = await O(i.value);
            o.value = fn(h);
          } catch (h) {
            a.value = hn(h), o.value = [];
          } finally {
            l.value = !1;
          }
        }
      }
    }), (O, h) => (p(), x("div", qa, [
      b("div", Na, [
        h[0] || (h[0] = b("span", { class: "query-label" }, [
          b("span", null, "Query")
        ], -1)),
        (p(), ee(pe(s.value), { class: "query-code" }, {
          default: Xe(() => [
            b("span", null, W(i.value), 1)
          ]),
          _: 1
        }))
      ]),
      f.value ? (p(), x("div", Ha, [...h[1] || (h[1] = [
        b("span", null, "Loading query…", -1)
      ])])) : $("", !0),
      d.value ? (p(), x("div", Pa, [
        b("span", null, W(a.value), 1)
      ])) : $("", !0),
      B.value ? (p(), ee(pe(u.value), {
        key: 2,
        class: "query-results"
      }, {
        default: Xe(() => [
          (p(!0), x(Ce, null, Ke(o.value, (g, L) => (p(), ee(pe(c.value), {
            class: "query-result",
            key: L
          }, {
            default: Xe(() => [
              b("span", Fa, [
                b("span", null, W(g.marker), 1)
              ]),
              g.priority ? (p(), x("span", Ua, [
                b("span", null, W(g.priority_label), 1)
              ])) : $("", !0),
              b("span", Ka, [
                b("span", null, W(g.content), 1)
              ]),
              b("span", Wa, [
                b("span", null, W(g.source), 1)
              ])
            ]),
            _: 2
          }, 1024))), 128))
        ]),
        _: 1
      })) : $("", !0),
      D.value ? (p(), x("div", Va, [...h[2] || (h[2] = [
        b("span", null, "No results", -1)
      ])])) : $("", !0)
    ]));
  }
}), za = /* @__PURE__ */ ft(Qa, [["__scopeId", "data-v-45f3e7c3"]]);
function Kn(t) {
  if (t.startsWith("^"))
    return { title: "", blockId: t.length > 1 ? t.slice(1) : null };
  const n = t.indexOf("#^");
  return n >= 0 ? { title: t.slice(0, n), blockId: t.slice(n + 2) || null } : { title: t, blockId: null };
}
function Wn(t) {
  return dt((t == null ? void 0 : t.attrs) ?? [], "src", "");
}
function Ga(t) {
  return Kn(Wn(t)).title;
}
function ja(t) {
  return Kn(Wn(t)).blockId;
}
function vn() {
  return $t().loadBlock ?? null;
}
function mn(t) {
  return (t == null ? void 0 : t.message) || String(t);
}
const Ya = ["data-title"], Ja = {
  key: 0,
  class: "embed-state"
}, Xa = {
  key: 1,
  class: "embed-state embed-error"
}, Za = {
  key: 2,
  class: "embed-header"
}, ei = { class: "embed-title" }, ti = {
  key: 3,
  class: "embed-content"
}, ni = /* @__PURE__ */ te({
  __name: "EmbedBlockWidget",
  props: {
    mode: {},
    node: {},
    ctx: {},
    final: { type: Boolean }
  },
  emits: ["Init"],
  setup(t, { emit: n }) {
    const e = t, o = k(null), l = k(!1), a = k(""), i = m(() => Ga(e.node)), s = m(() => ja(e.node)), u = m(() => s.value != null ? i.value ? i.value + "#" + s.value : s.value : i.value), c = m(() => "Loading " + u.value + "…" || "Loading…"), f = m(() => o.value && o.value.content || ""), d = m(() => l.value || !e.final), B = m(() => e.final && !l.value && !!a.value), D = m(() => e.final && !l.value && !a.value && o.value), O = m(() => e.final && !l.value && !a.value);
    return Le(s, async () => {
      if (e.final && s.value != null) {
        let h = vn();
        if (h == null && (a.value = "No block loader configured"), h != null) {
          l.value = !0, a.value = "";
          try {
            let g = await h(s.value);
            o.value = g, g || (a.value = "Block not found");
          } catch (g) {
            a.value = mn(g), o.value = null;
          } finally {
            l.value = !1;
          }
        }
      }
    }), fe(async () => {
      if (e.final && s.value != null) {
        let h = vn();
        if (h == null && (a.value = "No block loader configured"), h != null) {
          l.value = !0, a.value = "";
          try {
            let g = await h(s.value);
            o.value = g, g || (a.value = "Block not found");
          } catch (g) {
            a.value = mn(g), o.value = null;
          } finally {
            l.value = !1;
          }
        }
      }
    }), (h, g) => (p(), x("div", {
      class: "autodown-block-embed",
      "data-title": i.value
    }, [
      d.value ? (p(), x("div", Ja, [
        b("span", null, W(c.value), 1)
      ])) : $("", !0),
      B.value ? (p(), x("div", Xa, [
        b("span", null, W(a.value), 1)
      ])) : $("", !0),
      O.value ? (p(), x("div", Za, [
        b("span", ei, [
          b("span", null, W(u.value), 1)
        ])
      ])) : $("", !0),
      D.value ? (p(), x("div", ti, [
        b("span", null, W(f.value), 1)
      ])) : $("", !0)
    ], 8, Ya));
  }
}), oi = /* @__PURE__ */ ft(ni, [["__scopeId", "data-v-5badd3b4"]]), li = {
  class: "blockquote",
  dir: "auto"
}, ai = {
  key: 0,
  class: "markdown-renderer"
}, pn = /* @__PURE__ */ te({
  __name: "BlockquoteBlockWidget",
  props: {
    mode: {},
    node: {},
    ctx: {},
    final: { type: Boolean },
    children: {},
    version: {}
  },
  setup(t) {
    const n = t, e = m(() => n.mode === "edit");
    return (o, l) => (p(), x("blockquote", li, [
      e.value ? (p(), x("div", ai, [
        (p(), ee(ue(at), {
          children_slot: t.children,
          key: "BlockChildren-1"
        }, null, 8, ["children_slot"]))
      ])) : $("", !0),
      e.value ? $("", !0) : (p(), ee(ue(at), {
        children_slot: t.children,
        key: "BlockChildren-2"
      }, null, 8, ["children_slot"]))
    ]));
  }
}), ii = ["data-accent"];
Re("Fence", Io);
Re("MathBlock", Fn);
Re("Mermaid", Un);
function qt(t) {
  return () => Ve(vt(t.children), !0);
}
function ri(t) {
  return t.children.map((n) => {
    const e = Rt(n.attrs, "checked") != null;
    return {
      id: n.id,
      task: e,
      checked: _n(n.attrs, "checked", !1),
      cls: "list-item" + (e ? " task-item" : ""),
      children_slot: () => Ve(vt(n.children), !0)
    };
  });
}
function mt(t, n) {
  return (e, o) => se(t, {
    mode: "edit",
    node: e,
    ctx: { engine: o.engine, blockId: o.blockId, readonly: o.readonly },
    final: !0,
    version: o.version ?? 0,
    ...n(e, o)
  });
}
Re("Callout", Gt, {
  edit: mt(Gt, (t, n) => ({ children: n.children ?? qt(t) }))
});
Re("Blockquote", pn, {
  edit: mt(pn, (t, n) => ({ children: n.children ?? qt(t) }))
});
Re("ListBlock", jt, {
  // items is FLAT DATA (the widget v-fors the array itself), unlike the
  // children closure — call the injection at slot-call time (the assembly's
  // render closure re-runs per repaint, so the timing matches the retired
  // hand-rolled dispatch)
  edit: mt(jt, (t, n) => ({ items: n.items ? n.items() : ri(t) }))
});
Re("Details", Tt, {
  edit: mt(Tt, (t, n) => ({ children: n.children ?? qt(t) }))
});
function Vn(t) {
  return t === "center" ? "text-center" : t === "right" ? "text-right" : "text-left";
}
function gn(t) {
  return { id: t.id, text: me(t), cls: Vn(dt(t.attrs, "align", "left")) };
}
function kn(t) {
  return {
    id: t.id,
    cls: Vn(dt(t.attrs, "align", "left")),
    children_slot: () => Ve(vt(t.children), !0)
  };
}
Re("Table", bt, {
  edit: (t, n) => {
    var o;
    const e = t.children;
    return se(bt, {
      mode: "edit",
      controller: new ua(n.engine, n.blockId),
      blockId: n.blockId,
      readonly: n.readonly,
      final: !0,
      header_cells: (((o = e[0]) == null ? void 0 : o.children) ?? []).map(gn),
      body_rows: e.slice(1).map((l) => ({ id: l.id, cells: l.children.map(gn) })),
      // filler for the generated required-prop checks (the 033 ctx:null
      // idiom) — the edit face reads none
      columns: [],
      rows: []
    });
  },
  stream: Bo,
  view: (t, n) => {
    var o;
    const e = t.children;
    return se(bt, {
      mode: "view",
      controller: null,
      blockId: "",
      readonly: !1,
      final: n,
      header_cells: (((o = e[0]) == null ? void 0 : o.children) ?? []).map(kn),
      body_rows: e.slice(1).map((l) => ({ id: l.id, cells: l.children.map(kn) })),
      columns: [],
      rows: []
    });
  }
});
function si(t, n) {
  const e = [];
  return (n == null ? void 0 : n.type) === "details" && (e.push({ key: "summary", value: Ie.Str(String(n.text ?? "")) }), (n == null ? void 0 : n.loading) === !0 && e.push({ key: "open", value: Ie.Bool(!0) })), {
    id: "nv",
    kind: t,
    attrs: e,
    children: [],
    inlines: [],
    source: { start: 0, end: 0 }
  };
}
We(
  "Details",
  // plan 035 T6: the family widget replaces the retired DetailsNodeView —
  // same view face, plus the marker verb riding the live host window's
  // engine (the preview-side toggle writes `open` back through the model,
  // the host-protocol contract) and the body through the BlockChildren
  // closure instead of the node-view injection key.
  (t) => {
    const n = sa(), e = go(t.node) ?? si(T.Details, t.node);
    return se(Tt, {
      mode: "view",
      node: e,
      final: t.final ?? !0,
      ctx: n ? { engine: n.engine, blockId: e.id, readonly: !0 } : null,
      children: ko(To(), () => Ve(t.node.children ?? [], !0)),
      version: 0
    });
  }
);
We("MathBlock", ht(Fn));
We("Mermaid", ht(Un));
We("Query", ht(za));
We("Embed", ht(oi));
const hi = /* @__PURE__ */ te({
  __name: "EngineEditor",
  props: {
    content: {},
    modelValue: {},
    placeholder: {},
    extraSlashItems: {},
    streaming: { type: Boolean },
    runQuery: { type: Function },
    loadBlock: { type: Function },
    darkMode: { type: Boolean },
    accent: {}
  },
  emits: ["update", "update:modelValue", "save", "focusblock", "open-wiki-link"],
  setup(t, { expose: n, emit: e }) {
    const o = t, l = ["indigo", "coral", "ocean", "sage", "amber"], a = m(
      () => l.includes(o.accent) ? o.accent : "indigo"
    ), i = k(!1), s = m(() => o.darkMode || i.value);
    fe(() => {
      var r;
      if (typeof document < "u") {
        const v = () => {
          var y;
          i.value = !!(document.documentElement.classList.contains("dark") || document.documentElement.getAttribute("data-theme") === "dark" || (y = g.value) != null && y.closest('.dark, [data-theme="dark"]'));
        };
        v();
        const I = new MutationObserver(v);
        I.observe(document.documentElement, { attributes: !0, attributeFilter: ["class", "data-theme"] }), (r = g.value) != null && r.parentElement && I.observe(g.value.parentElement, { attributes: !0, attributeFilter: ["class", "data-theme"] }), Ee(() => I.disconnect());
      }
    });
    const u = e;
    let c = null, f = null;
    const d = 250;
    function B(r) {
      const v = r ?? "\0null";
      v !== c && (c = v, le(() => {
        const I = r ? be().find((y) => y.id === r) : void 0;
        u("focusblock", r && I ? { id: r, height: I.height } : null);
      }));
    }
    function D(r) {
      if (_) {
        _ = !1, c = null;
        return;
      }
      if (f != null && (clearTimeout(f), f = null), !r) {
        B(null);
        return;
      }
      const v = A.selection.anchor.blockId || null;
      v && (f = setTimeout(() => {
        f = null, B(v);
      }, d));
    }
    const O = (r, v) => u("open-wiki-link", r, v);
    Yt(O), Ee(() => {
      xo() === O && Yt(null);
    });
    let h = !1;
    Le(
      () => [o.runQuery, o.loadBlock],
      () => {
        o.runQuery != null || o.loadBlock != null ? (_t({ runQuery: o.runQuery, loadBlock: o.loadBlock }), h = !0) : h && (_t({}), h = !1);
      },
      { immediate: !0 }
    ), Ee(() => {
      if (!h) return;
      const r = $t();
      r.runQuery === o.runQuery && r.loadBlock === o.loadBlock && _t({});
    });
    const g = k(null), L = k(null);
    function V(r) {
      return yn(r ?? "", !0);
    }
    const A = new ll(V(o.modelValue ?? o.content ?? "")), ne = vl(A), ae = aa({ extraSlashItems: o.extraSlashItems });
    let K = Ge(A.doc, !0);
    A.onChange(() => {
      C.value++;
      const r = X();
      D(r);
    });
    function X() {
      const r = Ge(A.doc, !0);
      return r === K ? !1 : (K = r, u("update", r), u("update:modelValue", r), !0);
    }
    let _ = !1;
    Le(
      () => o.modelValue ?? o.content,
      (r) => {
        r != null && r !== Ge(A.doc, !0) && (_ = !0, A.replaceDoc(V(r)), Z.clear(), R.value++);
      }
    );
    function S() {
      var Y;
      const r = typeof window > "u" ? null : window.getSelection();
      if (!r || r.rangeCount === 0) return;
      const v = r.getRangeAt(0);
      if (v.collapsed) return;
      const I = v.startContainer, y = I.nodeType === 3 ? I.parentElement : I, E = y == null ? void 0 : y.closest(".autodown-block-host");
      if (!E || !((Y = g.value) != null && Y.contains(E))) return;
      const F = E.dataset.blockId;
      if (!F) return;
      const z = sl(E, F);
      !z || z.lo === z.hi || A.selection.anchor.blockId === F && A.selection.anchor.offset === z.lo && A.selection.head.offset === z.hi || A.select(new gt(new je(F, z.lo), new je(F, z.hi)));
    }
    fe(() => document.addEventListener("selectionchange", S)), Ee(() => document.removeEventListener("selectionchange", S)), Ee(() => {
      f != null && clearTimeout(f);
    });
    const C = k(0), w = k(0), R = k(0), j = te({
      name: "AssemblyView",
      props: { render: { type: Function, required: !0 } },
      setup(r) {
        return () => r.render();
      }
    }), ge = m(() => {
      C.value;
      const r = A.selection.anchor.blockId, v = { path: bo(A.doc, r), focusedId: r, counter: { n: 0 } };
      return A.doc.children.map((I) => U(I, v, !0));
    });
    function he(r) {
      ia({ engine: A, adapter: ne });
      try {
        return Ve(vt([r]), !0)[0] ?? se("div", { class: "unknown-node" }, "");
      } finally {
        ra();
      }
    }
    function ie(r, v, I, y, E = !0) {
      return se(
        "div",
        {
          class: "node-slot",
          "data-node-index": String(y.n++),
          "data-node-type": T[r.kind],
          "data-block-id": r.id,
          // the innermost addressable slot wins — an expanded container's outer
          // chrome must not re-handle the bubbled click (it would resolve the
          // whole container back to its first leaf)
          onClick: (F) => {
            F.stopPropagation();
            const z = _o(r, F.currentTarget, F);
            z.anchor && Co(F, z.targetId, z.anchor, z.cellId), qe(r.id, z.targetId);
          }
        },
        [
          se("div", { class: "node-content" }, [v]),
          ...I && E ? [se("div", { class: "autodown-block-boundary", "data-boundary-for": r.id })] : []
        ]
      );
    }
    function ke(r, v) {
      return r.children.map((I) => {
        const y = Rt(I.attrs, "checked") != null;
        return {
          id: I.id,
          task: y,
          checked: _n(I.attrs, "checked", !1),
          cls: "list-item" + (y ? " task-item" : ""),
          children_slot: () => I.children.map((E) => $e(E, v))
        };
      });
    }
    function $e(r, v) {
      return r.id === v.focusedId || v.path.has(r.id) ? M(U(r, v, !1)) : ie(r, he(r), !1, v.counter);
    }
    function M(r) {
      return se(r.view, r.props);
    }
    function U(r, v, I) {
      if (r.id === v.focusedId) {
        const y = zt(T[r.kind]);
        if (y)
          return {
            id: r.id,
            view: j,
            props: {
              render: () => ie(r, y(r, { engine: A, blockId: r.id, readonly: o.streaming === !0 }), I, v.counter, !1),
              key: `edit:${r.id}:${w.value}`
            }
          };
        if (wo(r)) {
          const E = ce(r.id), F = r.kind === T.Heading ? eo(r.attrs, "level", 1) : void 0;
          return {
            id: r.id,
            view: j,
            props: {
              render: () => ie(
                r,
                se(Ol, {
                  controller: E,
                  // flat chrome data (plan 034 D4): the widget derives tag/cls from
                  // blockKind/level itself (the host-face computation is absorbed);
                  // initial_html is the mount-once rich snapshot, evaluated here —
                  // the engine is not Vue-reactive, the snapshot never invalidates.
                  blockId: E.id,
                  blockKind: T[r.kind],
                  level: F ?? 0,
                  initial_html: Cn(E.inlines),
                  // The face lives in the key: a kind/level flip mid-typing (input
                  // rules) must REMOUNT the host. <component :is> would swap the
                  // DOM element under the caret without re-running onMounted —
                  // focus lands nowhere and every post-flip keystroke is lost.
                  // The remount re-focuses at end (plan 029; rules match only a
                  // whole-block marker, so the caret IS at end on every flip).
                  key: `host:${r.id}:${T[r.kind]}:${F ?? ""}:${w.value}:${R.value}`
                }),
                I,
                v.counter,
                !1
              )
            }
          };
        }
      }
      if (v.path.has(r.id) && Q(r)) {
        const y = zt(T[r.kind]);
        if (y)
          return {
            id: r.id,
            view: j,
            props: {
              render: () => ie(r, y(r, {
                engine: A,
                blockId: r.id,
                readonly: o.streaming === !0,
                children: () => r.children.map((E) => $e(E, v)),
                items: () => ke(r, v),
                version: C.value
              }), I, v.counter)
            }
          };
      }
      return {
        id: r.id,
        view: j,
        props: { render: () => ie(r, he(r), I, v.counter) }
      };
    }
    function Q(r) {
      return r.children.length > 0 && (r.kind === T.ListBlock || r.kind === T.Blockquote || r.kind === T.Callout || r.kind === T.Details);
    }
    const Z = /* @__PURE__ */ new Map();
    function ce(r) {
      let v = Z.get(r);
      return v || (v = new yo(A, r), Z.set(r, v)), v;
    }
    function be() {
      const r = [], v = L.value;
      return v && Array.from(v.querySelectorAll("[data-block-id]")).forEach((y, E) => {
        r.push({
          id: y.dataset.blockId ?? "",
          index: E,
          pos: E,
          el: y,
          top: y.offsetTop,
          height: y.offsetHeight
        });
      }), r;
    }
    function qe(r, v) {
      const I = J(A.doc, r);
      if (!I) return;
      const y = v && v !== r ? J(A.doc, v) : null, E = (y && kt(y) === y ? y : null) ?? kt(I) ?? I, F = new je(E.id, 0);
      A.select(new gt(F, F)), C.value++;
    }
    function N(r) {
      const v = al(r);
      if (v) {
        if (Array.from(Z.values()).some((I) => I.composition.composing)) return;
        r.preventDefault(), il(A, Z.values(), v) && w.value++;
        return;
      }
      if (r.ctrlKey && r.key === "End") {
        r.preventDefault();
        const I = So(A.doc);
        I && qe(I.id);
      }
    }
    function H() {
      const r = kt(A.doc);
      if (r) {
        const v = new je(r.id, 0);
        A.select(new gt(v, v));
      }
    }
    H();
    function P() {
      u("save", Ge(A.doc, !0));
    }
    return n({ getBlockMap: be, handleSave: P }), (r, v) => (p(), x("div", {
      ref_key: "root",
      ref: g,
      class: xe(["autodown-editor", { "is-dark": s.value }]),
      "data-accent": a.value
    }, [
      b("div", {
        ref_key: "wrapper",
        ref: L,
        class: "autodown-editor-content-wrapper"
      }, [
        b("div", {
          class: "autodown-editor-content",
          "data-engine-editor": "",
          tabindex: "-1",
          onKeydown: N
        }, [
          pt(ue(oa), {
            editor: ue(ne),
            items: ue(ae)
          }, null, 8, ["editor", "items"]),
          pt(Ul, { editor: ue(ne) }, null, 8, ["editor"]),
          pt(Yl, { editor: ue(ne) }, null, 8, ["editor"]),
          (p(!0), x(Ce, null, Ke(ge.value, (I) => (p(), ee(pe(I.view), Yn({
            key: I.id
          }, { ref_for: !0 }, I.props), null, 16))), 128))
        ], 32)
      ], 512),
      b("div", { class: "autodown-editor-actions" }, [
        b("button", {
          type: "button",
          class: "autodown-editor-save",
          onClick: P
        }, "Save")
      ])
    ], 10, ii));
  }
}), vi = "block-";
function mi(t) {
  const e = Array.from((t ?? document).querySelectorAll("[data-block-id]")), o = /* @__PURE__ */ new Set(), l = [];
  for (const a of e) {
    const i = a.dataset.blockId ?? "";
    i !== "" && o.has(i) || (i !== "" && o.add(i), l.push({ id: i, index: l.length, pos: l.length, el: a, top: a.offsetTop, height: a.offsetHeight }));
  }
  return l;
}
export {
  vi as B,
  ll as E,
  hi as _,
  $t as a,
  vl as c,
  mi as g,
  _t as s
};
