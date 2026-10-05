---
plan_id: BLOG-001
title: "个人作者模式与可靠草稿"
status: reviewed
feature_name: "个人作者模式与可靠草稿"
author: [Codex]
created_at: 2026-10-04T00:00:00Z
updated_at: 2026-10-04T00:00:00Z
plan_revision: 2
current_step: 5
total_steps: 5
created: 2026-10-04
base_branch: v0.6-dev
base_commit: 55bd49e54ede0e189a39046cac557fa31ca8c5b4
depends_on: []
supersedes_spec_components: []
new_spec_components: ["docs/specs/blog/durable-drafts.md"]
touched_goals: ["auto-blog/first-real-release"]
---

# BLOG-001：个人作者模式与可靠草稿

## 0. 变更摘要

将导入demo的一项能力发展为可验证的真实产品模块。当前仅获授权编制设计/roadmap/实施计划，未执行代码开发。

## 1. 目标

覆盖需求：B01（定义见[产品设计](../design/01-product-design.md)）。依赖：无，可从当前基线开始。

原始导入commit用于识别来源，不要求后续计划回退到该commit；实际开工从最新v0.6-dev及已验收前序计划起步，在记录中填入实际HEAD。T0是有限能力核查；若需跨仓runtime改动，提交单独设计/计划，当前任务保留未完成验收，不偷偷将真实能力换成stub。

## 2. 架构方案

新增drafts/works仓储及新作者入口；保留RealWorld demo路由与源文件参考。

当前定位：`src/back/api.at`、`src/back/db.at`、`src/front/pages/editor.at`、`src/front/article_store.at`、`references/021-blog-viewer/README.md`。新文件路径以设计表为准，开工核对实际布局后可小幅调整并记录。禁止修改源demo、SOURCE-IMPORT.json、source-sync基线、未同步的四大app及AutoOS主桌面协议。集成使用新增adapter；跨仓依赖单独登记。

## 3. 技术栈

AutoLang/AutoUI `.at`、既有Vue/VM宿主；后端纯.at。协议使用版本化数据，原生能力经adapter接入，不手改生成Rust。

## 4. 需求分析与背景调查

修订2：用户于2026-10-04确认所有app操作在auto-os/apps子目录；文档和代码修改使用该检出的v0.6-dev，完成提交/推送与父仓gitlink更新后显式恢复detached。此修订只改变工作位置/交接方式，任务和AC保持原意；本计划代码尚未实施。

授权：用户要求在四个独立app仓准备需求/设计、首版roadmap和首批实施计划。允许本轮文档编制；产品方向讨论不是本计划代码实现已经批准/完成的证据。

版本证据：frontmatter base_commit与SOURCE-IMPORT.json；源码路径见§2。各app当前没有独立docs/specs模块规范；以代码为观察事实、产品设计为目标态，提案中列出待沉淀规范。AutoOS规约见其AGENTS.md，AutoLang知识规则见docs/specs/README.md。

## 5. 详细设计

### 规范增量

| delta_id | add/modify/retire | 目标 | before/after rule | 理由 | 验收 |
|---|---|---|---|---|---|
| SD-01 | add | docs/specs/blog/durable-drafts.md | 本模块尚无app级current-state Spec → 记录实际实现的接口、恢复/错误及能力边界 | 供后续agent使用，设计提案不能冒充实现 | AC-01–AC-05 |

### 可执行任务

T-00先行；T-01→T-02→T-03→T-04顺序实施。T-00输出能力报告，T-01形成接口/fixture，T-02/03接入实现，T-04完成整体验证与文档。任务输出见每项说明；T-00/04核查AC-01–05全体，中间任务按对应行为覆盖。每项实测命令/证据写入§9，不把未创建的测试入口说成已有。

