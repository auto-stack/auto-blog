#!/usr/bin/env python3
"""probe_t02_api.py — BLOG-002 T-02 API 定向验收（AC-03/AC-04 核心）。

前置: 后端 service --server rust 已起于隔离 AUTO_BLOG_DATA（T02_API）。
覆盖:
  T02-A1 compose 两来源（notes+reader copy）→ 新 work、source_refs=2、原正文并入、原件文件零改动
  T02-A2 reference 模式来源只登记不并入正文
  T02-A3 负例: 非法 JSON / 空 producer → 拒绝零写入
  T02-B1 add_asset_ref ×2 → asset_refs 2 条、正文图片行、revision 推进
  T02-B2 负例: 空 ref / 非法 mode → 拒绝；陈旧 rev → conflict
用法: python -I tests/probe/probe_t02_api.py
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
API = os.environ.get("T02_API", "http://127.0.0.1:17827")
FIX = REPO / "tests" / "fixtures" / "authoring"

results = []


def record(name, ok, detail):
    results.append(ok)
    print(f"{'PASS' if ok else 'FAIL'} {name} {json.dumps(detail, ensure_ascii=False)}", flush=True)


def http_json(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data, {"Content-Type": "application/json"}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            return resp.status, json.load(resp)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.load(e)
        except Exception:
            return e.code, {}


def file_sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()[:12]


def parse_refs(raw: str):
    """refs 存储形态 = JSON Lines（每行一个对象；"" 或 "[]" 视为空）。"""
    raw = (raw or "").strip()
    if not raw or raw == "[]":
        return []
    return [json.loads(ln) for ln in raw.splitlines() if ln.strip()]


def main():
    # 原件指纹（导入前后必须一致 —— AC-03 原数据不被修改）
    src_files = sorted(FIX.glob("*.json"))
    before = {p.name: file_sha(p) for p in src_files}

    # T02-A1 compose 两来源
    items = [
        json.loads((FIX / "notes-envelope-1.json").read_text(encoding="utf-8")),
        json.loads((FIX / "reader-quote-1.json").read_text(encoding="utf-8")),
    ]
    st, w = http_json("POST", f"{API}/api/drafts/import-compose", {"items": json.dumps(items, ensure_ascii=False)})
    ok1 = st == 200 and w.get("work_id", "").startswith("w-")
    refs = parse_refs(w.get("source_refs"))
    ok1 = ok1 and len(refs) == 2
    ok1 = ok1 and refs[0].get("producer") == "notes" and refs[0].get("source_revision") == 3 and refs[0].get("locator") == "inbox/2026/mtg-autodown#L1-L6"
    ok1 = ok1 and refs[1].get("producer") == "reader" and refs[1].get("source_revision") == 1
    body = w.get("body") or ""
    record("T02-A1-compose-two-sources", ok1 and w.get("body_format") == "markdown",
           {"status": st, "wid": w.get("work_id"), "refs": len(refs),
            "r0": refs[0] if refs else None, "body_has_both": ("会议纪要" in body and "有机单元" in body)})

    # 独立读回
    st1b, w1b = http_json("GET", f"{API}/api/drafts/{w.get('work_id')}")
    refs_b = parse_refs(w1b.get("source_refs"))
    record("T02-A1b-readback-source-refs", st1b == 200 and len(refs_b) == 2 and w1b.get("tags") == "imported",
           {"refs": len(refs_b), "tags": w1b.get("tags")})

    # 原件零改动
    after = {p.name: file_sha(p) for p in src_files}
    record("T02-A1c-sources-unmodified", before == after, {"before": before, "after": after})

    # T02-A2 reference 模式：不并入正文，仅登记
    items_ref = [json.loads((FIX / "reader-quote-reference.json").read_text(encoding="utf-8"))]
    st2, w2 = http_json("POST", f"{API}/api/drafts/import-compose", {"items": json.dumps(items_ref, ensure_ascii=False)})
    refs2 = parse_refs(w2.get("source_refs"))
    record("T02-A2-reference-mode-register-only", st2 == 200 and len(refs2) == 1 and refs2[0].get("mode") == "reference"
           and (w2.get("body") or "") == "",
           {"status": st2, "body_len": len(w2.get("body") or ""), "mode": refs2[0].get("mode") if refs2 else None})

    # T02-A3 负例：非法 JSON / 空 producer → 空串 work（拒绝零写入）
    st3, w3 = http_json("POST", f"{API}/api/drafts/import-compose", {"items": "{broken json"})
    st4, w4 = http_json("POST", f"{API}/api/drafts/import-compose",
                        {"items": json.dumps([{"producer": "", "body": "x"}], ensure_ascii=False)})
    record("T02-A3-negative-reject", w3.get("work_id") == "" and w4.get("work_id") == "",
           {"bad_json": w3.get("work_id", "?"), "empty_producer": w4.get("work_id", "?")})

    # T02-B1 资产追加 ×2（在 A1 作品上）
    wid = w.get("work_id")
    stb, rb = http_json("GET", f"{API}/api/drafts/{wid}")
    rev0 = rb.get("revision")
    stb1, r1 = http_json("POST", f"{API}/api/drafts/{wid}/asset-ref",
                         {"storage_ref": "https://example.com/img1.png", "caption": "图一说明", "mode": "copy", "expected_rev": rev0})
    stb2, r2 = http_json("POST", f"{API}/api/drafts/{wid}/asset-ref",
                         {"storage_ref": "https://example.com/img2.png", "caption": "", "mode": "copy", "expected_rev": r1.get("revision")})
    stc, wc = http_json("GET", f"{API}/api/drafts/{wid}")
    assets = parse_refs(wc.get("asset_refs"))
    okb = (stb1 == 200 and r1.get("ok") and stb2 == 200 and r2.get("ok")
           and len(assets) == 2
           and assets[0].get("caption") == "图一说明" and assets[0].get("mode") == "copy"
           and assets[0].get("sha256") is None and assets[0].get("asset_id", "").startswith("a-")
           and "![](https://example.com/img2.png)" in (wc.get("body") or "")
           and "![图一说明](https://example.com/img1.png)" in (wc.get("body") or ""))
    record("T02-B1-asset-refs-append", okb,
           {"status": (stb1, stb2), "assets": len(assets), "rev": wc.get("revision"),
            "img1": "![图一说明](https://example.com/img1.png)" in (wc.get("body") or "")})

    # T02-B2 负例：空 ref / 非法 mode / 陈旧 rev
    rev_now = wc.get("revision")
    stn1, rn1 = http_json("POST", f"{API}/api/drafts/{wid}/asset-ref",
                          {"storage_ref": "", "caption": "", "mode": "copy", "expected_rev": rev_now})
    stn2, rn2 = http_json("POST", f"{API}/api/drafts/{wid}/asset-ref",
                          {"storage_ref": "x.png", "caption": "", "mode": "paste", "expected_rev": rev_now})
    stn3, rn3 = http_json("POST", f"{API}/api/drafts/{wid}/asset-ref",
                          {"storage_ref": "y.png", "caption": "", "mode": "copy", "expected_rev": 1})
    okn = (rn1.get("error") == "empty_ref" and rn2.get("error") == "bad_mode"
           and rn3.get("conflict") is True and rn3.get("revision") == rev_now)
    record("T02-B2-negative-and-conflict", okn,
           {"empty": rn1.get("error"), "mode": rn2.get("error"), "stale_rev": rn3.get("revision"), "conflict": rn3.get("conflict")})

    passed = sum(1 for r in results if r)
    print(f"SUMMARY {json.dumps({'passed': passed, 'failed': len(results) - passed})}")
    return 0 if passed == len(results) else 1



if __name__ == "__main__":
    sys.exit(main())
