# auto-blog

本地博客写作应用，使用AutoLang / AutoUI开发。更新：2026-10-31。

## 已交付能力

- [001个人草稿](docs/plans/archived/001-durable-drafts.md)：稳定ID、自动保存、冲突保稿与重启恢复；`/demo`仍为RealWorld演示社区。
- [004双运行时验收](docs/plans/archived/004-dual-runtime-acceptance.md)：Rust服务与原生作者窗口已交付，原记录Vue15/15、native22/22及失败控制。
- [002编辑/资料/预览](docs/plans/archived/002-editor-assets-preview.md)：固定AutoDown/textarea降级、资产来源、预览和窄屏。
- [003快照与本地输出](docs/plans/archived/003-snapshots-export.md)：不可变快照、历史、Markdown＋base64资产包；HTML目前只交付接收入库合同，真实HTML采集F-12及网络发布仍未交付。

现实现见[运行验收](docs/specs/blog/runtime-acceptance.md)、[编辑预览](docs/specs/blog/editor-assets-preview.md)、[输出规范](docs/specs/blog/snapshots-export.md)。这些结果不证明当前普通Vue开发启动已无问题：含引擎时已登记F-2（路由求值失败、导航壳正常）。

## 当前后续计划

[BLOG-005：普通开发启动与编辑器运行路径收口](docs/plans/005-standalone-dev-startup.md) 为 drafting/r1、0/8，**尚未实施**。复用004工具/调度器和002固定引擎，先对照当前dev/preview，再修真实责任接缝；不重做Rust生成器或编辑器。

## 运行与验收

### 准备与启动（Windows 正式路径，BLOG-005 T-01 实测）

前置（一次性，均不依赖 AutoOS/历史生成目录）：Node ≥20、pnpm ≥10、Rust stable-msvc；`auto.exe` CLI 与 `auto-ui-tool.exe` 的构建与身份要求见[运行合同](docs/specs/blog/runtime-acceptance.md)（CLI 静态闭包含生成链；原生必须匹配实际 tool，不能只更新 auto.exe）。

首次/冷缓存准备与启动（无 target/gen 缓存，本仓实测含后端冷构建）：

```sh
git clone <本仓> && cd auto-blog
auto run --server rust
# 指定端口/数据目录（可选覆盖）：
AUTO_BLOG_DATA=D:/tmp/blog-data auto run --server rust -F 17826 -B 17827 -d <repo>
```

`auto run` 六步自带进度（源检查→API client→组件物化→pnpm install→public 资产→vite dev；Rust 后端由其托管）。就绪判定两判据分开：

- front：vite 打印的 `Local:` URL（**必须用 `localhost` 探测——dev 默认绑 `localhost`(本机 ::1)，127.0.0.1 不通**）GET 200；
- back：`http://127.0.0.1:<back>/api/drafts` GET 200（vite 就绪≠后端就绪）。

有界预算（本机实测 2026-11-01 冷缓存整轮 238s，BLOG-005 决策稿 §5）：后端冷构建 1m36s（sccache 温）为大头，pnpm install 0.6-3.8s，vite ready 0.3-0.7s；自动化建议外部可配置有界超时（≥10 分钟起步），框架内后端等待上限 120s、超时以 `API backend not ready within 120s (port …)` 非零退出。

故障语义（实测）：构建错→非零退出且日志含 cargo 明细（可诊断）；后端 exe 被残留进程锁定→`failed to remove … auto-blog-back.exe` 后**进程可能挂起不退出**（启动前须确保无残留 `auto-blog-back.exe`；自动化必须外置有界超时并按树收割）；**front 端口冲突当前框架不报错**——vite 会静默落到另一协议栈（127.0.0.1 被占时绑 ::1）或**自增端口（可能撞上后端端口）**：启动后必须核对 `Local:` 端口与 `-F` 一致，不一致=端口被占，释放端口后重启。`strictPort`/双栈校验属 auto-ui 配置发射前置（见[决策稿](docs/plans/evidence/005/startup-decision.md) §4/§6）。

### 验收入口

端口17826/17827；数据目录`AUTO_BLOG_DATA`覆盖，缺省`~/.auto-blog/data`。StyleKit及AutoDown固定于vendor。

原生正式入口：`auto run -r vm --server rust`。普通Vue dev入口`auto run --server rust`的引擎挂载F-2收口中（T-00已实证根因与最小修复配方：app侧依赖声明已交付，配置发射半边=auto-ui owner前置，见决策稿）；owner交付前**dev 路径引擎挂载为红，不得以 build＋preview 冒充 dev 验收**。Vue完整验收暂沿用build＋preview，由既有调度器管理：

```sh
python tests/dual/verify_dual.py --profile vue-rust
python tests/dual/verify_dual.py --profile native-vm-rust
```

原生profile需`AUTO_UI_TOOL_BIN`指向匹配工具；调度器使用隔离数据目录，只管理本次进程。005拟新增的vue-dev-rust profile尚不可用。旧VM后端可用于诊断，不替代Rust/原生验收。UI数据错误、空白outlet、pending或零场景不计成功。

## 规划、来源与开发

[路线图](docs/roadmap-v0.6.md) · [规划入口](docs/README.md) · [来源清单](SOURCE-IMPORT.json)。AutoOS组合目录为[apps/auto-blog](https://github.com/auto-stack/auto-os/tree/main/apps/auto-blog)，不是本仓开发入口。

开发/顺序复审在D:/autostack/auto-blog独立clone main；本轮只规划并push，不实现、不更新AutoOS子模块。后续统一OS计划装配各app已验证提交。跨应用联动/网络发布另排，Linux仍等待Nix＋COSMIC基础。
