#!/usr/bin/env python3
"""probe_vm_t01.py — BLOG-002 T-01 定向验收（原生 VM 轨）：作者任务全链。

真实 `auto run -r vm --server rust` 窗口 + MCP 驱动：空稿起稿面（textarea）→
写 Markdown → 保存 → 切引擎渲染 → 降级保稿 → q 退出 → 磁盘 body_format 落盘。
    python -I tests/probe/probe_vm_t01.py
退出码 0=全过。输出 `PASS|FAIL <name> <json>`。
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
FRONT = int(os.environ.get("PROBE_FRONT", "17840"))
BACK = int(os.environ.get("PROBE_BACK", "17841"))
DATA = REPO / ".tmp" / "t01-vm-data"

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


def control(snapshot, kind, label=None, placeholder=None):
    for match in re.finditer(r"(?m)^\s*" + kind + r" #(\S+)([^\n]*)(?:\n((?:(?!\s*\}).*\n)*))?", snapshot):
        header, body = match[2], match[3] or ""
        if label is not None and json.dumps(label, ensure_ascii=False) not in header:
            continue
        if placeholder is not None and f'placeholder: {json.dumps(placeholder, ensure_ascii=False)}' not in body:
            continue
        return match[1]
    raise AssertionError(f"missing {kind} {label or placeholder}")


def http_json(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data, {"Content-Type": "application/json"}, method=method)
    with urllib.request.urlopen(req, timeout=5) as resp:
        return resp.status, json.load(resp)


def main():
    DATA.mkdir(parents=True, exist_ok=True)
    for f in DATA.iterdir():
        pass  # 隔离目录允许复用（每轮新 work_id）
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        mcp_port = s.getsockname()[1]
    client = Mcp(mcp_port)
    logf = open(DATA / f"vm-t01-{int(time.time())}.log", "w", encoding="utf-8", errors="replace")
    env = dict(os.environ)
    env["AUTO_BLOG_DATA"] = str(DATA)
    env["AUTOUI_MCP_PORT"] = str(mcp_port)
    argv = [str(AUTO_EXE), "run", "--server", "rust", "-r", "vm",
            "-F", str(FRONT), "-B", str(BACK), "-d", str(REPO)]
    proc = subprocess.Popen(argv, cwd=str(REPO), env=env, stdin=subprocess.PIPE,
                            stdout=logf, stderr=subprocess.STDOUT)
    wid = ""
    try:
        wait(lambda: http_json("GET", f"http://127.0.0.1:{BACK}/api/drafts")[0] == 200,
             "backend drafts API not ready", timeout=180)
        wait(lambda: (s if "新建草稿" in (s := client.snapshot()) else None), "author page not loaded")

        # VM-01 新建：空稿起稿面 = textarea + 空稿提示
        client.press(control(client.snapshot(), "button", label="新建草稿"))
        snap = wait(lambda: (s if "空稿可直接输入" in (s := client.snapshot()) else None),
                    "empty-start hint missing")
        ta = control(snap, "textarea")
        record("VM-T01-01-empty-startface", True, {"textarea": True, "hint": True})

        # VM-02 写 Markdown → 保存 → 已保存
        client.fill(ta, "# 探针标题VM\n\n第一段：**加粗**。\n\n- 列表甲\n- 列表乙")
        client.press(control(client.snapshot(), "button", label="保存"))
        wait(lambda: (s if "已保存" in (s := client.snapshot()) else None), "save not confirmed")
        record("VM-T01-02-write-and-save", True, {})

        # VM-03 切引擎：原生引擎渲染 markdown 块
        client.press(control(client.snapshot(), "button", label="编辑器：降级 · 切引擎"))
        snap2 = wait(lambda: (s if "探针标题VM" in (s := client.snapshot()) else None),
                     "engine render missing after switch")
        record("VM-T01-03-switch-to-engine", True, {"rendered": "探针标题VM" in snap2})

        # VM-04 HTTP 读回：body_format=markdown + 正文落盘；取 work_id
        st, drafts = http_json("GET", f"http://127.0.0.1:{BACK}/api/drafts")
        target = next((d for d in drafts if d.get("title") == "未命名草稿" or "探针" not in (d.get("title") or "")), drafts[-1] if drafts else None)
        wid = target["work_id"]
        st2, w = http_json("GET", f"http://127.0.0.1:{BACK}/api/drafts/{wid}")
        ok4 = st2 == 200 and w.get("body_format") == "markdown" and "探针标题VM" in (w.get("body") or "")
        record("VM-T01-04-api-readback", ok4,
               {"body_format": w.get("body_format"), "wid": wid, "body_ok": "探针标题VM" in (w.get("body") or "")})

        # VM-05 降级保稿：切降级 → textarea 保留 → 追加 → 保存 → 读回
        client.press(control(client.snapshot(), "button", label="编辑器：引擎 · 切降级"))
        snap_fb = wait(lambda: (s if "textarea" in (s := client.snapshot()) else None),
                       "fallback textarea missing")
        ta2 = control(snap_fb, "textarea")
        client.fill(ta2, "# 探针标题VM\n\n第一段：**加粗**。\n\n- 列表甲\n- 列表乙\n\n降级追加VM")
        client.press(control(client.snapshot(), "button", label="保存"))
        wait(lambda: (s if "已保存" in (s := client.snapshot()) else None), "fallback save not confirmed")
        st3, w3 = http_json("GET", f"http://127.0.0.1:{BACK}/api/drafts/{wid}")
        record("VM-T01-05-fallback-keeps-body", "降级追加VM" in (w3.get("body") or "") and w3.get("revision", 0) >= 3,
               {"revision": w3.get("revision")})

        # VM-06 磁盘落盘：rev meta body_format=markdown
        root_dir = DATA / "works" / wid
        rev = int((root_dir / "current.txt").read_text(encoding="utf-8").strip())
        meta = json.loads((root_dir / "revisions" / f"rev-{rev}.json").read_text(encoding="utf-8"))
        record("VM-T01-06-disk-meta-format", meta.get("body_format") == "markdown",
               {"revision": rev, "body_format": meta.get("body_format")})

        # VM-07 干净退出
        proc.stdin.write(b"q\n")
        proc.stdin.flush()
        rc = proc.wait(timeout=30)
        record("VM-T01-07-q-exit", rc == 0, {"exit_code": rc})
    except AssertionError as e:
        record("VM-T01-EXCEPTION", False, {"error": str(e)[:300], "wid": wid})
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


if __name__ == "__main__":
    sys.exit(main())
