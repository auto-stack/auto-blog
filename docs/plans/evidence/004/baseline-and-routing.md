# BLOG-004 T-01 基线诊断：版本固定、Rust 生成/冷编译与原生 VM 启动、前置消费清单

> 任务：T-01（无框架交付前置）。产出本文件；原始日志在 `docs/plans/attachments/004/`（非 md 证据，不入库）。

## 1. 版本与指纹固定（2026-10-29）

四仓 HEAD 与工作树状态：

| 仓 | HEAD | 状态 |
|---|---|---|
| auto-blog（本计划主导仓，main） | `48e0c831fb99fca73d8db64845d367ec22ba8f75` | 工作树干净（`git status --short` 空；计划文档 48e0c83/d844b8b 已提交） |
| auto-man（CLI） | `e6cc06fbc496f366edde7929abfd49254ec13647` | — |
| auto-lang（语言侧前置） | `69d90c52f06e91d8f759dd13f1bf4fe72b001044` | 885 仅 prepare 提交 `57382e9c0`，status=drafting/step 0 |
| auto-ui（UI 侧前置） | `b00fd302a413f8b7a3623c75f632440ec5ddede8` | 003 仅 prepare 提交 `d5c7b86`，status=drafting/step 0 |

CLI 可执行文件：`D:\autostack\auto-man\target\debug\auto.exe`
SHA256 = `C049ABE3385D3E3634301A5DD1EE843E41A4CAACD2DE4214EA8D942EAB43D72E`（debug 构建；帮助确认 `run --server rust|vm`、`service --server rust|vm`、`-r/--render`、`-F/--front-port`、`-B/--back-port` 参数存在）。

应用源文件 SHA256 与 004 计划 §4 基线逐字一致（pac.at `F35DD5…`、api.at `2B7956…`、db.at `4E652F…`、works.at `ED8EAB…`、drafts.at `02068E…`、app.at `EDD895…`、author.at `8852EA…`、draft_store.at `570DDE…`、durable-drafts.md `8F9363…`、archived 001 `EA8EDA…`）——本 T-01 诊断针对的就是计划基线源码，无中途漂移。

启动命令/数据目录/端口：

- 数据根：生成代码 `drafts.rs:19-28 data_root()` 读 `AUTO_BLOG_DATA`（`a2r_std::env::get`），缺省 `$HOME/.auto-blog/data`；本次诊断设 `AUTO_BLOG_DATA=D:\autostack\auto-blog\.tmp\t01-*`（独立目录，`AUTO_DEBUG=1`）。
- 端口：应用固定 front 17826 / back 17827；Rust 隔离诊断用 17829（当时 17827/17826 均空闲）。`netstat` 确认无占用、无其他 auto 进程后才启动，仅清理本次创建的 PID。
- pac.at：`api: "rust"`、`render: "vue"`、`desktop: "true"`。

## 2. Rust 生成与冷编译诊断（对应 V-01 / AC-02 前置）

入口 1（计划正式入口）：`auto service --server rust -B 17829 -d <repo>`，`AUTO_DEBUG=1`

- 结果：`✓ Generated Rust server: auto-blog-back/`（生成成功）→ spawn cargo run 冷编译 → EXIT=1（父进程因编译失败返回）。
- 生成物：`rust-workspace/auto-blog-back/{Cargo.toml, src/{main,api,db,drafts,works,types}.rs}`，Cargo.lock 790 包。

入口 2（可复现的直接编译）：`cargo build --manifest-path rust-workspace\auto-blog-back\Cargo.toml --message-format=short`

- EXIT=101；**59 errors + 29 warnings**（完整日志 `docs/plans/attachments/004/rust-cold-build-001.log`，178412 B）。
- 错误按代码分组：

| 代码 | 计数 | 说明 | 涉及文件（主） |
|---|---|---|---|
| E0433 | 7 | `cannot find time in a2r_std`（time 路径） | drafts.rs×5, works.rs×2 |
| E0308 | 31 | mismatched types（String/&str、i64/i32、i64/Option、types::Work vs works::Work、SaveResult） | drafts.rs×23, db.rs×4, works.rs×4 |
| E0277 | 10 | `String` 与 `&str` 比较无实现 | drafts.rs×8, works.rs×2 |
| E0061 | 9 | 函数需要 3 参数但给 2 | drafts.rs×6, works.rs×3 |
| E0599 | 2 | `as_str` 用于 `i64` | drafts.rs×2 |
| 合计 | 59 | | |

根因归组（对应 AC-01"逐根因归组、owner/前置"）：

