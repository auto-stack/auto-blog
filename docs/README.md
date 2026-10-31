# auto-blog 产品规划与执行入口

更新：2026-10-31。001/004/002/003的已交付范围见[路线图](roadmap-v0.6.md)，当前后续为005；旧产品设计保留目标态。

- [产品设计](design/01-product-design.md) · [调研](research/20261004-benchmarks.md)
- [现实现草稿](specs/blog/durable-drafts.md) · [运行验收](specs/blog/runtime-acceptance.md) · [编辑预览](specs/blog/editor-assets-preview.md) · [快照输出](specs/blog/snapshots-export.md)

## 计划

1. [001个人草稿](plans/archived/001-durable-drafts.md)：已归档，历史计数差异保留。
2. [004双运行时运行验收](plans/archived/004-dual-runtime-acceptance.md)：已交付归档，Rust与真实原生窗口缺口关闭。
3. [002编辑器与预览](plans/archived/002-editor-assets-preview.md)：已归档；普通dev F-2由005接续。
4. [003快照与本地输出](plans/archived/003-snapshots-export.md)：已归档；HTML采集/网络发布不冒称交付。
5. [005普通开发启动收口](plans/005-standalone-dev-startup.md)：drafting/r1、0/8，未实施。

## 工作约定

计划、实现与顺序复审使用D:/autostack/auto-blog独立clone main，同app单一写入者；不在OS组合子模块开发、不建junction/symlink。框架修复只在实际owner另走Plan/worktree，先核验证据和已有公共能力。应用逻辑纯.at，不手改生成Rust/Vue。

本轮只建立/提交push文档；不执行产品、不改现实现Spec/旧ledger、不更新OSpin。后续独立运行验收后，由统一AutoOS计划集成固定SHA。Linux等待Nix＋COSMIC基础，跨app通讯与网络发布另排。

先读[README运行边界](../README.md)、005、相关Spec并固定CLI/实际auto-ui-tool、源码和依赖版本；dev/preview/native分别记录，不用空导航壳或框架夹具替代真实作者任务。
