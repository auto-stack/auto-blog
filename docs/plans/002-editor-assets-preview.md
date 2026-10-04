---
plan_id: BLOG-002
title: "编辑器复用、资料与预览"
status: drafting
feature_name: "编辑器复用、资料与预览"
author: [Codex]
created_at: 2026-10-04T00:00:00Z
updated_at: 2026-10-04T00:00:00Z
plan_revision: 1
current_step: 0
total_steps: 5
created: 2026-10-04
base_branch: v0.6-dev
base_commit: 55bd49e54ede0e189a39046cac557fa31ca8c5b4
depends_on: ["BLOG-001"]
supersedes_spec_components: []
new_spec_components: ["docs/specs/blog/editor-assets-preview.md"]
touched_goals: ["auto-blog/first-real-release"]
---

# BLOG-002：编辑器复用、资料与预览

## 0. 变更摘要

将导入demo的一项能力发展为可验证的真实产品模块。当前仅获授权编制设计/roadmap/实施计划，未执行代码开发。

## 1. 目标

覆盖需求：B02、B03、B04（定义见[产品设计](../design/01-product-design.md)）。依赖：[BLOG-001](001-durable-drafts.md)

原始导入commit用于识别来源，不要求后续计划回退到该commit；实际开工从最新v0.6-dev及已验收前序计划起步，在记录中填入实际HEAD。T0是有限能力核查；若需跨仓runtime改动，提交单独设计/计划，当前任务保留未完成验收，不偷偷将真实能力换成stub。

## 2. 架构方案

新增authoring、AutoDown adapter、资产和资料导入；不重写AutoDown引擎。

当前定位：`src/back/api.at`、`src/back/db.at`、`src/front/pages/editor.at`、`src/front/article_store.at`、`references/021-blog-viewer/README.md`。新文件路径以设计表为准，开工核对实际布局后可小幅调整并记录。禁止修改源demo、SOURCE-IMPORT.json、source-sync基线、未同步的四大app及AutoOS主桌面协议。集成使用新增adapter；跨仓依赖单独登记。

## 3. 技术栈

AutoLang/AutoUI `.at`、既有Vue/VM宿主；后端纯.at。协议使用版本化数据，原生能力经adapter接入，不手改生成Rust。

## 4. 需求分析与背景调查

授权：用户要求在四个独立app仓准备需求/设计、首版roadmap和首批实施计划。允许本轮文档编制；产品方向讨论不是本计划代码实现已经批准/完成的证据。

版本证据：frontmatter base_commit与SOURCE-IMPORT.json；源码路径见§2。各app当前没有独立docs/specs模块规范；以代码为观察事实、产品设计为目标态，提案中列出待沉淀规范。AutoOS规约见其AGENTS.md，AutoLang知识规则见docs/specs/README.md。

## 5. 详细设计

### 规范增量

| delta_id | add/modify/retire | 目标 | before/after rule | 理由 | 验收 |
|---|---|---|---|---|---|
| SD-01 | add | docs/specs/blog/editor-assets-preview.md | 本模块尚无app级current-state Spec → 记录实际实现的接口、恢复/错误及能力边界 | 供后续agent使用，设计提案不能冒充实现 | AC-01–AC-05 |

### 可执行任务

T-00先行；T-01→T-02→T-03→T-04顺序实施。T-00输出能力报告，T-01形成接口/fixture，T-02/03接入实现，T-04完成整体验证与文档。任务输出见每项说明；T-00/04核查AC-01–05全体，中间任务按对应行为覆盖。每项实测命令/证据写入§9，不把未创建的测试入口说成已有。

- [ ] T-00: T0核实固定AutoDown版本、Vue/VM可用能力和依赖安装；不直接依赖其他app未提交代码。
- [ ] T-01: 实现标题/摘要/标签/封面、常见Markdown编辑和纯文本fallback；无引擎可基本写稿。
- [ ] T-02: 实现图片/说明及AssetRef；Notes/Reader导入保留来源rev/locator，区分引用与副本。
- [ ] T-03: 实现桌面/窄屏本地预览、缺资源/断链提示；禁止预览主动执行文章脚本。
- [ ] T-04: 验证切换编辑/预览仍保存同work_id/revision，不把渲染转换悄悄写回原稿。

## 6. 测试设计

数据集：Notes envelope、Reader quote、带图中文Markdown、损坏资产、AutoDown不可用；tests/fixtures/authoring/（新建）。

在计划worktree根以匹配当前基线的auto CLI分别启动`auto run`与`auto run -r vm`，端口17826 / 17827，使用隔离存储目录。依赖准备见[仓根README](../../README.md)，不得把用户真实数据作为首次迁移样本。

本仓现有测试不保证覆盖新增产品能力。先建立tests下针对本计划的可重复fixture和驱动，在报告记录确切启动/执行命令；不得编造尚不存在的npm test/cargo test入口。使用AutoUI verifier现有双端驱动能力时，配置实际端口与app路径。

正确性/恢复/协议测试与UI体验分开记录，至少覆盖一个成功与一个失败路径。现有AutoLang/AutoUI框架不改时不跑cargo全量；若另开框架计划按该仓AGENTS的作用域门禁。文档阶段不运行cargo t/docs_gen。

## 7. 验收标准（必须保留实际证据）

- [ ] AC-01: 中文标题/列表/引用/图像在编辑和预览可用；Vue与VM各自列功能实测，不靠fallback声称高级富文本对齐。
- [ ] AC-02: 引擎初始化失败可保留正文并用fallback继续，不丢稿。
- [ ] AC-03: 导入2个来源组成新作品，source_refs准确，原notes/reader数据不被修改。
- [ ] AC-04: 同草稿切换界面ID稳定；多源导入创建新work而非覆盖任一源笔记。
- [ ] AC-05: 缺资产/不支持语法有可读提示；预览离线可用，窄屏主编辑区不被边栏挡住。


## 8. 执行步骤与交接

外仓共享对象服务未就绪时只验显式导入/引用，双向同步延后并在能力表说明。

新需求不得在执行中无限追加；发现必要遗漏先更新计划并讨论，不直接删验收项。知识系统/安装服务/AI等未交付依赖必须写明接口级与真实集成的差别。

## 9. 复审记录

- 实际起点HEAD/worktree/工具版本：未执行。
- T0能力与阻塞报告：未执行。
- 各AC项证据路径、命令及结果：未执行。
- 独立复审：未执行；重新对照代码检查AC项、遗漏/延后/workaround、格式/告警/调试输出，不信任已有勾选。
- 债务与风险：未登记；测试真实阻塞不得伪装通过。
- 沉淀：以frontmatter spec-impact候选登记实际实现组件，更新设计能力表与稳定规范；随后翻reviewed并归档。
- 合入目标：v0.6-dev；当前未实施，不合入master、不推进OS gitlink。

[整体roadmap](../roadmap-v0.6.md) · [agent执行说明](../README.md)

## 10. 待澄清事项

T-00需核实实际平台/运行时能力，负责者为本计划执行agent；输出具体API、可复现实验与独立阻塞提案。不存在先执行全局重构的隐含前置。核心验收变更须明确提出，不能用mock替换真实结果。

草案交接：stage=new；plan_revision=1；outcome=pass（可审查的草案，非代码验收）；next=work（选定计划并确认实施范围后）。当前均未实施。