1. **time 路径（E0433×7）——owner auto-lang/PLAN-885**。生成代码发射 `auto_lang_core::a2r_std::time::now_sec()/now_ms()`（drafts.rs:422/447/508/683/706、works.rs:33/42），但 `auto-lang-core/src/a2r_std.rs` 内嵌 facade **无 `time` 模块**；独立 crate `crates/a2r-std/src/lib.rs:23` 有 `pub mod time`（`a2r_std/src/time.rs` 存在，1051B）。`qualify_a2r_std`（auto-api-gen/src/api_gen.rs:615，683-685 行把裸 `a2r_std::` 改写为 `auto_lang_core::a2r_std::`）与内嵌 facade 不匹配——与 004 §4 调查线索一致（"独立 a2r-std 已导出 time，API 生成器路径分流与内嵌 facade 并不等同"），非"独立 crate 没实现 time"。
2. **字符串值/借用（E0308 String/&str 17 处 + E0277 10 处 + E0599 2 处）——owner auto-lang/PLAN-885**。生成代码期望 `&str` 处得到 `String`、比较未走 `as_str`、把 `as_str` 应用到 `i64`。
3. **int 宽度/容器形状（E0308 i64/i32 6 处 + i64/Option 3 处 + E0061 9 处）——owner auto-lang/PLAN-885**。`.at` int 位宽、May/Option 展开与生成签名不一致，3 参函数调用只给 2 参。
4. **模块返回类型/类型别名（E0308 types::Work vs works::Work 3 处 + SaveResult 1 处）——owner auto-lang/PLAN-885**。生成模块内类型路径与公共 types 模块不一致。

**结论：001 记录的 59 errors 在当前版本（固定 CLI+源码）完整复现，不能以"当前不复现"关闭；两份前置的交付回执必须包含针对上述根因组的有效正控与生成/编译证据。**（001 记 59 为历史记录；本次实测恰为 59 errors，仍按"实际错误数"计，不承诺数。）

`AUTO_BLOG_DATA` 传递：生成代码已在 `data_root()` 经 `a2r_std::env::get` 读取（实现存在）；但因 Rust 编译失败，后端未启动，**运行时实测被编译门阻断**，留 T-02 交付后由 V-02/03 实测。

## 3. 原生 VM 启动诊断（对应 V-03 / AC-04 前置）

入口 A（正式组合）：`auto run -r vm --server rust -F 17826 -B 17827 -d <repo>`

- 日志显示 `split mode: frontend vm ↔ backend rust over HTTP`，随后 cargo 编译 Rust 后端失败（59 errors）→ **应用整体无法运行，无 VM HTTP/窗口证据**。Rust 编译门是前置阻断。

入口 B（隔离定位，仅原生窗口问题）：`auto run -r vm --server vm -F 17826 -B 17827 -d <repo>`（独立数据根 `.tmp/t01-vm-only-data`）

- 后端：`[AutoVM] HTTP server … 22 route(s) on 0.0.0.0:17827`、`Axum/Hyper transport listening on 0.0.0.0:17827` 启动成功（日志 `attachments/004/vm-only-stderr.log`）。
- 前端：进程在 `Running project ...` 后无进一步输出；`netstat` **17826 无监听**；`Get-Process` 无 `博客/Blog/realworld` 标题窗口；等待 60s+ 仍无窗口。
- 结论：**原生 VM 前端窗口在当前版本未启动到可见/可驱动状态**——与 001 记录"原生VM UI四轮不可驱动"一致；该腿由 auto-ui/PLAN-003 负责（本诊断不动 UI 仓，仅记录 owner/缺口）。

## 4. 前置消费清单（T-02/T-03 使用）

| 前置 | 当前状态 | 本 T-01 实测缺口 | 关闭条件（回执须含） |
|---|---|---|---|
| auto-lang/PLAN-885 | drafting/step0（prepare `57382e9c0`） | time 模块导出到内嵌 facade；String/&str 与借用；int 位宽/May；模块类型路径；函数签名 | 用固定 CLI 版本从纯.at 冷生成 Blog Rust 后端 → cargo build exit 0；对上述根因组逐组有效正控/修复证据；运行时可探活 |
| auto-ui/PLAN-003 | drafting/step0（prepare `d5c7b86`） | 原生 VM 前端窗口未启动（VM-only 后端可起） | 真实原生窗口正控（可见、可驱动）+ 退出重开；Blog 侧由 004 T-03 接入 |

## 5. 执行记录

- 命令与退出码：见上文各节；原始日志 `docs/plans/attachments/004/`（rust-cold-build-001.log、vm-start-stdout/stderr.log、vm-only-stdout/stderr.log）。
- 本次创建的进程（auto PID 23512/41384/59964/26372/53512/63540 等）均在诊断后 `Stop-Process` 清理，端口 17826/17827/17829 释放。
- `rust-workspace/` 为生成物目录（.gitignore 已忽略 gen 类产物；`Cargo.lock`/生成代码不入库）。
- 未修改任何源码/配置；本计划仍在 drafting→executing 起点，T-02/T-03 等待前置实际交付回执。
