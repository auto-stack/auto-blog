#!/usr/bin/env python3
"""probe_vm_t02.py — BLOG-002 T-02 定向验收（原生 VM 轨）：资产添加 + 粘贴导入组合。

    python -I tests/probe/probe_vm_t02.py
前置端口: FRONT=17842 BACK=17843（可环境变量覆盖）。退出码 0=全过。
"""
from __future__ import annotations

import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
AUTO_EXE = Path(os.environ.get("AUTO_EXE", r"D:\autostack\auto-man\target\debug\auto.exe"))
FRONT = int(os.environ.get("PROBE_FRONT", "17842"))
BACK = int(os.environ.get("PROBE_BACK", "17843"))
DATA = REPO / ".tmp" / "t02-vm-data"
FIX = REPO / "tests" / "fixtures" / "authoring"

results = []


def record(name, ok, detail):
    results.append(ok)
    print(f"{'PASS' if ok else 'FAIL'} {name} {json.dumps(detail, ensure_ascii=False)}", flush=True)


class Mcp:
    def __init__(self, port):
        self.port = port

    def call(self, name, arguments=None):
        payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                   "params": {"name": name, "arguments": arguments or {}}}
        req = urllib.request.Request(
            f"http://127.0.0.1:{self.port}/mcp", json.dumps(payload).encode(),
            {"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as response:
            envelope = json.load(response)
        if "error" in envelope:
            raise RuntimeError(str(envelope["error"]))
        result = envelope["result"]
        if result.get("isError"):
            raise RuntimeError(str(result))
        return "\n".join(item.get("text", "") for item in result.get("content", []))

    def snapshot(self):
        return self.call("autoui_snapshot", {"mode": "rendered"})

    def press(self, element):
        return self.call("autoui_action", {"element_id": element, "action": "press"})

    def fill(self, element, text):
        return self.call("autoui_type", {"element_id": element, "text": text, "clear_first": True})


def wait(check, message, timeout=40):
    deadline = time.monotonic() + timeout
    last = ""
    while time.monotonic() < deadline:
        try:
            value = check()
            if value:
                return value
        except (OSError, RuntimeError, ValueError) as error:
            last = str(error)
        time.sleep(0.2)
    raise AssertionError(f"{message}; last={last[:200]}")


def control(snapshot, kind, placeholder=None, label=None):
    for match in re.finditer(r"(?m)^\s*" + kind + r" #(\S+)([^\n]*)(?:\n((?:(?!\s*\}).*\n)*))?", snapshot):
        header, body = match[2], match[3] or ""
        if label is not None and json.dumps(label, ensure_ascii=False) not in header:
            continue
        if placeholder is not None and f'placeholder: {json.dumps(placeholder, ensure_ascii=False)}' not in body:
            continue
        return match[1]
    raise AssertionError(f"missing {kind} {placeholder or label}")


def http_json(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data, {"Content-Type": "application/json"}, method=method)
    with urllib.request.urlopen(req, timeout=6) as resp:
        return json.load(resp)


def parse_refs(raw):
    raw = (raw or "").strip()
    if not raw or raw == "[]":
        return []
    return [json.loads(ln) for ln in raw.splitlines() if ln.strip()]


def main():
    DATA.mkdir(parents=True, exist_ok=True)
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        mcp_port = s.getsockname()[1]
    client = Mcp(mcp_port)
    logf = open(DATA / f"vm-t02-{int(time.time())}.log", "w", encoding="utf-8", errors="replace")
    env = dict(os.environ)
    env["AUTO_BLOG_DATA"] = str(DATA)
    env["AUTOUI_MCP_PORT"] = str(mcp_port)
    argv = [str(AUTO_EXE), "run", "--server", "rust", "-r", "vm",
            "-F", str(FRONT), "-B", str(BACK), "-d", str(REPO)]
    proc = subprocess.Popen(argv, cwd=str(REPO), env=env, stdin=subprocess.PIPE,
                            stdout=logf, stderr=subprocess.STDOUT)
    try:
        wait(lambda: http_json("GET", f"http://127.0.0.1:{BACK}/api/drafts") is not None,
             "backend not ready", timeout=180)
        wait(lambda: (s if "新建草稿" in (s := client.snapshot()) else None), "author page")
        client.press(control(client.snapshot(), "button", label="新建草稿"))
        wait(lambda: (s if "空稿可直接输入" in (s := client.snapshot()) else None), "empty start face")

        # VM-T02-01 添加图片（说明→alt 行；资产入 refs）
        client.fill(control(client.snapshot(), "input", placeholder="图片引用（URL/路径）"),
                    "https://example.com/vmt02.png")
        client.fill(control(client.snapshot(), "input", placeholder="图片说明（可选）"), "VM图说明")
        client.press(control(client.snapshot(), "button", label="添加图片"))
        wait(lambda: (s if "![VM图说明](https://example.com/vmt02.png)" in (s := client.snapshot()) else None),
             "asset markdown line missing in editor")
        wid = ""
        st0 = http_json("GET", f"http://127.0.0.1:{BACK}/api/drafts")
        drafts = st0 if isinstance(st0, list) else st0.get("items", [])
        wid = drafts[-1]["work_id"] if drafts else ""
        w = http_json("GET", f"http://127.0.0.1:{BACK}/api/drafts/{wid}")
        assets = parse_refs(w.get("asset_refs"))
        record("VM-T02-01-asset-add", len(assets) == 1 and assets[0].get("caption") == "VM图说明"
               and "![VM图说明](https://example.com/vmt02.png)" in (w.get("body") or ""),
               {"wid": wid, "assets": len(assets)})

        # VM-T02-02 粘贴导入两来源 → 组合为新作品
        env1 = json.loads((FIX / "notes-envelope-1.json").read_text(encoding="utf-8"))
        env2 = json.loads((FIX / "reader-quote-1.json").read_text(encoding="utf-8"))
        items = json.dumps([env1, env2], ensure_ascii=False)
        client.fill(control(client.snapshot(), "textarea", placeholder=None) if False else
                    control_import_ta(client.snapshot()), items)
        client.press(control(client.snapshot(), "button", label="组合为新作品"))
        snap = wait(lambda: (s if "value: \"导入：" in (s := client.snapshot()) else None),
                    "compose adoption not visible")
        wid2_m = re.search(r"ID (w-\d+-\d+)", snap)
        wid2 = wid2_m.group(1) if wid2_m else ""
        w2 = http_json("GET", f"http://127.0.0.1:{BACK}/api/drafts/{wid2}")
        refs2 = parse_refs(w2.get("source_refs"))
        record("VM-T02-02-import-compose", len(refs2) == 2 and refs2[0].get("producer") == "notes"
               and refs2[0].get("source_revision") == 3 and "会议纪要" in (w2.get("body") or ""),
               {"wid2": wid2, "refs": len(refs2)})

        # VM-T02-03 磁盘落盘 + 干净退出
        root_dir = DATA / "works" / wid2
        rev = int((root_dir / "current.txt").read_text(encoding="utf-8").strip())
        meta = json.loads((root_dir / "revisions" / f"rev-{rev}.json").read_text(encoding="utf-8"))
        disk_ok = meta.get("title", "").startswith("导入：") and len(parse_refs(meta.get("source_refs"))) == 2
        record("VM-T02-03-disk-meta", disk_ok, {"revision": rev, "title": meta.get("title")})

        proc.stdin.write(b"q\n")
        proc.stdin.flush()
        rc = proc.wait(timeout=30)
        record("VM-T02-04-q-exit", rc == 0, {"exit_code": rc})
    except AssertionError as e:
        record("VM-T02-EXCEPTION", False, {"error": str(e)[:280]})
        if proc.poll() is None:
            proc.kill()
    finally:
        if proc.poll() is None:
            try:
                proc.stdin.write(b"q\n")
                proc.stdin.flush()
                proc.wait(timeout=15)
            except Exception:
                proc.kill()
        logf.close()
    passed = sum(1 for r in results if r)
    print(f"SUMMARY {json.dumps({'passed': passed, 'failed': len(results) - passed})}")
    return 0 if passed == len(results) else 1


def control_import_ta(snapshot):
    """导入 textarea：placeholder 含 producer:notes 示例文本。"""
    for match in re.finditer(r"(?m)^\s*textarea #(\S+)([^\n]*)(?:\n((?:(?!\s*\}).*\n)*))?", snapshot):
        header, body = match[2], match[3] or ""
        if "producer:notes" in header or "producer:notes" in body:
            return match[1]
    raise AssertionError("import textarea not found")


if __name__ == "__main__":
    sys.exit(main())
