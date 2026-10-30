# 双运行时运行验收合同（BLOG-004 固化）

状态：current-state（BLOG-004 T-04..T-07 交付；2026-10-30）。本文件是 auto-blog 双运行时（Vue＋Rust 后端、原生 VM＋Rust 后端）运行与验收的统一合同；替代口口相传的探针用法。

## 1. 永久验收入口

```
python tests/dual/verify_dual.py --profile vue-rust        # Vue＋Rust 全链路（15 场景）
python tests/dual/verify_dual.py --profile native-vm-rust  # 原生 VM＋Rust 全链路（22 场景）
```

- 调度/隔离/失败传播由 `tests/dual/verify_dual.py` 承担：预检（auto.exe SHA256、四仓 HEAD、临时端口绑定分配）、隔离数据目录 `.tmp/dual/<profile>-<pid>/data`（`AUTO_BLOG_DATA` 直达后端）、每 run 独立产物 `docs/plans/attachments/004/dual/<profile>-<ts>/`（本地不入库）、只清理本次 spawn 的进程树。
- 退出码合同：0=全部执行场景通过且无 pending；1=存在失败（含负控注入轮）；2=profile 未完整（场景 pending，具名 owner）；3=0 场景执行。跳过/0 场景/超时不可计 pass。
- 修复轮定界可用 `--scenarios <逗号子串>` 过滤；完整验收必须不带过滤。负控注入 `--inject-failure {port,expectation}` 必须非零退出并保留失败明细。

## 2. 工具前置（版本绑定）

| 组件 | 来源 | 说明 |
|---|---|---|
| `auto.exe` CLI | auto-man `cargo build -p auto` | CLI 静态闭包含语言生成链（auto-api-gen）与 Vue 生成；重建后须复跑受影响 profile |
| `auto-ui-tool.exe` | auto-ui `cargo build -p auto-ui-tools --bin auto-ui-tool` | **原生/工具进程操作的真实执行体；发现顺序优先命中 `auto-man/target/debug/auto-ui-tool.exe`——CLI 重建或 auto-ui 交付后必须同步复制部署到该路径** |
| `AUTO_UI_TOOL_BIN` | 环境变量（原生 profile 必需） | `tests/dual/native_vm_scenarios.py` 硬要求；指向已交付工具 exe |

基准版本（2026-10-30 冻结）：CLI `da0558e7`、tool `563afa4a`、auto-lang 交付面 `dacd00184`（PLAN-885）、auto-ui 交付面 `df39593`（PLAN-015）。

## 3. 场景合同（两 profile 共同语义）

- **数据 oracle 三通道一致**：UI/API 响应 ↔ 独立 HTTP 读回（同 work_id/revision）↔ 磁盘数据目录（`index.json`/`works/<id>/{meta.json,current.txt,body.txt,high-water.txt}`）。
- **输入域**：中文、引号、换行同稿覆盖；长中文（4690 字）回读。
- **保存语义（001 承续）**：条件保存 `expected_rev` 成功推进 revision；陈旧 rev 拒绝（`ok=false, conflict=true`）；外部抢写后 UI 必须显示冲突且不得显示"已保存"；保留本机版本恢复后后端为 UI 内容。
- **迁移幂等**：同 items 重迁移仍计数（已存在 slug 返回既有 work_id）。
- **负例**：not_found、外层非 JSON body 传输层 4xx、内层坏 JSON→0、空 slug→0。
- **恢复链**：Vue=页面刷新重开 + 后端重启重开；原生=正常 q 退出（exit 0、进程树回收、MCP 关闭）与强制杀树两种退出后重开，已确认数据逐字节一致；恢复后的下一次操作（保存/编辑）必须通过。
- **自动保存**：3 秒 tick 落盘（Vue 经页面 timer；原生经 VM timer），编辑后不点保存等待即得"已保存"且后端 rev 推进。

## 4. 原生会话附加合同

- 启动：`auto run -r vm --server rust -F <front> -B <back>`（勿用 `--server vm`——那是 VM 后端）；env `AUTOUI_MCP_PORT`/`AUTO_HTTP_PORT`/`AUTO_FRONT_PORT`/`AUTO_BLOG_DATA`。
- 驱动：MCP `http://127.0.0.1:<AUTOUI_MCP_PORT>/mcp` JSON-RPC `tools/call`（`autoui_snapshot`/`autoui_action`/`autoui_type` 等）；窗口标题取 pac.at `title`。
- 多 store 语义（plan-446 A1）：裸 `store.Method()` 方法名在多个导入 store 间歧义时**拒绝加载**——源码须限定（如 `AuthStore.Init()`/`ArticleStore.LoadFeed()`）。Vue 轨同源歧义由生成器归属路由解析（auto-ui PLAN-010）。

## 5. 证据口径

Plan 内记命令、退出码、关键结果、本地路径+内容 hash；原始日志/报告/截图留 `docs/plans/attachments/004/dual/`（不入库）。报告 `report.json` 的 executed/passed/failed/pending 与退出码必须自洽。负控轮的非零退出是 harness 灵敏度证据，与正控轮分开留存。
