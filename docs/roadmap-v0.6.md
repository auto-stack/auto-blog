# auto-blog：独立可用性路线图

更新：2026-10-31。以现实现Spec及交付回执为准，pac版本和路线目标不表示全功能/全平台已通过。

| 顺序 | 计划/成果 | 当前状态与边界 |
|---|---|---|
| 基础 | [001个人草稿](plans/archived/001-durable-drafts.md) | 本地草稿已归档；历史任务计数9/31不在本轮重写，运行缺口由004接续 |
| 运行 | [004 Rust与原生验收](plans/archived/004-dual-runtime-acceptance.md) | archived/r2、10/10；原Vue15/15、native22/22，59个Rust错误与作者窗口缺口已有关闭证据 |
| 编辑 | [002编辑器/资料/预览](plans/archived/002-editor-assets-preview.md) | archived/r2、5/5；空稿textarea＋已有稿AutoDown；Vue采用build＋preview，普通dev的F-2仍在案 |
| 输出 | [003快照与本地发布包](plans/archived/003-snapshots-export.md) | archived/r3、5/5；Markdown包与历史已交付，HTML仅接收入库，F-12采集与网络published未交付 |
| 当前 | [005普通开发启动收口](plans/005-standalone-dev-startup.md) | drafting/r1、0/8，未实施；先T-00验证当前dev/preview与已有公开配置，再修接缝或消费最小owner前置 |

005补一条从本仓依赖准备→普通dev作者页实际挂载→AutoDown/降级编辑→保存/预览→正常及强杀重开→下一次保存的真实链路。已有preview/native门继续回归；不能只看到导航壳或引用旧004总数就关闭普通dev缺口。CLI与实际tool身份均要固定。

不等待auto-web建仓/大迁移、OS装配或Linux；HTTP能力只按当前已交付公共入口消费。Markdown/HTML范围按003实交付区分，不把005变成新输出或社区开发包。跨应用联动、网络发布目标与F-12采集另排。

工作位D:/autostack/auto-blog独立clone main，保留本地证据与他人WIP。本轮只更新并push计划/README/roadmap，不实现、不改历史归档、现实现Spec或旧ledger，不更新OS子模块。各app单独运行验收后，再由统一AutoOS计划接收精确提交；Linux仍WAIT_DISTRO_M1。

[README](../README.md) · [规划入口](README.md) · [运行规范](specs/blog/runtime-acceptance.md)