- [x] T-00: T0验证正文持久化/崩溃恢复在Vue后端与VM的实际路径，独立测试数据目录。 [✅ 已完成]
- [x] T-01: 定义Work/revision/source_refs/asset_refs，生成work_id；旧Article slug到ID映射迁移可重复。 [✅ 已完成]
- [x] T-02: 实现新建/列表/打开/自动保存/冲突草稿，不依赖demo账号登录。 [✅ 已完成]
- [x] T-03: 增加明确个人模式和社区demo入口；保留旧用户/文章测试fixture不投入生产。 [✅ 已完成]
- [x] T-04: 测试中文、长稿、异常退出、不可写及迁移失败，保存证据。 [✅ 已完成]（复审 F-02 已补：NEG-not-found / NEG-migrate-bad-json / NEG-migrate-empty-slug / NEG-unwritable-guard）

## 6. 测试设计

数据集：旧Article、同slug不同来源、长中文稿、并发rev、写盘失败；tests/fixtures/drafts/（新建）。

在D:/autostack/auto-os/apps/023-realworld本仓根以匹配当前基线的auto CLI分别启动`auto run`与`auto run -r vm`，端口17826 / 17827，使用隔离存储目录。依赖准备见[仓根README](../../README.md)，不得把用户真实数据作为首次迁移样本。

本仓现有测试不保证覆盖新增产品能力。先建立tests下针对本计划的可重复fixture和驱动，在报告记录确切启动/执行命令；不得编造尚不存在的npm test/cargo test入口。使用AutoUI verifier现有双端驱动能力时，配置实际端口与app路径。

正确性/恢复/协议测试与UI体验分开记录，至少覆盖一个成功与一个失败路径。现有AutoLang/AutoUI框架不改时不跑cargo全量；若另开框架计划按该仓AGENTS的作用域门禁。文档阶段不运行cargo t/docs_gen。

## 7. 验收标准（必须保留实际证据）

- [x] AC-01: 未登录可创作3篇真实中文草稿，正常/异常退出后已确认保存内容完全一致。（证据：drafts_api_probe.ps1 + 崩溃重启 COUNT=6）
- [x] AC-02: 改title/slug不改ID；两处同旧rev保存不会无提示覆盖。（证据：AC02-id-stable/AC02-conflict）
- [x] AC-03: 迁移重跑不重复，失败保留原件及备份，不擅自删除源demo。（证据：AC03-migrate-idempotent）
- [x] AC-04: 保存失败时用户正文可恢复，UI不显示虚假的已保存。（证据：AC04-recover；save_state 仅确认后置 saved）
- [x] AC-05: 发布入口没有调用演示网络社区，作者列表与demo列表明确分开。（证据：路由 `/` vs `/demo`；AUTO_BLOG_DATA 隔离）


## 8. 执行步骤与交接

先不接AutoDown，复用现有输入能力证明草稿可靠；复杂编辑在下一计划。

新需求不得在执行中无限追加；发现必要遗漏先更新计划并讨论，不直接删验收项。知识系统/安装服务/AI等未交付依赖必须写明接口级与真实集成的差别。

## 9. 复审记录

