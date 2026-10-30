#!/usr/bin/env python3
"""export_offline_t04.py — BLOG-003 T-04 定向验收：AC-01 换目录离线打开闭环。

前置: 后端 service --server rust 于 T04_API（隔离 AUTO_BLOG_DATA=T04_DATA）。
    T04_API=http://127.0.0.1:17833 T04_DATA=D:/autostack/auto-blog/.tmp/t04-offline-data \
        python tests/probe/export_offline_t04.py

闭环语义：发布包自包含——把 exports/<pid> 拷贝到数据目录之外的全新位置后，
将原数据目录改名移走（=换目录+数据不可达），拷贝包仍逐文件完整校验通过：
正文冻结、资产 b64 解码 sha256 与原件一致（AC-01）、manifest 含迁出解码说明、
零网络引用（断网可用）。 """
from __future__ import annotations

import base64
import hashlib
import json
import os
import shutil
import sys
import tempfile
import urllib.request

API = os.environ.get("T04_API", "http://127.0.0.1:17833")
DATA = os.environ.get("T04_DATA", "")
results = []


def record(name, ok, detail):
    results.append(ok)
    print(f"{'PASS' if ok else 'FAIL'} {name} {json.dumps(detail, ensure_ascii=False)}", flush=True)


def http_json(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data, {"Content-Type": "application/json"}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.load(resp)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.load(e)
        except Exception:
            return e.code, {}


def main():
    if not DATA:
        print("SKIP T04_DATA not set")
        return 1

    body_v1 = "# 离线闭环稿\n\n中文正文与**加粗**。\n\n- 列表甲\n- 列表乙\n\n> 引用一行。\n\n结尾。"
    st, w = http_json("POST", f"{API}/api/drafts",
                      {"title": "离线闭环稿", "body": body_v1, "format": "markdown"})
    wid = w["work_id"]

    # 两图（非 PNG 头也行——管道按 b64 文本无损；sha256 对解码字节断言）
    assets = []
    for i, size in enumerate((512, 333)):
        raw = bytes((i * 31 + j * 7) % 256 for j in range(size))
        assets.append({"raw": raw, "b64": base64.b64encode(raw).decode(),
                       "sha256": hashlib.sha256(raw).hexdigest(), "mime": "image/png"})
    rev = 1
    aids = []
    for a in assets:
        st2, r = http_json("POST", f"{API}/api/drafts/{wid}/asset-b64",
                           {"b64": a["b64"], "sha256": a["sha256"], "mime": a["mime"],
                            "caption": f"离线图{len(aids)+1}", "expected_rev": rev})
        if not (st2 == 200 and r.get("ok")):
            record("OFF-01-ingest", False, {"err": r.get("error")})
            return 1
        rev = r["revision"]
    _, wcur = http_json("GET", f"{API}/api/drafts/{wid}")
    import re as _re
    aids = _re.findall(r'assets/(a-[0-9-]+\.b64)', wcur.get("body", ""))
    frozen_expected = wcur["body"]  # ingest 附加图片行后的冻结体基准
    ok01 = len(aids) == 2 and wcur.get("revision") == 3
    record("OFF-01-ingest", ok01, {"aids": aids, "rev": wcur.get("revision")})
    if not ok01:
        return 1

    st3, p = http_json("POST", f"{API}/api/works/{wid}/publish", {"expected_rev": 3})
    pid = p.get("publication_id", "")
    st4, ex = http_json("POST", f"{API}/api/publications/{pid}/export", {"format": "markdown"})
    ok02 = p.get("ok") and ex.get("ok") and ex.get("state") == "exported"
    record("OFF-02-publish-export", ok02, {"pid": pid, "state": ex.get("state")})
    if not ok02:
        return 1

    # OFF-03 换目录：包拷贝到数据目录之外的全新位置
    src = os.path.join(DATA, "exports", pid)
    dst_root = tempfile.mkdtemp(prefix="t04-offline-")
    dst = os.path.join(dst_root, "release-package")
    shutil.copytree(src, dst)
    record("OFF-03-relocate-copy", os.path.isfile(os.path.join(dst, "article.md")),
           {"dst": dst})

    # OFF-04 数据目录移走（= 原位置不可达；模拟换目录后原环境不在）
    data_gone = os.path.join(DATA + ".moved-away-t04")
    os.rename(DATA, data_gone)
    try:
        # 包逐文件校验（完全自包含，不依赖数据目录）
        art = open(os.path.join(dst, "article.md"), encoding="utf-8").read()
        ok_body = art == frozen_expected
        ok_assets = True
        detail_sha = []
        for a, aid in zip(assets, aids):
            b64_text = open(os.path.join(dst, "assets", aid), encoding="ascii").read()
            decoded = base64.b64decode(b64_text)  # = manifest decode 说明的等价操作
            sha = hashlib.sha256(decoded).hexdigest()
            detail_sha.append(sha == a["sha256"])
            if b64_text != a["b64"] or sha != a["sha256"] or decoded != a["raw"]:
                ok_assets = False
        man = json.loads(open(os.path.join(dst, "manifest.json"), encoding="utf-8").read())
        ok_manifest = (man["content_hash"] and man["publication_id"] == pid
                       and "certutil" in man["decode"] and "base64 -d" in man["decode"])
        ok_ok = os.path.isfile(os.path.join(dst, ".ok"))
        # 零网络引用（断网可用）；零绝对路径
        leak = []
        for root, _d, files in os.walk(dst):
            for fn in files:
                t = open(os.path.join(root, fn), encoding="utf-8", errors="ignore").read()
                if "://" in t or ("data_root_marker" in t):
                    leak.append(fn)
        ok04 = ok_body and ok_assets and ok_manifest and ok_ok and not leak
        record("OFF-04-standalone-verify", ok04,
               {"body": ok_body, "assets_sha": detail_sha, "manifest": ok_manifest,
                "ok_marker": ok_ok, "network_leaks": leak})
    finally:
        os.rename(data_gone, DATA)

    # OFF-05 数据目录复位后，原包与拷贝包逐字节一致
    same = True
    for rel in ("article.md", "manifest.json", ".ok", f"assets/{aids[0]}", f"assets/{aids[1]}"):
        a = open(os.path.join(src, *rel.split("/")), "rb").read()
        b = open(os.path.join(dst, *rel.split("/")), "rb").read()
        if a != b:
            same = False
    shutil.rmtree(dst_root, ignore_errors=True)
    record("OFF-05-copy-byte-identical", same, {"same": same})

    passed = sum(1 for r in results if r)
    print(f"SUMMARY {json.dumps({'passed': passed, 'failed': len(results) - passed})}")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
