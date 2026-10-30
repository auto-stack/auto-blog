#!/usr/bin/env python3
"""probe_vm.py — BLOG-002 T-00 能力探针（原生 VM 轨）。

真实 `auto run -r vm --server rust` 窗口 + MCP 驱动：验证 autodown_editor /
autodown 原生渲染、textarea 降级切换与干净退出。用法：
    python tests/probe/autodown_cap/probe_vm.py
退出码 0=全过；非 0=存在失败。输出 `PASS|FAIL <name> <json>`。
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

REPO = Path(__file__).resolve().parents[3]          # auto-blog 根
PROJ = Path(__file__).resolve().parents[0]          # autodown_cap 探针项目
AUTO_EXE = Path(os.environ.get("AUTO_EXE", r"D:\autostack\auto-man\target\debug\auto.exe"))
FRONT = int(os.environ.get("PROBE_FRONT", "17838"))
BACK = int(os.environ.get("PROBE_BACK", "17839"))

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


def control(snapshot, kind, label=None):
    for match in re.finditer(r"(?m)^\s*" + kind + r" #(\S+)([^\n]*)", snapshot):
        if label is not None and json.dumps(label, ensure_ascii=False) not in match[2]:
            continue
        return match[1]
    raise AssertionError(f"missing {kind} {label}")


def port_free(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) != 0


def main():
    if not port_free(BACK):
        record("VM-00-preports", False, {"back": BACK, "reason": "port busy"})
        return 1
    mcp_port = None
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        mcp_port = s.getsockname()[1]
    client = Mcp(mcp_port)
    data_dir = PROJ / ".tmp" / "vm-data"
    data_dir.mkdir(parents=True, exist_ok=True)
    log_path = PROJ / ".tmp" / f"vm-probe-{int(time.time())}.log"
    env = dict(os.environ)
    env["AUTO_BLOG_DATA"] = str(data_dir)
    env["AUTOUI_MCP_PORT"] = str(mcp_port)
    logf = open(log_path, "w", encoding="utf-8", errors="replace")
    argv = [str(AUTO_EXE), "run", "--server", "rust", "-r", "vm",
            "-F", str(FRONT), "-B", str(BACK), "-d", str(PROJ)]
    proc = subprocess.Popen(argv, cwd=str(REPO), env=env, stdin=subprocess.PIPE,
                            stdout=logf, stderr=subprocess.STDOUT)
    try:
        wait(lambda: urllib.request.urlopen(
            f"http://127.0.0.1:{BACK}/api/ping", timeout=3).status == 200,
            "backend /api/ping not ready", timeout=180)
        snap = wait(lambda: (s if "能力探针" in (s := client.snapshot()) else None),
                    "window snapshot missing 探针 content")
        record("VM-01-window-render", True, {"hint": "能力探针 visible", "mcp": mcp_port})
        (PROJ / ".tmp" / "vm-snapshot-initial.txt").write_text(snap, encoding="utf-8")

        # VM-02 编辑+预览双面：初始快照应同时含编辑面种子文本与渲染面
        has_seed = ("加粗" in snap) and ("列表甲" in snap) and ("引用" in snap or "引用：" in snap)
        record("VM-02-dual-pane-render", has_seed,
               {"editor_blocks": "加粗" in snap, "list": "列表甲" in snap, "quote": "引用" in snap})

        # VM-03 降级切换：textarea 出现；输入回传渲染
        btn = control(client.snapshot(), "button", label="切换编辑器形态")
        client.press(btn)
        snap2 = wait(lambda: (s if "textarea" in (s := client.snapshot()) else None),
                     "fallback textarea not visible")
        ta = control(snap2, "textarea")
        client.fill(ta, "# 降级标题VM\n\n降级正文段落VM")
        wait(lambda: (s if "降级正文段落VM" in (s := client.snapshot()) else None),
             "renderer did not show fallback text")
        record("VM-03-fallback-edit-render", True, {"textarea": True})

        # VM-04 切回引擎形态
        btn2 = control(client.snapshot(), "button", label="切换编辑器形态")
        client.press(btn2)
        wait(lambda: (s if "降级标题VM" in (s := client.snapshot()) else None),
             "engine mode lost content after switch back")
        record("VM-04-fallback-reversible", True, {})

        # VM-05 干净退出：stdin q → exit 0
        proc.stdin.write(b"q\n")
        proc.stdin.flush()
        rc = proc.wait(timeout=30)
        record("VM-05-q-exit", rc == 0, {"exit_code": rc})
    except AssertionError as e:
        record("VM-EXCEPTION", False, {"error": str(e)[:300]})
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