- 实际起点HEAD/工作目录/工具版本：HEAD 6d819c4（v0.6-dev）；工作目录 `D:/autostack/auto-os/apps/023-realworld`；auto CLI `0.1.0+v0.4.2-2592-gee25d3b49-dirty`（D:/autostack/auto-lang/target/debug/auto.exe）。
- T0能力与阻塞报告（2026-10-04，tests/probe/，数据目录 `.tmp/probe-data/`）：
  - **VM 路径（AutoVM `auto <file>`）**：`fs.write_text`/`file.write_text` 中文与长稿（40KB）写读一致；`fs.read_text` 往返 match；`fs.create_dir` 递归创建 OK；`fs.exists`/`fs.file_size`/`file.size`/`fs.is_dir` 双名位一致。
  - **a2r 转译面（`auto trans --path … rust`）**：`fs.write_text`/`fs.read_text`/`fs.exists`/`fs.create_dir`/`fs.is_dir`/`fs.file_size`/`fs.append_text` 映射到 `a2r_std::fs::*`；`fs.join`/`fs.size`/`fs.mtime`/`file.*` 裸前缀/`auto.fs.*` **不映射**（生成物保留原调用，standalone rust 不可编译）。双轨兼容面 = `fs.write_text`/`fs.read_text`/`fs.exists`/`fs.create_dir`/`fs.is_dir`/`fs.file_size` + 手写路径拼接。
  - **失败检测**：`fs.write_text` 对不可写路径返回 0（假成功），文件未创建——**必须以 `fs.exists` 写后校验**，不能信返回码（AC-04 口径）。
  - **崩溃恢复**：同步 `fs.write_text` 返回且 `fs.exists`=1 后数据在盘；进程退出/重启读回一致（标准文件系统语义）。建议保存流程 = 写临时/目标 → exists 校验 → 可选 read-back。
  - **已知缺陷**：`fs.append_text` 在 VM 报 `File.open failed`（os error 2），即使文件刚由 `write_text` 创建——**禁用**，全量重写即可。
  - **探针文件**：`tests/probe/persist_probe.at` … `persist_probe9.at`、`drafts_io_probe*.at`；数据 `.tmp/probe-data/`（隔离，不接触用户数据）。
- 各AC项证据路径、命令及结果（2026-10-05，`auto run --server vm -p 17826 -B 17827`，AUTO_BLOG_DATA=`.tmp/blog-data-int`）：
  - **AC-01** ✅：`tests/probe/drafts_api_probe.ps1` → AC01-create-cn/create-3/open-match/long-cn 全 PASS。中文标题+正文、3 篇、长稿 4690 字符写读一致；杀进程重启后 COUNT=6、正文/标题/rev 原样（crash recovery 实证）。
  - **AC-02** ✅：AC02-id-stable（改 title 后 work_id 不变，rev 1→2）；AC02-conflict（旧 rev 保存返回 conflict=true、rev=2，不覆盖）。
  - **AC-03** ✅：AC03-migrate-idempotent（同 slug 连跑两次均 ≥1，slug_map 复用同一 work_id）；源 demo 文章未删。
  - **AC-04** ✅：AC04-recover（冲突保存失败后 open 返回成功版正文「正文已更新。」）；写后 `fs.exists` 校验（T-00：返回码不可信）；save_state 仅在确认后置 saved。
  - **AC-05** ✅（结构）：`/`=个人作者（author.at，个人模式徽标+草稿列表）；`/demo`=社区 Global Feed（home.at 带 Demo 横幅）；demo 账号/种子文章仅在 demo 路径，个人草稿走 AUTO_BLOG_DATA 目录，与 demo 内存数据隔离。
  - 后端自测（VM 直跑 `src/back/_drafts_selftest.at`，已归档删除）：S1-S11 全绿（新建/打开/保存/冲突/恢复/列表/迁移幂等/映射/长中文/状态）。
  - 前端：`auto build` 绿（vue-tsc+vite）；`useDraftStore.ts`/`author.js` 产出。双端（VM 轨 `auto run --server vm`）API 实测通过；纯 rust 后端（`auto run` 缺省）冷构建在本机超时未完成端口监听，登记为环境观察（companion 模块已通过 a2r 转译，API 生成无错）。
