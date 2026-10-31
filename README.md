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

端口17826/17827；数据目录`AUTO_BLOG_DATA`覆盖，缺省`~/.auto-blog/data`。StyleKit及AutoDown固定于vendor；安装与匹配工具要求见[运行合同](docs/specs/blog/runtime-acceptance.md)。原生必须匹配实际auto-ui-tool，不能只更新auto.exe。

原生正式入口：`auto run -r vm --server rust`。普通Vue dev入口`auto run --server rust`的引擎挂载仍有F-2，005目标是将其闭合；当前Vue完整验收使用build＋preview，由既有调度器管理：

```sh
python tests/dual/verify_dual.py --profile vue-rust
python tests/dual/verify_dual.py --profile native-vm-rust
```

原生profile需`AUTO_UI_TOOL_BIN`指向匹配工具；调度器使用隔离数据目录，只管理本次进程。005拟新增的vue-dev-rust profile尚不可用。旧VM后端可用于诊断，不替代Rust/原生验收。UI数据错误、空白outlet、pending或零场景不计成功。

## 规划、来源与开发

[路线图](docs/roadmap-v0.6.md) · [规划入口](docs/README.md) · [来源清单](SOURCE-IMPORT.json)。AutoOS组合目录为[apps/auto-blog](https://github.com/auto-stack/auto-os/tree/main/apps/auto-blog)，不是本仓开发入口。

开发/顺序复审在D:/autostack/auto-blog独立clone main；本轮只规划并push，不实现、不更新AutoOS子模块。后续统一OS计划装配各app已验证提交。跨应用联动/网络发布另排，Linux仍等待Nix＋COSMIC基础。
