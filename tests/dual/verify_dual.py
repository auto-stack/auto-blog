#!/usr/bin/env python3
"""verify_dual.py — BLOG-004 双运行时验收入口（T-04 建立，永久脚本）。

Profiles（计划 §6 固定入口）:
    python tests/dual/verify_dual.py --profile vue-rust
    python tests/dual/verify_dual.py --profile native-vm-rust

每轮：预检（工具 hash/依赖版本/空闲端口）→ 隔离数据目录 spawn 正式入口
`auto service --server rust` → 执行场景注册表 → 失败传播（任一执行场景失败
或存在 pending 场景即非零退出）→ 只清理本次创建的 PID → 输出场景明细/所选数/
依赖与 artifact hash。

场景分层：
  api    — 真实 Rust API 电池 + 001 存储负例（T-04，HTTP + 数据目录存在性
           oracle；不建立第二套存储实现）
  vue-ui — Vue＋Rust 真实交互（T-05 落地；未落地时记 pending，profile 整体非零）
  vm-ui  — 原生 VM 真实窗口任务（T-06 落地；驱动缺席时具名阻塞）

负控（V-06）：--inject-failure {port,expectation} 注入确定性失败，
harness 必须非零退出并保留失败明细；去掉注入的合法控制必须重新通过。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
AUTO_EXE = Path(r"D:\autostack\auto-man\target\debug\auto.exe")
SIBLINGS = {
    "auto-lang": Path(r"D:\autostack\auto-lang"),
    "auto-ui": Path(r"D:\autostack\auto-ui"),
    "auto-man": Path(r"D:\autostack\auto-man"),
}
READY_TIMEOUT_S = 180
SCENARIO_TIMEOUT_S = 30


def log(msg: str) -> None:
    print(msg, flush=True)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def git_head(repo: Path) -> str:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"], cwd=repo,
            capture_output=True, text=True, timeout=15,
        )
        return out.stdout.strip() if out.returncode == 0 else f"unavailable({out.returncode})"
    except OSError as e:
        return f"unavailable({e})"


def pick_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def http_json(method: str, url: str, body: dict | str | None = None) -> tuple[int, object | None]:
    """返回 (status, parsed)。4xx/5xx 不抛异常——负例需要读状态码。"""
    data = None
    headers = {}
    if body is not None:
        data = (body if isinstance(body, str) else json.dumps(body, ensure_ascii=False)).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=SCENARIO_TIMEOUT_S) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw


class Service:
    """正式入口 `auto service --server rust` 的受管封装；只清理自己 spawn 的进程树。"""

    def __init__(self, back_port: int, data_dir: Path, log_path: Path, bad_port: bool = False):
        self.back_port = back_port
        self.data_dir = data_dir
        self.log_path = log_path
        self.proc: subprocess.Popen | None = None
        self.bad_port = bad_port  # 负控注入：占用端口使启动必然失败

    def start(self) -> None:
        env = dict(os.environ)
        env["AUTO_BLOG_DATA"] = str(self.data_dir)
        env["AUTO_DEBUG"] = "1"
        port = self.back_port
        if self.bad_port:
            blocker = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            blocker.bind(("127.0.0.1", port))
            blocker.listen(1)
            self._blocker = blocker  # 保持占用直到 stop
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        self._logf = open(self.log_path, "w", encoding="utf-8", errors="replace")
        self.proc = subprocess.Popen(
            [str(AUTO_EXE), "service", "--server", "rust", "-B", str(port), "-d", str(REPO)],
            cwd=REPO, env=env, stdout=self._logf, stderr=subprocess.STDOUT,
        )

    def wait_ready(self) -> tuple[bool, str]:
        deadline = time.time() + READY_TIMEOUT_S
        url = f"http://127.0.0.1:{self.back_port}/api/drafts"
        while time.time() < deadline:
            if self.proc is not None and self.proc.poll() is not None:
                return False, f"service exited early rc={self.proc.returncode} (see {self.log_path.name})"
            try:
                with urllib.request.urlopen(url, timeout=3) as resp:
                    if resp.status == 200:
                        return True, "ready"
            except OSError:
                pass
            time.sleep(1.5)
        return False, f"ready timeout after {READY_TIMEOUT_S}s (see {self.log_path.name})"

    def stop(self) -> None:
        if getattr(self, "_blocker", None) is not None:
            self._blocker.close()
            self._blocker = None
        if self.proc is not None and self.proc.poll() is None:
            # Windows：taskkill /T 连同子进程（cargo run→后端 exe）一起终止，
            # 只针对本次 spawn 的 PID。
            subprocess.run(
                ["taskkill", "/T", "/F", "/PID", str(self.proc.pid)],
                capture_output=True, timeout=20,
            )
            try:
                self.proc.wait(timeout=15)
            except subprocess.TimeoutExpired:
                pass
        if self._logf is not None:
            self._logf.close()
            self._logf = None


class Ctx:
    """单轮运行上下文：base URL、隔离数据目录、artifact 目录。"""

    def __init__(self, base: str, data_dir: Path, artifacts: Path):
        self.base = base
        self.data_dir = data_dir
        self.artifacts = artifacts


# ---------------------------------------------------------------------------
# 场景注册表：name → (phases, owner, fn)
# phases: "pre-restart" | "post-restart" 决定执行时机；owner 标记未落地场景归属。
# 每个场景返回 (ok, detail)；断言失败必须给出可区分错误实现的明细。
# ---------------------------------------------------------------------------

SCENARIOS: dict[str, dict] = {}


def scenario(name: str, phase: str = "pre-restart", owner: str | None = None):
    def deco(fn):
        SCENARIOS[name] = {"phase": phase, "owner": owner, "fn": fn}
        return fn
    return deco


# V-02 输入域：中文 + 引号 + 换行 同稿覆盖
HARD_TITLE = '中文标题"引号"\n换行'
HARD_BODY = "正文第一段：中文与 \"引号\"。\n正文第二段：换行后的内容。"


@scenario("api.create_cn_quote_newline")
def s_create(ctx: Ctx):
    st, created = http_json("POST", f"{ctx.base}/api/drafts", {"title": HARD_TITLE, "body": HARD_BODY})
    if st != 200:
        return False, f"create status={st} body={created}"
    ctx.created_id = created["work_id"]
    ok = (created["title"] == HARD_TITLE and created["body"] == HARD_BODY and created["revision"] == 1)
    return ok, f"work_id={ctx.created_id} rev={created['revision']} created_at={created.get('created_at')}"


@scenario("api.epoch_valid")
def s_epoch(ctx: Ctx):
    now = int(time.time())
    st, created = http_json("POST", f"{ctx.base}/api/drafts", {"title": "epoch探针", "body": "时间语义"})
    if st != 200:
        return False, f"create status={st}"
    ca = created.get("created_at", 0)
    ok = 1_700_000_000 < ca <= now + 60
    return ok, f"created_at={ca} now={now} delta={now - ca}s"


@scenario("api.list_open_match")
def s_list_open(ctx: Ctx):
    st, got = http_json("GET", f"{ctx.base}/api/drafts/{ctx.created_id}")
    if st != 200:
        return False, f"open status={st}"
    ok = got["title"] == HARD_TITLE and got["body"] == HARD_BODY
    st2, listing = http_json("GET", f"{ctx.base}/api/drafts")
    in_list = st2 == 200 and any(w["work_id"] == ctx.created_id for w in listing)
    return ok and in_list, f"open match={ok} in_list={in_list}"


@scenario("api.save_conditional_rev")
def s_save(ctx: Ctx):
    st, saved = http_json("PUT", f"{ctx.base}/api/drafts/{ctx.created_id}", {
        "title": HARD_TITLE + "改", "summary": "摘要", "body": "条件保存后的正文。", "tags": "a,b", "expected_rev": 1,
    })
    ok = st == 200 and saved.get("ok") and saved.get("revision") == 2 and saved.get("work_id") == ctx.created_id
    ctx.rev2 = saved.get("revision")
    return ok, f"status={st} resp={saved}"


@scenario("api.stale_rev_conflict")
def s_conflict(ctx: Ctx):
    st, saved = http_json("PUT", f"{ctx.base}/api/drafts/{ctx.created_id}", {
        "title": "旧客户端", "summary": "", "body": "陈旧写必须被拒绝", "tags": "", "expected_rev": 1,
    })
    ok = st == 200 and not saved.get("ok") and saved.get("conflict") and saved.get("revision") == 2
    return ok, f"status={st} resp={saved}"


@scenario("api.migrate_idempotent")
def s_migrate(ctx: Ctx):
    items = [{"slug": "understanding-react-server-components", "title": "Understanding RSC",
              "description": "desc", "body": "body...", "tagList": "React,JS", "author": "Sarah"}]
    body = {"items": json.dumps(items, ensure_ascii=False)}
    st1, m1 = http_json("POST", f"{ctx.base}/api/drafts/migrate", body)
    st2, m2 = http_json("POST", f"{ctx.base}/api/drafts/migrate", body)
    ok = st1 == 200 and st2 == 200 and m1 >= 1 and m2 >= 1
    return ok, f"m1={m1} m2={m2} (幂等重迁移仍计数)"


@scenario("api.long_cn_body")
def s_long(ctx: Ctx):
    body = "".join(f"第{i}段：中文长文测试内容，验证持久化完整性。" for i in range(200))
    st, created = http_json("POST", f"{ctx.base}/api/drafts", {"title": "长稿测试", "body": body})
    if st != 200:
        return False, f"create status={st}"
    st2, got = http_json("GET", f"{ctx.base}/api/drafts/{created['work_id']}")
    return st2 == 200 and got["body"] == body, f"len={len(body)} roundtrip={'ok' if st2 == 200 and got['body'] == body else 'MISMATCH'}"


@scenario("neg.save_not_found")
def s_neg_nf(ctx: Ctx):
    st, saved = http_json("PUT", f"{ctx.base}/api/drafts/w-no-such-id", {
        "title": "x", "summary": "", "body": "y", "tags": "", "expected_rev": 1,
    })
    ok = st == 200 and not saved.get("ok") and saved.get("error") == "not_found" and not saved.get("conflict")
    return ok, f"resp={saved}"


@scenario("neg.migrate_bad_body_rejected")
def s_neg_badbody(ctx: Ctx):
    st, _ = http_json("POST", f"{ctx.base}/api/drafts/migrate", "not-json-at-all")
    return 400 <= st < 500, f"status={st} (外层非 JSON 必须传输层拒绝)"


@scenario("neg.migrate_bad_inner_json_zero")
def s_neg_badinner(ctx: Ctx):
    st, m = http_json("POST", f"{ctx.base}/api/drafts/migrate", {"items": "not-json-at-all"})
    return st == 200 and m == 0, f"status={st} count={m}"


@scenario("neg.migrate_empty_slug_zero")
def s_neg_emptyslug(ctx: Ctx):
    items = [{"title": "no-slug"}, {"slug": "", "title": "empty-slug"}]
    st, m = http_json("POST", f"{ctx.base}/api/drafts/migrate", {"items": json.dumps(items, ensure_ascii=False)})
    return st == 200 and m == 0, f"status={st} count={m}"


@scenario("store.isolated_datadir")
def s_isolation(ctx: Ctx):
    """AUTO_BLOG_DATA 必须作用到实际后端：隔离目录出现本仓存储痕迹，默认目录不存在。"""
    works = ctx.data_dir / "works"
    index = ctx.data_dir / "index.json"
    ok = works.is_dir() and any(works.iterdir()) and index.is_file()
    idx_text = index.read_text(encoding="utf-8", errors="replace") if index.is_file() else ""
    has_id = ctx.created_id in idx_text
    return ok and has_id, f"works_dir={works.is_dir()} index={index.is_file()} created_id_in_index={has_id}"


@scenario("api.restart_persistence", phase="post-restart")
def s_restart(ctx: Ctx):
    """001 语义：后端重启后已确认数据不丢（harness 在两阶段之间重启服务）。"""
    st, got = http_json("GET", f"{ctx.base}/api/drafts/{ctx.created_id}")
    ok = st == 200 and got["body"] == "条件保存后的正文。" and got["revision"] == 2
    return ok, f"status={st} rev={got.get('revision')} title={got.get('title')}"


# 未落地场景：登记 owner，运行即 pending（profile 整体非零，不可静默跳过）
PENDING_SCENARIOS = {
    "vue-ui.author_task": "T-05（Vue＋Rust 真实交互：创建/自动保存/冲突可见/刷新与重启回放）",
    "vm-ui.author_task": "T-06（原生 VM 真实窗口任务与退出恢复；驱动前置 auto-ui/PLAN-003 仍 drafting）",
}

PROFILE_PHASES = {
    "vue-rust": ["api", "vue-ui"],
    "native-vm-rust": ["api", "vm-ui"],
}


def run_profile(profile: str, only: str | None, inject: str | None, artifacts: Path) -> int:
    preflight_fail: list[str] = []
    if not AUTO_EXE.is_file():
        preflight_fail.append(f"auto.exe 缺失: {AUTO_EXE}")
    deps = {"auto-blog": git_head(REPO)}
    exe_sha = ""
    if not preflight_fail:
        exe_sha = sha256(AUTO_EXE)
        for name, path in SIBLINGS.items():
            deps[name] = git_head(path)
    log(f"== BLOG-004 verify_dual profile={profile} ==")
    log(f"deps: {json.dumps(deps)}")
    if exe_sha:
        log(f"auto.exe sha256={exe_sha[:16]}…")

    phases = PROFILE_PHASES[profile]
    tokens = [t.strip() for t in only.split(",")] if only else None
    selected = {n: s for n, s in SCENARIOS.items()
                if not tokens or any(t in n for t in tokens)}
    pendings = []
    for pname, owner in PENDING_SCENARIOS.items():
        phase_of = "vue-ui" if pname.startswith("vue-") else "vm-ui"
        if phase_of in phases and (not tokens or any(t in pname for t in tokens)):
            pendings.append({"name": pname, "owner": owner})

    run_dir = artifacts / f"{profile}-{datetime.now():%Y%m%d-%H%M%S}"
    run_dir.mkdir(parents=True, exist_ok=True)
    data_dir = REPO / ".tmp" / "dual" / f"{profile}-{os.getpid()}" / "data"
    if data_dir.exists():
        shutil.rmtree(data_dir)
    data_dir.mkdir(parents=True)

    # 隔离再生成：清成员源与工作区清单（强制依赖重解析），保留 target/ 增量编译
    ws = REPO / "rust-workspace"
    shutil.rmtree(ws / "auto-blog-back", ignore_errors=True)
    (ws / "Cargo.toml").unlink(missing_ok=True)

    front = pick_port()
    back = pick_port()
    log(f"ports: front={front}(预留) back={back} data={data_dir}")

    results: list[dict] = []
    svc = Service(back, data_dir, run_dir / "service-pre.log", bad_port=(inject == "port"))
    ctx = Ctx(f"http://127.0.0.1:{back}", data_dir, run_dir)
    ctx.created_id = ""

    def record(name: str, ok: bool, detail: str):
        results.append({"name": name, "phase": SCENARIOS[name]["phase"], "ok": ok, "detail": detail})
        log(f"  [{'PASS' if ok else 'FAIL'}] {name}: {detail}")

    try:
        svc.start()
        ready, why = svc.wait_ready()
        if not ready:
            log(f"  服务未就绪: {why}")
            if inject == "port":
                log("  负控注入生效：服务启动失败按预期发生")
                return finalize(profile, deps, exe_sha, results, pendings, run_dir,
                               injected_failure=True)
            for n in selected:
                record(n, False, f"service not ready: {why}")
            return finalize(profile, deps, exe_sha, results, pendings, run_dir)
        log("  service ready")

        pre = [n for n, s in selected.items() if s["phase"] == "pre-restart"]
        for name in pre:
            try:
                ok, detail = selected[name]["fn"](ctx)
            except Exception as e:  # 场景内异常=失败，不中断其余场景
                ok, detail = False, f"exception: {type(e).__name__}: {e}"
            record(name, ok, detail)

        if inject == "expectation":
            # 负控注入：翻转一条真实断言，harness 必须非零并保留失败明细
            results.append({"name": "injected.expectation_flip", "phase": "pre-restart",
                            "ok": False, "detail": "负控注入：人为判假，验证失败传播"})
            log("  [FAIL] injected.expectation_flip: 负控注入：人为判假，验证失败传播")

        # post-restart 阶段：重启服务后执行（001 重启持久化语义）
        post = [n for n, s in selected.items() if s["phase"] == "post-restart"]
        if post:
            svc.stop()
            svc2 = Service(back, data_dir, run_dir / "service-post.log")
            svc2.start()
            try:
                ready2, why2 = svc2.wait_ready()
                if not ready2:
                    for name in post:
                        record(name, False, f"service restart failed: {why2}")
                else:
                    for name in post:
                        try:
                            ok, detail = selected[name]["fn"](ctx)
                        except Exception as e:
                            ok, detail = False, f"exception: {type(e).__name__}: {e}"
                        record(name, ok, detail)
            finally:
                svc2.stop()
    finally:
        svc.stop()

    return finalize(profile, deps, exe_sha, results, pendings, run_dir)


def finalize(profile, deps, exe_sha, results, pendings, run_dir: Path,
             injected_failure: bool = False) -> int:
    passed = sum(1 for r in results if r["ok"])
    failed = sum(1 for r in results if not r["ok"])
    executed = len(results)
    log("")
    log(f"== profile={profile} 执行 {executed} / 通过 {passed} / 失败 {failed} / pending {len(pendings)} ==")
    for p in pendings:
        log(f"  [PENDING] {p['name']} — owner: {p['owner']}")
    report = {
        "profile": profile, "deps": deps, "auto_exe_sha256": exe_sha,
        "executed": executed, "passed": passed, "failed": failed,
        "pending": pendings, "results": results,
        "artifacts": str(run_dir), "injected_failure": injected_failure,
        "finished_at": datetime.now().isoformat(timespec="seconds"),
    }
    (run_dir / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    log(f"report: {run_dir / 'report.json'}")

    # 失败传播：注入失败的负控轮 → 非零；正常轮 → 有失败或有 pending 都非零
    if injected_failure:
        log("EXIT=1 (负控注入轮按设计失败)")
        return 1
    if failed:
        log(f"EXIT=1 ({failed} 个场景失败)")
        return 1
    if pendings:
        log(f"EXIT=2 (profile 未完整：{len(pendings)} 个场景 pending，见 owner)")
        return 2
    if executed == 0:
        log("EXIT=3 (0 场景执行——不可计 pass)")
        return 3
    log("EXIT=0 (全部执行场景通过，无 pending)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="BLOG-004 dual-runtime acceptance")
    ap.add_argument("--profile", required=True, choices=sorted(PROFILE_PHASES))
    ap.add_argument("--scenarios", default=None,
                    help="逗号分隔子串过滤场景名（修复轮定界用，如 api,neg,store；完整验收须不带此参）")
    ap.add_argument("--inject-failure", default=None, choices=["port", "expectation"],
                    help="V-06 负控注入：port=占用端口使启动失败；expectation=翻转断言")
    ap.add_argument("--artifacts", default=str(REPO / "docs" / "plans" / "attachments" / "004" / "dual"),
                    help="本地产物目录（不入库）")
    args = ap.parse_args()
    artifacts = Path(args.artifacts)
    artifacts.mkdir(parents=True, exist_ok=True)
    return run_profile(args.profile, args.scenarios, args.inject_failure, artifacts)


if __name__ == "__main__":
    sys.exit(main())