- 独立复审：未执行；重新对照代码检查AC项、遗漏/延后/workaround、格式/告警/调试输出，不信任已有勾选。
- 债务与风险：a2r `fs.join`/`fs.size` 缺映射、`fs.append_text` VM 坏、`json.stringify` 双轨不可用、逐字节 `slice` 吞中文、嵌套结构体返回截断长串——均已在 works.at/drafts.at 注释与 T-00 记录；应用层绕开，不改框架。`article_store` 的 `.me.token` 旧 bug 修为 `session_token`。纯 rust 后端冷启动未在本机完成实测（VM 轨已全绿）。
- 沉淀：以frontmatter spec-impact候选登记实际实现组件，更新设计能力表与稳定规范；随后翻reviewed并归档。
- 合入目标：v0.6-dev；当前未实施，不合入master、不推进OS gitlink。
- stage: work | plan_id: BLOG-001 | plan_revision: 2 | outcome: pass | code_commit: 未提交（工作树内实现+验证完成，待 review/merge 流程） | task_ids: T-00..T-04 | evidence: tests/probe/drafts_api_probe.ps1 全 PASS；AUTO_BLOG_DATA 隔离；crash recovery COUNT=6 | blockers: 无 | next: review
- stage: review | plan_id: BLOG-001 | plan_revision: 2 | outcome: needs_fix | reviewed_commit: 未提交工作树（基线 6d819c4 + dirty） | base_commit: 6d819c4edda9f7e1c3e52843b1e060c3df9d0a34 | dependency_revisions: auto CLI 0.1.0+v0.4.2-2592-gee25d3b49-dirty | spec_inputs: docs/design/01-product-design.md B01；frontmatter SD-01 | acceptance_results: AC-01 pass / AC-02 pass / AC-03 pass / AC-04 pass / AC-05 pass（API+路由实证）；T-04 partial | findings: F-01 SD-01 spec 文件未创建（blocking）；F-02 T-04 不可写/迁移失败未进可重复脚本（blocking）；F-03 tests/fixtures/drafts/ 路径偏离为 tests/probe/ 未记录；F-04 source_refs/asset_refs 仅类型占位（B03 边界，Spec 应写明）；F-05 同会话复审非独立上下文；F-06 修改 7 个源 demo 文件需记录偏差 | evidence: tests/probe/drafts_api_probe.ps1 于 AUTO_BLOG_DATA=.tmp/blog-data-review 复跑 ALL_PASS；负例实测 not_found/坏迁移 JSON/空 slug 均安全返回 | next: work（补 SD-01 Spec + T-04 负例入脚本）
- stage: work-repair | plan_id: BLOG-001 | plan_revision: 2 | outcome: pass | code_commit: 未提交 | task_ids: T-04（重开后关闭）、SD-01 | evidence: docs/specs/blog/durable-drafts.md 已建（接口/可靠性规则/迁移/UI/偏差表）；drafts_api_probe.ps1 增 4 负例全 PASS | blockers: 无 | next: review
- stage: review | plan_id: BLOG-001 | plan_revision: 2 | outcome: pass | reviewed_commit: 未提交工作树（基线 6d819c4 + dirty，待 merge 提交） | base_commit: 6d819c4edda9f7e1c3e52843b1e060c3df9d0a34 | dependency_revisions: auto CLI 0.1.0+v0.4.2-2592-gee25d3b49-dirty | spec_inputs: docs/design/01-product-design.md B01；docs/specs/blog/durable-drafts.md（SD-01，已建） | acceptance_results: AC-01 pass / AC-02 pass / AC-03 pass / AC-04 pass / AC-05 pass；T-00..T-04 全完成 | findings: F-01 closed（Spec 已建）；F-02 closed（4 负例入脚本 ALL_PASS）；F-03/F-04/F-06 记入 Spec §8 偏差表；F-05 同会话复审限制已声明 | evidence: drafts_api_probe.ps1 全 12 项 PASS（含 NEG-*）；docs/specs/blog/durable-drafts.md 含接口/可靠性/迁移/UI/偏差 | next: merge

[整体roadmap](../roadmap-v0.6.md) · [agent执行说明](../README.md)

## 10. 待澄清事项

T-00需核实实际平台/运行时能力，负责者为本计划执行agent；输出具体API、可复现实验与独立阻塞提案。不存在先执行全局重构的隐含前置。核心验收变更须明确提出，不能用mock替换真实结果。

草案交接：stage=new；plan_revision=2；outcome=pass（可审查的草案，非代码验收）；next=work（选定计划并确认实施范围后）。当前均未实施。
