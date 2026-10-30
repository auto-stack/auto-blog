"""BLOG-004 native acceptance: real CLI window/MCP -> Rust API -> durable data.

Invoked by verify_dual.py. No fixture state injection or direct API writes are
used to create the author result. HTTP is an independent readback, and the one
external PUT is explicitly the conflict adversary.
"""
from __future__ import annotations

import ctypes
import json
import os
import re
import socket
import subprocess
import time
import urllib.request
from pathlib import Path


class Mcp:
    def __init__(self, port):
        self.port = port

    def call(self, name, arguments=None):
        payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                   "params": {"name": name, "arguments": arguments or {}}}
        request = urllib.request.Request(
            f"http://127.0.0.1:{self.port}/mcp", json.dumps(payload).encode(),
            {"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=3) as response:
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


def wait(check, message, timeout=30):
    deadline = time.monotonic() + timeout
    last = ""
    while time.monotonic() < deadline:
        try:
            value = check()
            if value:
                return value
        except (OSError, RuntimeError, ValueError) as error:
            last = str(error)
        time.sleep(0.15)
    raise AssertionError(f"{message}; last={last}")


def control(snapshot, kind, label=None, placeholder=None):
    # Inspect each actual rendered node block; do not cache IDs across frames.
    for match in re.finditer(r"(?m)^\s*" + kind + r" #(\S+)([^\n]*)(?:\n((?:(?!\s*\}).*\n)*))?", snapshot):
        header, body = match[2], match[3] or ""
        if label is not None and json.dumps(label, ensure_ascii=False) not in header:
            continue
        if placeholder is not None and f'placeholder: {json.dumps(placeholder, ensure_ascii=False)}' not in body:
            continue
        return match[1]
    raise AssertionError(f"missing {kind} {label or placeholder}: {snapshot}")


def descendants(pid):
    rows = json.loads(subprocess.check_output([
        "powershell", "-NoProfile", "-Command",
        "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress",
    ], text=True, timeout=20))
    owned = {pid}
    while True:
        added = {row["ProcessId"] for row in rows if row["ParentProcessId"] in owned}
        if added <= owned:
            return owned
        owned |= added


def visible_windows(pids):
    result = []
    callback_type = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)

    @callback_type
    def callback(hwnd, _):
        pid = ctypes.c_ulong()
        ctypes.windll.user32.GetWindowThreadProcessId(ctypes.c_void_p(hwnd), ctypes.byref(pid))
        if pid.value in pids and ctypes.windll.user32.IsWindowVisible(ctypes.c_void_p(hwnd)):
            title = ctypes.create_unicode_buffer(512)
            ctypes.windll.user32.GetWindowTextW(ctypes.c_void_p(hwnd), title, 512)
            result.append({"pid": pid.value, "hwnd": hex(hwnd), "title": title.value})
        return True

    ctypes.windll.user32.EnumWindows(callback, 0)
    return result


def run(v, profile, deps, exe_sha, selected, inject, run_dir, data_dir, front, back):
    results = []
    sessions = []
    lifecycle = []
    mcp_port = v.pick_port()
    client = Mcp(mcp_port)
    api = f"http://127.0.0.1:{back}"
    ctx = v.Ctx(api, data_dir, run_dir)
    ctx.created_id = ""

    def record(name, ok, detail):
        results.append({"name": name, "phase": "vm-ui" if name.startswith("vm-ui") else selected[name]["phase"],
                        "ok": bool(ok), "detail": str(detail)})
        v.log(f"  [{'PASS' if ok else 'FAIL'}] {name}: {detail}")

    def snapshot(name):
        value = client.snapshot()
        (run_dir / f"{name}.snapshot.txt").write_text(value, encoding="utf-8")
        return value

    def text_wait(text):
        return wait(lambda: (s if text in (s := client.snapshot()) else None), f"snapshot missing {text}")

    def press(label):
        client.press(control(client.snapshot(), "button", label=label))

    def fill(kind, placeholder, text):
        client.fill(control(client.snapshot(), kind, placeholder=placeholder), text)

    def start(name):
        service = v.Service(back, data_dir, run_dir / f"native-{name}.log", mode="native",
                            front_port=front, mcp_port=mcp_port, bad_port=(inject == "port"))
        sessions.append(service)
        service.start()
        ready, detail = service.wait_ready()
        if not ready:
            raise RuntimeError(detail)
        text_wait("新建草稿")
        owned = descendants(service.proc.pid)
        windows = visible_windows(owned)
        if not any(row["title"] for row in windows):
            raise AssertionError("no visible owned native window")
        snapshot(name)
        lifecycle.append({"session": name, "cli_pid": service.proc.pid, "owned_pids": sorted(owned), "windows": windows})
        return service

    def close(service, force=False):
        owned = descendants(service.proc.pid)
        # Retain process handles so PID reuse cannot masquerade as a survivor.
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.OpenProcess.restype = ctypes.c_void_p
        kernel.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
        kernel.CloseHandle.argtypes = [ctypes.c_void_p]
        handles = [kernel.OpenProcess(0x00100000, False, pid) for pid in owned]
        try:
            if force:
                service.stop()
            else:
                service.proc.stdin.write(b"q\n")
                service.proc.stdin.flush()
                if service.proc.wait(timeout=25) != 0:
                    raise AssertionError("native CLI q exit was nonzero")
                service.stop()
            for handle in handles:
                if handle and kernel.WaitForSingleObject(handle, 10000) != 0:
                    raise AssertionError("owned child survived shutdown")
        finally:
            for handle in handles:
                if handle:
                    kernel.CloseHandle(handle)
        for port in (back, mcp_port):
            with socket.socket() as sock:
                if sock.connect_ex(("127.0.0.1", port)) == 0:
                    raise AssertionError(f"port {port} still listening")
        try:
            client.snapshot()
        except OSError:
            pass
        else:
            raise AssertionError("closed MCP target unexpectedly accepted snapshot")
        lifecycle[-1]["shutdown"] = "forced" if force else "q-exit-0"
        lifecycle[-1]["owned_children_exited"] = True

    expected = {"title": '原生中文"引号"标题', "body": '原生正文第一段。\n第二段含中文与"引号"。',
                "summary": "原生摘要", "tags": "native,中文"}
    wid = ""

    def readback():
        status, got = v.http_json("GET", f"{api}/api/drafts/{wid}")
        return got if status == 200 and all(got.get(k) == val for k, val in expected.items()) else None

    def disk_check():
        root = data_dir / "works" / wid
        revision = int((root / "current.txt").read_text().strip())
        rev = root / "revisions" / f"rev-{revision}"
        body = Path(str(rev) + ".body").read_text(encoding="utf-8")
        meta = json.loads(Path(str(rev) + ".json").read_text(encoding="utf-8"))
        assert Path(str(rev) + ".ok").is_file()
        assert body == expected["body"] and all(meta.get(k) == expected[k] for k in ("title", "summary", "tags"))
        return {"revision": revision, "body_sha256": v.sha256(Path(str(rev) + ".body"))}

    def reopen(name):
        text_wait(expected["title"])
        snap = client.snapshot()
        # Snapshot keeps source expressions (d.work_id) and unescaped text.
        # Discover the smallest clickable column containing this exact title,
        # then verify its actual opened identity rather than guessing an ID.
        candidates = []
        for match in re.finditer(r"(?m)^([ \t]*)col #(\S+)[^\n]*\{\n", snap):
            rest = snap[match.end():]
            end = re.search(r"(?m)^" + re.escape(match[1]) + r"\}", rest)
            if end:
                block = rest[:end.start()]
                if "onclick: .GoOpen(d.work_id)" in block and f'"{expected["title"]}"' in block:
                    candidates.append((len(block), match[2]))
        if not candidates:
            raise AssertionError(f"draft list item not reachable: {snap}")
        client.press(min(candidates)[1])
        text_wait(f"ID {wid}")
        snap = snapshot(name)
        assert expected["body"] in snap
        assert wait(readback, "reopened independent HTTP mismatch")
        disk_check()

    try:
        if os.name != "nt":
            raise RuntimeError("native window ownership driver requires Windows")
        tool = Path(os.environ["AUTO_UI_TOOL_BIN"])
        deps["auto-ui-tool-sha256"] = v.sha256(tool)
        deps["native-driver-sha256"] = v.sha256(Path(__file__))
        svc = start("first")
        record("vm-ui.visible_native_window", True, lifecycle[-1])
        for name, case in selected.items():
            if case["phase"] == "pre-restart":
                try:
                    ok, detail = case["fn"](ctx)
                except Exception as error:
                    ok, detail = False, repr(error)
                record(name, ok, detail)
        press("新建草稿")
        text_wait("文章标题")
        for kind, placeholder, value in [
            ("input", "文章标题", expected["title"]), ("input", "摘要（可选）", expected["summary"]),
            ("textarea", "正文（Markdown 语法可直接输入；自动保存）", expected["body"]),
            ("input", "标签（逗号分隔）", expected["tags"]),
        ]:
            fill(kind, placeholder, value)
        press("保存")
        text_wait("● 已保存")
        found = re.search(r"ID (w-[^\s]+) · rev", snapshot("saved"))
        assert found, "saved draft has no identity"
        wid = found[1]
        assert wait(readback, "UI-created draft differs from HTTP readback")
        record("vm-ui.author_task", True, {"work_id": wid, "disk": disk_check()})
        expected["body"] += "\n自动保存段落。"
        fill("textarea", "正文（Markdown 语法可直接输入；自动保存）", expected["body"])
        assert wait(readback, "native timer did not autosave", 12)
        text_wait("● 已保存")
        record("vm-ui.autosave", True, disk_check())
        # Deliberate external adversary: the actual UI must reject its stale
        # revision, retain the editing buffer and support KeepMine recovery.
        current = wait(readback, "pre-conflict readback missing")
        status, stolen = v.http_json("PUT", f"{api}/api/drafts/{wid}", {
            "title": "external competitor", "summary": "", "body": "external body",
            "tags": "", "cover": "", "format": "text", "expected_rev": current["revision"],
        })
        assert status == 200 and stolen.get("ok"), stolen
        expected["body"] += "\n冲突期间保留的本机编辑。"
        fill("textarea", "正文（Markdown 语法可直接输入；自动保存）", expected["body"])
        press("保存")
        text_wait("保存冲突：")
        conflict = snapshot("conflict")
        assert "● 已保存" not in conflict and expected["body"] in conflict
        record("vm-ui.conflict_retains_buffer", True, {"work_id": wid, "external_revision": stolen["revision"]})
        press("保留本机版本")
        assert wait(readback, "KeepMine did not persist local buffer")
        text_wait("● 已保存")
        record("vm-ui.conflict_recovery", True, disk_check())
        close(svc)
        record("vm-ui.normal_exit_and_closed_mcp", True, lifecycle[-1])
        svc = start("after-q")
        reopen("normal-reopen")
        # BLOG-002：有内容 markdown 稿重开默认引擎形态（VM 快照中引擎壳呈现为
        # textarea、占位符不同）——切降级统一回可定位/可填的 textarea
        if "编辑器：引擎 · 切降级" in client.snapshot():
            press("编辑器：引擎 · 切降级")
            text_wait("正文（Markdown 语法可直接输入；自动保存）")
        record("vm-ui.normal_reopen_persists", True, {"work_id": wid, "disk": disk_check()})
        for name, case in selected.items():
            if case["phase"] == "post-restart":
                ok, detail = case["fn"](ctx)
                record(name, ok, detail)
        expected["body"] += "\n强制退出前已确认保存。"
        fill("textarea", "正文（Markdown 语法可直接输入；自动保存）", expected["body"])
        press("保存")
        assert wait(readback, "pre-force save not confirmed")
        text_wait("● 已保存")
        close(svc, force=True)
        record("vm-ui.forced_exit_and_closed_mcp", True, lifecycle[-1])
        svc = start("after-force")
        reopen("forced-reopen")
        if "编辑器：引擎 · 切降级" in client.snapshot():
            press("编辑器：引擎 · 切降级")
            text_wait("正文（Markdown 语法可直接输入；自动保存）")
        record("vm-ui.forced_reopen_persists", True, {"work_id": wid, "disk": disk_check()})
        close(svc)
        if inject == "expectation":
            record("vm-ui.injected_expectation", False, "injected real-profile expectation failure")
    except Exception as error:
        record("vm-ui.fatal", False, repr(error))
        try:
            snapshot("failure")
        except Exception:
            pass
    finally:
        for service in reversed(sessions):
            service.stop()
        (run_dir / "native-lifecycle.json").write_text(json.dumps(lifecycle, ensure_ascii=False, indent=2), encoding="utf-8")
    return v.finalize(profile, deps, exe_sha, results, [], run_dir, injected_failure=(inject == "port"))
