#!/usr/bin/env python3
"""probe_vm_t04.py — BLOG-002 T-04 定向验收（原生 VM 轨）：预览往返零写回 + 磁盘一致。

    python -I tests/probe/probe_vm_t04.py
端口: FRONT=17846 BACK=17847。退出码 0=全过。
"""
from __future__ import annotations

import hashlib
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
FRONT = int(os.environ.get("PROBE_FRONT", "17846"))
BACK = int(os.environ.get("PROBE_BACK", "17847"))
DATA = REPO / ".tmp" / "t04-vm-data"
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


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()[:16]


def main():
    DATA.mkdir(parents=True, exist_ok=True)
    wid = ""
    proc = None
    logf = None
    mcp_port = None
    client = None

    def spawn():
        nonlocal proc, logf, mcp_port, client
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            mcp_port = s.getsockname()[1]
        client = Mcp(mcp_port)
        logf = open(DATA / f"vm-t04-{int(time.time())}.log", "w", encoding="utf-8", errors="replace")
        env = dict(os.environ)
        env["AUTO_BLOG_DATA"] = str(DATA)
        env["AUTOUI_MCP_PORT"] = str(mcp_port)
        argv = [str(AUTO_EXE), "run", "--server", "rust", "-r", "vm",
                "-F", str(FRONT), "-B", str(BACK), "-d", str(REPO)]
        proc = subprocess.Popen(argv, cwd=str(REPO), env=env, stdin=subprocess.PIPE,
                                stdout=logf, stderr=subprocess.STDOUT)
        wait(lambda: http_json("GET", f"http://127.0.0.1:{BACK}/api/drafts") is not None,
             "backend not ready", timeout=180)
        return wait(lambda: (s if "新建草稿" in (s := client.snapshot()) else None), "author page")

    try:
        spawn()
        client.press(control(client.snapshot(), "button", label="新建草稿"))
        ta = control(wait(lambda: (s if "空稿可直接输入" in (s := client.snapshot()) else None),
                          "empty start face"), "textarea")
        body = "# VM T04 标题\n\n> 引用\n\n- 列表甲\n\n![图](https://example.com/t04vm.png)"
        client.fill(ta, body)
        client.press(control(client.snapshot(), "button", label="保存"))
        wait(lambda: (s if "已保存" in (s := client.snapshot()) else None), "save")
        drafts = http_json("GET", f"http://127.0.0.1:{BACK}/api/drafts")
        wid = drafts[-1]["work_id"]
        w0 = http_json("GET", f"http://127.0.0.1:{BACK}/api/drafts/{wid}")
        base_sha = sha((w0.get("body") or "").encode("utf-8"))
        base_rev = w0.get("revision")
        idm = re.search(r"ID (w-\d+-\d+) · rev (\d+)", client.snapshot())
        record("VM-T04-01-baseline", idm and idm.group(1) == wid,
               {"wid": wid, "rev": base_rev, "sha": base_sha})

        # VM-T04-02 预览往返：ID/rev 不变、服务端正文字节不变
        client.press(control(client.snapshot(), "button", label="预览"))
        wait(lambda: (s if "本地预览（离线可用）" in (s := client.snapshot()) else None), "preview banner")
        client.press(control(client.snapshot(), "button", label="返回编辑"))
        snap = wait(lambda: (s if "已保存" in (s := client.snapshot()) else None), "editor restore")
        idm2 = re.search(r"ID (w-\d+-\d+) · rev (\d+)", snap)
        w1 = http_json("GET", f"http://127.0.0.1:{BACK}/api/drafts/{wid}")
        record("VM-T04-02-preview-no-writeback",
               idm2 and idm2.group(1) == wid and int(idm2.group(2)) == base_rev
               and sha((w1.get("body") or "").encode("utf-8")) == base_sha and w1.get("revision") == base_rev,
               {"id_ok": bool(idm2 and idm2.group(1) == wid), "rev": w1.get("revision"),
                "sha_ok": sha((w1.get("body") or "").encode("utf-8")) == base_sha})

        # VM-T04-03 退出重启重开：磁盘正文逐字节一致（预览未产生磁盘写）
        proc.stdin.write(b"q\n")
        proc.stdin.flush()
        rc = proc.wait(timeout=30)
        body_before = (DATA / "works" / wid / "revisions" / f"rev-{base_rev}.body").read_bytes()
        spawn()
        client.press(control(client.snapshot(), "button", label=body.split("\n")[0][:8])
                     ) if False else None
        # 打开该稿：点击草稿列表中最后一个「未命名草稿」col（本运行新建者为最新）
        snap = client.snapshot()
        cands = []
        for m in re.finditer(r"(?m)^\s*col #(\S+)", snap):
            seg = snap[m.start():m.start() + 500]
            if "未命名草稿" in seg and "GoOpen" in seg:
                cands.append(m[1])
        if cands:
            client.press(cands[-1])
        clicked = bool(cands)
        wait(lambda: (s if ("ID " + wid) in (s := client.snapshot()) else None),
             "reopen did not select target draft", timeout=20)
        body_after = (DATA / "works" / wid / "revisions" / f"rev-{base_rev}.body").read_bytes()
        # 语义判定：编辑器 ID 行已确认重开目标稿（wait 已通过）；磁盘正文逐字节一致
        record("VM-T04-03-restart-disk-intact", rc == 0 and clicked and body_after == body_before,
               {"q_exit": rc, "clicked": clicked, "sha_eq": sha(body_after) == sha(body_before)})

        # VM-T04-04 多源导入 → 新 work；源稿不变（AC-04）
        env1 = json.loads((FIX / "notes-envelope-1.json").read_text(encoding="utf-8"))
        env2 = json.loads((FIX / "reader-quote-1.json").read_text(encoding="utf-8"))
        items = json.dumps([env1, env2], ensure_ascii=False)
        ta_mod = control_import_ta(client.snapshot())
        client.fill(ta_mod, items)
        client.press(control(client.snapshot(), "button", label="组合为新作品"))
        snap = wait(lambda: (s if 'value: "导入：' in (s := client.snapshot()) else None),
                    "compose adoption")
        idm3 = re.search(r"ID (w-\d+-\d+)", snap)
        new_id = idm3.group(1) if idm3 else ""
        w_old = http_json("GET", f"http://127.0.0.1:{BACK}/api/drafts/{wid}")
        record("VM-T04-04-import-new-work", new_id and new_id != wid
               and (w_old.get("body") or "").encode("utf-8") == body_before,
               {"new_id": new_id, "old_intact": (w_old.get("body") or "").encode("utf-8") == body_before})

        proc.stdin.write(b"q\n")
        proc.stdin.flush()
        rc2 = proc.wait(timeout=30)
        record("VM-T04-05-q-exit", rc2 == 0, {"exit_code": rc2})
    except AssertionError as e:
        record("VM-T04-EXCEPTION", False, {"error": str(e)[:280], "wid": wid})
        if proc is not None and proc.poll() is None:
            proc.kill()
    finally:
        if proc is not None and proc.poll() is None:
            try:
                proc.stdin.write(b"q\n")
                proc.stdin.flush()
                proc.wait(timeout=15)
            except Exception:
                proc.kill()
        if logf is not None:
            logf.close()
    passed = sum(1 for r in results if r)
    print(f"SUMMARY {json.dumps({'passed': passed, 'failed': len(results) - passed})}")
    return 0 if passed == len(results) else 1


def control_import_ta(snapshot):
    for match in re.finditer(r"(?m)^\s*textarea #(\S+)([^\n]*)(?:\n((?:(?!\s*\}).*\n)*))?", snapshot):
        header, body = match[2], match[3] or ""
        if "producer:notes" in header or "producer:notes" in body:
            return match[1]
    raise AssertionError("import textarea not found")


if __name__ == "__main__":
    sys.exit(main())
