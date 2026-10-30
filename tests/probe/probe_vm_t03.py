#!/usr/bin/env python3
"""probe_vm_t03.py — BLOG-002 T-03 定向验收（原生 VM 轨）：预览/提示/返回/退出。

    python -I tests/probe/probe_vm_t03.py
端口: FRONT=17844 BACK=17845。退出码 0=全过。
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
FRONT = int(os.environ.get("PROBE_FRONT", "17844"))
BACK = int(os.environ.get("PROBE_BACK", "17845"))
DATA = REPO / ".tmp" / "t03-vm-data"

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


def main():
    DATA.mkdir(parents=True, exist_ok=True)
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        mcp_port = s.getsockname()[1]
    client = Mcp(mcp_port)
    logf = open(DATA / f"vm-t03-{int(time.time())}.log", "w", encoding="utf-8", errors="replace")
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
        ta = control(wait(lambda: (s if "空稿可直接输入" in (s := client.snapshot()) else None),
                          "empty start face"), "textarea")

        # 正文含：标题/引用 + script 标签 + 远程图 + 本地图引用
        body = ("# VM预览标题\n\n> 引用一行\n\n- 列表甲\n\n<script>window.__pwnedvm=1</script>\n\n"
                "![远程图](https://example.com/vm.png)\n\n![本地图](assets/local-vm.png)")
        client.fill(ta, body)
        client.press(control(client.snapshot(), "button", label="保存"))
        wait(lambda: (s if "已保存" in (s := client.snapshot()) else None), "save")

        # 添加一条本地路径资产 → asset-check 报告应含 本地 1
        client.fill(control(client.snapshot(), "input", placeholder="图片引用（URL/路径）"),
                    "assets/local-vm.png")
        client.fill(control(client.snapshot(), "input", placeholder="图片说明（可选）"), "VM本地图")
        client.press(control(client.snapshot(), "button", label="添加图片"))
        wait(lambda: (s if "已保存" in (s := client.snapshot()) else None), "asset save")

        # 预览
        client.press(control(client.snapshot(), "button", label="预览"))
        snap = wait(lambda: (s if "本地预览（离线可用）" in (s := client.snapshot()) else None),
                    "preview banner missing")
        has_h1 = "VM预览标题" in snap
        script_literal = "__pwnedvm" in snap
        has_local_hint = ("本地 1" in snap) and ("浏览器预览不可解析" in snap)
        record("VM-T03-01-preview-and-hints", has_h1 and script_literal and has_local_hint,
               {"h1": has_h1, "script_as_text": script_literal, "local_hint": has_local_hint})

        # 返回编辑：正文保留（同稿）
        client.press(control(client.snapshot(), "button", label="返回编辑"))
        snap2 = wait(lambda: (s if "编辑器：引擎 · 切降级" in (s := client.snapshot())
                              or "编辑器：降级 · 切引擎" in (s := client.snapshot()) else None),
                     "editor not restored")
        idm = re.search(r"ID (w-\d+-\d+)", snap2)
        wid = idm.group(1) if idm else ""
        w = http_json("GET", f"http://127.0.0.1:{BACK}/api/drafts/{wid}")
        record("VM-T03-02-back-to-editor", "VM预览标题" in (w.get("body") or "") and w.get("revision", 0) >= 2,
               {"wid": wid, "revision": w.get("revision")})

        proc.stdin.write(b"q\n")
        proc.stdin.flush()
        rc = proc.wait(timeout=30)
        record("VM-T03-03-q-exit", rc == 0, {"exit_code": rc})
    except AssertionError as e:
        record("VM-T03-EXCEPTION", False, {"error": str(e)[:280]})
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
