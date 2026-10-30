#!/usr/bin/env python3
"""probe_export_md.py — BLOG-003 T-02 定向验收：b64 资产入库 + 本地 Markdown 导出包电池。

前置: 后端 service --server rust 于 EXP_API（隔离 AUTO_BLOG_DATA=EXP_DATA）。
    EXP_API=http://127.0.0.1:17833 EXP_DATA=D:/autostack/auto-blog/.tmp/t02-export-data \
        python tests/probe/probe_export_md.py
覆盖（对应计划 AC）:
    AC-01  EXP-03/04  中文+列表+引用+两图导出；资产 b64 解码 sha256 与原件一致
    AC-02  EXP-05     v2 导出后 v1 包逐文件字节不变、v1 元数据不变
    AC-03  EXP-06/07/08/09  重试不覆盖已存在不同版本；缺资产/不可写→无 exported；
                     中断形态（无 .ok）重试可补齐
    AC-04  EXP-04/10  包内零绝对本机路径；external 引用不打包不改写泄漏
    AC-05  EXP-11     withdrawn/html 拒绝导出；target=local 不伪装 published
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import sys
import urllib.request

API = os.environ.get("EXP_API", "http://127.0.0.1:17833")
DATA = os.environ.get("EXP_DATA", "")
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


def pkg_file(pid, rel):
    return os.path.join(DATA, "exports", pid, *rel.split("/"))


def read_pkg(pid, rel):
    with open(pkg_file(pid, rel), "rb") as f:
        return f.read()


def pkg_snapshot(pid):
    """包内全部文件的 {rel: bytes} 快照（含 .ok；assets/ 递归）。"""
    base = os.path.join(DATA, "exports", pid)
    out = {}
    for root, _dirs, files in os.walk(base):
        for fn in files:
            full = os.path.join(root, fn)
            rel = os.path.relpath(full, base).replace("\\", "/")
            with open(full, "rb") as f:
                out[rel] = f.read()
    return out


def abs_path_leak(text):
    """AC-04 扫描：数据根绝对路径 / 盘符路径 / .. 越界段。"""
    hits = []
    if DATA and DATA.lower() in text.lower():
        hits.append("data_root")
    if re.search(r"[A-Za-z]:[\\/]", text):
        hits.append("drive_letter")
    if re.search(r"\.\.[\\/]", text):
        hits.append("dotdot")
    return hits


BODY_V1 = "# 中文导出稿\n\n正文第一段，含**加粗**与`代码`。\n\n- 列表甲\n- 列表乙\n- 列表丙\n\n> 引用一行：离线自包含。\n\n结尾。"


def make_asset(tag, size=320):
    raw = bytes((i * 7 + ord(tag[0])) % 256 for i in range(size))
    return raw, base64.b64encode(raw).decode(), hashlib.sha256(raw).hexdigest()


def main():
    if not DATA:
        print("SKIP EXP_DATA not set")
        return 1

    # EXP-01 D1 ingest：中文稿 + 两个 b64 资产（caption 含中文）
    st, w = http_json("POST", f"{API}/api/drafts",
                      {"title": "导出电池稿", "body": BODY_V1, "format": "markdown"})
    wid = w["work_id"]
    raw1, b1, h1 = make_asset("a")
    raw2, b2, h2 = make_asset("b", 200)
    st1, r1 = http_json("POST", f"{API}/api/drafts/{wid}/asset-b64",
                        {"b64": b1, "sha256": h1, "mime": "image/png", "caption": "图甲·示意", "expected_rev": 1})
    st2, r2 = http_json("POST", f"{API}/api/drafts/{wid}/asset-b64",
                        {"b64": b2, "sha256": h2, "mime": "image/jpeg", "caption": "图乙", "expected_rev": 2})
    st3, wcur = http_json("GET", f"{API}/api/drafts/{wid}")
    refs = wcur.get("asset_refs", "")
    ok1 = (st1 == 200 and r1.get("ok") and st2 == 200 and r2.get("ok")
           and wcur.get("revision") == 3
           and f"![图甲·示意](assets/" in wcur.get("body", "")
           and f'"sha256":"{h1}"' in refs and f'"sha256":"{h2}"' in refs
           and '"size":' + str(len(b1)) in refs and '"size":' + str(len(b2)) in refs)
    record("EXP-01-b64-ingest", ok1, {"wid": wid, "rev": wcur.get("revision"),
                                      "sha_in_refs": h1 in refs and h2 in refs})
    aid1 = json.loads('[' + refs.replace("\n", ",") + ']')[0]["asset_id"]
    aid2 = json.loads('[' + refs.replace("\n", ",") + ']')[1]["asset_id"]
    expected_body = wcur["body"]  # ingest 追加图片行后的冻结体基准（EXP-04 用）

    # EXP-02 ingest 负例：空 b64 / 坏 sha256 / 陈旧 rev / 不存在 work
    _, n1 = http_json("POST", f"{API}/api/drafts/{wid}/asset-b64",
                      {"b64": "", "sha256": h1, "mime": "image/png", "caption": "", "expected_rev": 3})
    _, n2 = http_json("POST", f"{API}/api/drafts/{wid}/asset-b64",
                      {"b64": b1, "sha256": "abc", "mime": "image/png", "caption": "", "expected_rev": 3})
    _, n3 = http_json("POST", f"{API}/api/drafts/{wid}/asset-b64",
                      {"b64": b1, "sha256": h1, "mime": "image/png", "caption": "", "expected_rev": 99})
    _, n4 = http_json("POST", f"{API}/api/drafts/w-nope/asset-b64",
                      {"b64": b1, "sha256": h1, "mime": "image/png", "caption": "", "expected_rev": 0})
    ok2 = (n1.get("error") == "bad_b64" and n2.get("error") == "bad_sha256"
           and n3.get("error") == "conflict" and n4.get("error") == "not_found")
    record("EXP-02-ingest-negatives", ok2,
           {"bad_b64": n1.get("error"), "bad_sha": n2.get("error"),
            "conflict": n3.get("error"), "not_found": n4.get("error")})

    # EXP-03 快照 + 导出成功路径（AC-01 正控）
    _, p1 = http_json("POST", f"{API}/api/works/{wid}/publish", {"expected_rev": 3})
    pid = p1.get("publication_id", "")
    stx, ex = http_json("POST", f"{API}/api/publications/{pid}/export", {"format": "markdown"})
    ok3 = (p1.get("ok") and stx == 200 and ex.get("ok") and ex.get("state") == "exported"
           and ex.get("package") == f"exports/{pid}"
           and os.path.isfile(pkg_file(pid, "article.md"))
           and os.path.isfile(pkg_file(pid, "manifest.json"))
           and os.path.isfile(pkg_file(pid, ".ok"))
           and os.path.isfile(pkg_file(pid, f"assets/{aid1}.b64"))
           and os.path.isfile(pkg_file(pid, f"assets/{aid2}.b64")))
    record("EXP-03-snapshot-export", ok3, {"pid": pid, "state": ex.get("state"),
                                           "pkg": ex.get("package"), "err": ex.get("error")})

    # EXP-04 包完整性（AC-01 hash 保真 + AC-04 无绝对路径）
    art = read_pkg(pid, "article.md").decode("utf-8")
    man = json.loads(read_pkg(pid, "manifest.json").decode("utf-8"))
    _, g0 = http_json("GET", f"{API}/api/publications/{pid}")
    v1_hash = g0.get("content_hash", "")
    b64_back1 = read_pkg(pid, f"assets/{aid1}.b64").decode()
    b64_back2 = read_pkg(pid, f"assets/{aid2}.b64").decode()
    dec1 = hashlib.sha256(base64.b64decode(b64_back1)).hexdigest()
    dec2 = hashlib.sha256(base64.b64decode(b64_back2)).hexdigest()
    leak_texts = []
    for rel in os.listdir(os.path.join(DATA, "exports", pid)):
        full = os.path.join(DATA, "exports", pid, rel)
        if os.path.isfile(full):
            leak_texts += abs_path_leak(open(full, "r", encoding="utf-8", errors="ignore").read())
    for fn in os.listdir(os.path.join(DATA, "exports", pid, "assets")):
        leak_texts += abs_path_leak(open(os.path.join(DATA, "exports", pid, "assets", fn),
                                         "r", encoding="utf-8", errors="ignore").read())
    status_by_id = {a["asset_id"]: a["status"] for a in man["assets"]}
    ok4 = (art == expected_body
           and dec1 == h1 and dec2 == h2
           and man["manifest_version"] == 1 and man["format"] == "markdown"
           and man["publication_id"] == pid and man["work_revision"] == 3
           and man["content_hash"] == v1_hash
           and "certutil" in man.get("decode", "") and "base64 -d" in man.get("decode", "")
           and status_by_id.get(aid1) == "packaged" and status_by_id.get(aid2) == "packaged"
           and not leak_texts)
    record("EXP-04-package-integrity", ok4,
           {"art_eq_frozen": art == expected_body, "sha1": dec1 == h1, "sha2": dec2 == h2,
            "hash_match": man["content_hash"] == v1_hash, "leaks": leak_texts[:3]})

    # EXP-05 v2 导出后 v1 包不变（AC-02）
    snap_v1 = pkg_snapshot(pid)
    http_json("PUT", f"{API}/api/drafts/{wid}",
              {"title": "导出电池稿v2", "summary": "", "body": "# v2 改稿\n\n新正文。",
               "tags": "", "cover": "", "format": "markdown", "expected_rev": 3})
    _, p2 = http_json("POST", f"{API}/api/works/{wid}/publish", {"expected_rev": 4})
    pid2 = p2.get("publication_id", "")
    _, ex2 = http_json("POST", f"{API}/api/publications/{pid2}/export", {"format": "markdown"})
    snap_v1_after = pkg_snapshot(pid)
    _, g1 = http_json("GET", f"{API}/api/publications/{pid}")
    ok5 = (ex2.get("ok") and ex2.get("state") == "exported"
           and snap_v1 == snap_v1_after
           and g1.get("work_revision") == 3 and g1.get("content_hash") == v1_hash)
    record("EXP-05-v2-v1-immutable", ok5, {"pid2": pid2, "v1_bytes_stable": snap_v1 == snap_v1_after,
                                           "v1_meta_stable": g1.get("content_hash") == v1_hash})

    # EXP-06 幂等重导出：状态保持、包不变、不重复记录
    _, ex1b = http_json("POST", f"{API}/api/publications/{pid}/export", {"format": "markdown"})
    snap_v1_re = pkg_snapshot(pid)
    _, g1b = http_json("GET", f"{API}/api/publications/{pid}")
    n_rec = g1b.get("export_refs", "").count('"format":"markdown"')
    ok6 = (ex1b.get("ok") and ex1b.get("state") == "exported"
           and snap_v1 == snap_v1_re and n_rec == 1)
    record("EXP-06-reexport-idempotent", ok6, {"state": ex1b.get("state"),
                                               "bytes_stable": snap_v1 == snap_v1_re, "records": n_rec})

    # EXP-07 重试不覆盖已存在不同版本（AC-03）：
    # a) 版本身份在 .ok 提交清单——.ok 携不同 content_hash → exists_conflict 且包零触碰
    ok_path = pkg_file(pid, ".ok")
    orig_ok = open(ok_path, "rb").read()
    tampered_ok = orig_ok.decode("utf-8").replace(v1_hash, "sig-FOREIGN-0-0")
    open(ok_path, "w", encoding="utf-8", newline="").write(tampered_ok)
    _, ex_t = http_json("POST", f"{API}/api/publications/{pid}/export", {"format": "markdown"})
    ok_after = open(ok_path, "rb").read()
    open(ok_path, "wb").write(orig_ok)  # 还原 .ok，再测 (b)
    # b) 包内容被外部改动（manifest 篡改）而 .ok 完好 → 幂等分支不修复=不覆盖用户包
    man_path = pkg_file(pid, "manifest.json")
    orig_man = open(man_path, "rb").read()
    tampered_man = orig_man.decode("utf-8").replace(v1_hash, "sig-TAMPERED-0-0")
    open(man_path, "w", encoding="utf-8", newline="").write(tampered_man)
    _, ex_t2 = http_json("POST", f"{API}/api/publications/{pid}/export", {"format": "markdown"})
    man_after = open(man_path, "rb").read()
    ok7 = (ex_t.get("ok") is False and ex_t.get("error") == "exists_conflict"
           and ok_after == tampered_ok.encode("utf-8")
           and ex_t2.get("ok") is True
           and man_after == tampered_man.encode("utf-8"))
    record("EXP-07-retry-no-overwrite", ok7, {"conflict": ex_t.get("error"),
                                              "ok_preserved": ok_after == tampered_ok.encode("utf-8"),
                                              "idempotent_ok": ex_t2.get("ok"),
                                              "man_not_clobbered": man_after == tampered_man.encode("utf-8")})
    open(man_path, "wb").write(orig_man)  # 还原，供后续用例

    # EXP-08 缺资产：导出失败、状态不迁移、无 .ok（AC-03）
    _, w3 = http_json("POST", f"{API}/api/drafts", {"title": "缺资产稿", "body": "正文三。", "format": "text"})
    wid3 = w3["work_id"]
    _, _, h3 = make_asset("c", 64)
    b3 = base64.b64encode(b"x" * 48).decode()
    _, r3 = http_json("POST", f"{API}/api/drafts/{wid3}/asset-b64",
                      {"b64": b3, "sha256": h3, "mime": "image/png", "caption": "图丙", "expected_rev": 1})
    _, w3cur = http_json("GET", f"{API}/api/drafts/{wid3}")
    aid3 = json.loads('[' + w3cur["asset_refs"].replace("\n", ",") + ']')[0]["asset_id"]
    _, p3 = http_json("POST", f"{API}/api/works/{wid3}/publish", {"expected_rev": 2})
    pid3 = p3.get("publication_id", "")
    os.remove(os.path.join(DATA, "assets", f"{aid3}.b64"))
    _, ex3 = http_json("POST", f"{API}/api/publications/{pid3}/export", {"format": "markdown"})
    _, g3 = http_json("GET", f"{API}/api/publications/{pid3}")
    ok8 = (ex3.get("ok") is False and ex3.get("error") == "missing_asset"
           and g3.get("state") == "snapshotted"
           and not os.path.isfile(pkg_file(pid3, ".ok")))
    record("EXP-08-missing-asset", ok8, {"error": ex3.get("error"), "state": g3.get("state")})

    # EXP-09 不可写：包路径被文件占位 → 落地失败、状态不迁移（AC-03）
    _, w4 = http_json("POST", f"{API}/api/drafts", {"title": "不可写稿", "body": "正文四。", "format": "text"})
    _, p4 = http_json("POST", f"{API}/api/works/{w4['work_id']}/publish", {"expected_rev": 0})
    pid4 = p4.get("publication_id", "")
    with open(os.path.join(DATA, "exports", pid4), "w") as f:
        f.write("not-a-dir")
    _, ex4 = http_json("POST", f"{API}/api/publications/{pid4}/export", {"format": "markdown"})
    _, g4 = http_json("GET", f"{API}/api/publications/{pid4}")
    ok9 = (ex4.get("ok") is False and ex4.get("error") in ("staging_write_failed", "commit_failed")
           and g4.get("state") == "snapshotted")
    record("EXP-09-unwritable", ok9, {"error": ex4.get("error"), "state": g4.get("state")})
    os.remove(os.path.join(DATA, "exports", pid4))
    # 中断形态重试可补齐：同 pub 现在正常导出应成功（无 .ok=允许覆写）
    _, ex4b = http_json("POST", f"{API}/api/publications/{pid4}/export", {"format": "markdown"})
    ok9b = ex4b.get("ok") and ex4b.get("state") == "exported" and os.path.isfile(pkg_file(pid4, ".ok"))
    record("EXP-09b-retry-after-interrupt", ok9b, {"state": ex4b.get("state")})

    # EXP-10 external 引用隔离（AC-04）：本机绝对路径不打包、正文改写不泄漏
    _, w5 = http_json("POST", f"{API}/api/drafts",
                      {"title": "外部引用稿", "body": "正文五。\n\n![私密](D:/private/secret.png)\n", "format": "markdown"})
    _, a5 = http_json("POST", f"{API}/api/drafts/{w5['work_id']}/asset-ref",
                      {"storage_ref": "D:/private/secret.png", "caption": "私密", "mode": "copy", "expected_rev": 1})
    _, p5 = http_json("POST", f"{API}/api/works/{w5['work_id']}/publish", {"expected_rev": 0})
    pid5 = p5.get("publication_id", "")
    _, ex5 = http_json("POST", f"{API}/api/publications/{pid5}/export", {"format": "markdown"})
    art5 = read_pkg(pid5, "article.md").decode("utf-8")
    man5 = json.loads(read_pkg(pid5, "manifest.json").decode("utf-8"))
    leaks5 = abs_path_leak(art5)
    ok10 = (a5.get("ok") and ex5.get("ok")
            and "D:/private" not in art5 and "]()" in art5
            and not leaks5
            and any(a["status"] == "external" for a in man5["assets"])
            and man5["external_refs_rewritten"] >= 1)
    record("EXP-10-external-isolated", ok10, {"leaks": leaks5,
                                              "statuses": [a["status"] for a in man5["assets"]],
                                              "rewritten": man5["external_refs_rewritten"]})

    # EXP-11 状态机与格式门（AC-05）：withdrawn 拒绝 / html 拒绝 / 不存在 / remote 登记
    _, wd = http_json("POST", f"{API}/api/publications/{pid2}/withdraw")
    _, ex_w = http_json("POST", f"{API}/api/publications/{pid2}/export", {"format": "markdown"})
    _, ex_h = http_json("POST", f"{API}/api/publications/{pid}/export", {"format": "html"})
    _, ex_n = http_json("POST", f"{API}/api/publications/p-nope/export", {"format": "markdown"})
    _, w6 = http_json("POST", f"{API}/api/drafts", {"title": "远程图稿", "body": "正文六。", "format": "markdown"})
    _, ar6 = http_json("POST", f"{API}/api/drafts/{w6['work_id']}/asset-ref",
                       {"storage_ref": "https://example.com/x.png", "caption": "网图", "mode": "reference", "expected_rev": 1})
    _, p6 = http_json("POST", f"{API}/api/works/{w6['work_id']}/publish", {"expected_rev": 0})
    pid6 = p6.get("publication_id", "")
    _, ex6 = http_json("POST", f"{API}/api/publications/{pid6}/export", {"format": "markdown"})
    man6 = json.loads(read_pkg(pid6, "manifest.json").decode("utf-8"))
    art6 = read_pkg(pid6, "article.md").decode("utf-8")
    _, g2 = http_json("GET", f"{API}/api/publications/{pid}")
    ok11 = (ar6.get("ok")
            and wd.get("state") == "withdrawn"
            and ex_w.get("ok") is False and ex_w.get("error") == "withdrawn_not_exportable"
            and ex_h.get("ok") is False and ex_h.get("error") == "bad_format"
            and ex_n.get("ok") is False and ex_n.get("error") == "not_found"
            and ex6.get("ok") and "https://example.com/x.png" in art6
            and any(a["status"] == "remote" for a in man6["assets"])
            and g2.get("target") == "local" and g2.get("state") == "exported")
    record("EXP-11-state-and-format-gate", ok11,
           {"ar_ok": ar6.get("ok"), "withdrawn": ex_w.get("error"), "html": ex_h.get("error"),
            "nf": ex_n.get("error"), "remote_export_ok": ex6.get("ok"),
            "remote_kept": "https://example.com/x.png" in art6,
            "statuses": [a["status"] for a in man6["assets"]]})

    # EXP-12 快照只读面：冻结正文 == 冻结体基准；未知 pid → ""
    stc, content = http_json("GET", f"{API}/api/publications/{pid}/content")
    stc2, content_nf = http_json("GET", f"{API}/api/publications/p-nope/content")
    # pid2 = v2 快照，其正文应为 v2 改稿（非 v1）
    stc3, content2 = http_json("GET", f"{API}/api/publications/{pid2}/content")
    ok12 = (stc == 200 and content == expected_body
            and content_nf == ""
            and content2 == "# v2 改稿\n\n新正文。")
    record("EXP-12-publication-content", ok12,
           {"v1_eq": content == expected_body, "nf_empty": content_nf == "",
            "v2_eq": content2 == "# v2 改稿\n\n新正文。"})

    # EXP-13 快照资产读取：b64/mime/sha256 对上 ingest 声明；未引用 → b64 ""
    # （str 返回端点的 HTTP body 是 JSON 字符串——信封需二次解析）
    sta, a1raw = http_json("POST", f"{API}/api/publications/{pid}/asset", {"asset_id": aid1})
    a1r = json.loads(a1raw) if isinstance(a1raw, str) else a1raw
    sta2, a_nfraw = http_json("POST", f"{API}/api/publications/{pid}/asset", {"asset_id": "a-unknown-9"})
    a_nf = json.loads(a_nfraw) if isinstance(a_nfraw, str) else a_nfraw
    sta3, a_evraw = http_json("POST", f"{API}/api/publications/{pid}/asset", {"asset_id": "../escape"})
    a_ev = json.loads(a_evraw) if isinstance(a_evraw, str) else a_evraw
    ok13 = (a1r.get("b64") == b1 and a1r.get("sha256") == h1 and a1r.get("mime") == "image/png"
            and a_nf.get("b64") == "" and a_ev.get("b64") == "")
    record("EXP-13-publication-asset", ok13,
           {"b64_eq": a1r.get("b64") == b1, "sha_eq": a1r.get("sha256") == h1,
            "nf": a_nf.get("b64") == "", "traversal": a_ev.get("b64") == ""})

    # EXP-14 采集 HTML 入库（正控）：fixture 自包含 HTML → index.html 落地 + export_refs 登记
    html_fixture = ("<!DOCTYPE html><html><head><meta charset=\"utf-8\">"
                    "<title>导出电池稿</title></head><body>"
                    f"<h1>导出电池稿</h1><p>离线自包含。</p>"
                    f"<img alt=\"图甲·示意\" src=\"data:image/png;base64,{b1}\">"
                    "</body></html>")
    sth, hx = http_json("POST", f"{API}/api/publications/{pid}/html", {"html": html_fixture})
    idx_on_disk = read_pkg(pid, "index.html").decode("utf-8")
    _, g1c = http_json("GET", f"{API}/api/publications/{pid}")
    n_html = g1c.get("export_refs", "").count('"format":"html"')
    # 重复采集：同内容幂等（条目无时间戳 → 去重为 1）
    sth2, hx2 = http_json("POST", f"{API}/api/publications/{pid}/html", {"html": html_fixture})
    _, g1d = http_json("GET", f"{API}/api/publications/{pid}")
    n_html2 = g1d.get("export_refs", "").count('"format":"html"')
    ok14 = (sth == 200 and hx.get("ok")
            and idx_on_disk == html_fixture
            and n_html == 1 and n_html2 == 1
            and hx2.get("ok") and hx2.get("state") == "exported")
    record("EXP-14-html-ingest", ok14,
           {"ok": hx.get("ok"), "disk_eq": idx_on_disk == html_fixture,
            "records": n_html, "records_after_re": n_html2, "err": hx.get("error")})

    # EXP-15 HTML 入库负例：未导出包 / 空 html / 绝对路径 / withdrawn；状态均不变
    _, hx_a = http_json("POST", f"{API}/api/publications/{pid3}/html", {"html": "<html></html>"})
    _, hx_b = http_json("POST", f"{API}/api/publications/{pid}/html", {"html": ""})
    _, hx_c = http_json("POST", f"{API}/api/publications/{pid}/html",
                        {"html": f"<img src=\"file:///{DATA}/assets/x.png\">"})
    _, hx_d = http_json("POST", f"{API}/api/publications/{pid2}/html", {"html": "<html>hi</html>"})
    _, g3b = http_json("GET", f"{API}/api/publications/{pid3}")
    _, g4b = http_json("GET", f"{API}/api/publications/{pid4}")
    ok15 = (hx_a.get("ok") is False and hx_a.get("error") == "not_exported"
            and hx_b.get("ok") is False and hx_b.get("error") == "bad_html"
            and hx_c.get("ok") is False and hx_c.get("error") == "abs_path_rejected"
            and hx_d.get("ok") is False and hx_d.get("error") == "withdrawn_not_exportable"
            and g3b.get("state") == "snapshotted" and g4b.get("state") == "exported")
    record("EXP-15-html-negatives", ok15,
           {"not_exported": hx_a.get("error"), "bad_html": hx_b.get("error"),
            "abs_path": hx_c.get("error"), "withdrawn": hx_d.get("error"),
            "states": [g3b.get("state"), g4b.get("state")]})

    passed = sum(1 for r in results if r)
    print(f"SUMMARY {json.dumps({'passed': passed, 'failed': len(results) - passed})}")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
