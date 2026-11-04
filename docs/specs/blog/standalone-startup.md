# standalone-startup — 本仓独立准备、启动与平台边界

> BLOG-005 SD-03 新增合同。分类：blog ｜ 状态：active ｜ 来源计划：
> docs/plans/005-standalone-dev-startup.md（T-01 实测落定，2026-11-01）

## 1. 准备与启动（Windows 正式路径）

- 本仓为**独立 clone、main 分支、一 app 一写入者**；不依赖 AutoOS 装配、
  历史 gen 目录或先手动开启另一应用。
- 前置：Rust toolchain（cargo）、Node+pnpm（pnpm v10+ 语义，`.npmrc` 由
  工具生成）、`AUTO_UI_TOOL_BIN`（原生 profile）指向与 CLI 匹配的
  `auto-ui-tool.exe`（发现顺序优先 `auto-man/target/debug/`；CLI 重建或
  auto-ui 交付后必须同步复制部署）。
- 启动：`auto run --server rust`（Vue dev）/ `auto run -r vm --server rust`
  （原生）；端口经 `-F/-B` 或 pac.at（17826/17827）；就绪判定=
  localhost+127.0.0.1 双判据。
- 冷缓存首轮准备：wipe `target/`+`gen/` 后官方入口重建（含 pac.at 全部
  npm_deps 的 scaffold）；BLOG-005 实测 238s 双判据就绪；后端就绪上限
  120s（具名失败非零退出）。
- 详细步骤与故障语义：README「准备与启动（Windows 正式路径）」。

## 2. 依赖版本与平台边界

- 引擎固定 vendor 副本（`vendor/auto-down`，pin 见
  `vendor/auto-down/PROVENANCE.md`）；npm_deps 显式声明（mermaid/
  lowlight/katex + @autodown/engine file: 链接）。
- 平台边界：Windows 正式路径实测；Linux 仍 `WAIT_DISTRO_M1`（非本仓
  阻塞项）；OS 组合版本由未来统一集成计划接收。
- 后端字符串语义：`.at` back 面 str 长度=字符数（code-unit）——back .at
  一律 `.length` 字段形（PLAN-051 期实录：方法形 `.len()` 在部分链版本
  发字节，混用 slice 即非 ASCII panic——统一字段形规避）。

## 3. 验收门（永久）

- `python tests/dual/verify_dual.py --profile vue-dev-rust`（16 场景）
- `python tests/dual/verify_dual.py --profile vue-rust`（15 场景）
- `AUTO_UI_TOOL_BIN=… python tests/dual/verify_dual.py --profile native-vm-rust`（22 场景）
- 三门分列验收、互不冒充；EXIT=0 且零 pending 方为通过。
