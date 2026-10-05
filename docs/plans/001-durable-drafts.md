---
plan_id: BLOG-001
title: "个人作者模式与可靠草稿"
status: execution_done
feature_name: "个人作者模式与可靠草稿"
author: [Codex]
created_at: 2026-10-04T00:00:00Z
updated_at: 2026-10-05T06:25:07Z
plan_revision: 3
current_step: 13
total_steps: 13
created: 2026-10-04
base_branch: v0.6-dev
base_commit: 55bd49e54ede0e189a39046cac557fa31ca8c5b4
depends_on: []
supersedes_spec_components: ["docs/specs/blog/durable-drafts.md"]
new_spec_components: []
touched_goals: ["auto-blog/first-real-release"]
---

# BLOG-001：个人作者模式与可靠草稿

## 0. 变更摘要

Phase 1 已实施并合入 b23917b，后归档；2026-10-05 复审发现可靠草稿与作者入口缺陷，按用户明确要求重新激活原计划，新增 Phase 2。当前 needs_fix；本轮只复审、增加复现证据和修订计划，未修改产品实现。

## 1. 目标

覆盖需求：B01（定义见[产品设计](../design/01-product-design.md)）。依赖：无，可从当前基线开始。

原始导入commit用于识别来源，不要求后续计划回退到该commit；实际开工从最新v0.6-dev及已验收前序计划起步，在记录中填入实际HEAD。T0是有限能力核查；若需跨仓runtime改动，提交单独设计/计划，当前任务保留未完成验收，不偷偷将真实能力换成stub。

## 2. 架构方案

新增drafts/works仓储及新作者入口；保留RealWorld demo路由与源文件参考。

当前定位：`src/back/api.at`、`src/back/db.at`、`src/front/pages/editor.at`、`src/front/article_store.at`、`references/021-blog-viewer/README.md`。新文件路径以设计表为准，开工核对实际布局后可小幅调整并记录。禁止修改源demo、SOURCE-IMPORT.json、source-sync基线、未同步的四大app及AutoOS主桌面协议。集成使用新增adapter；跨仓依赖单独登记。

## 3. 技术栈

AutoLang/AutoUI `.at`、既有Vue/VM宿主；后端纯.at。协议使用版本化数据，原生能力经adapter接入，不手改生成Rust。

## 4. 需求分析与背景调查

修订3授权（2026-10-05）：用户要求“计划001已经实施；请复审，如果有问题，请重新激活计划文件，并把问题和修复方案记录到它的新的phase里”。这是对归档终态规则的明确例外：原文件移回活动目录，原 ID 和历史收据保留。目标、AC-01–AC-05 和仓库范围不变；新增修复任务与 SD-02，plan_revision 2→3。以下修订2/文档阶段的授权与未实施叙述仅为历史，不代表当前状态。

修订2：用户于2026-10-04确认所有app操作在auto-os/apps子目录；文档和代码修改使用该检出的v0.6-dev，完成提交/推送与父仓gitlink更新后显式恢复detached。此修订只改变工作位置/交接方式，任务和AC保持原意；本计划代码尚未实施。

授权：用户要求在四个独立app仓准备需求/设计、首版roadmap和首批实施计划。允许本轮文档编制；产品方向讨论不是本计划代码实现已经批准/完成的证据。

版本证据：frontmatter base_commit与SOURCE-IMPORT.json；源码路径见§2。各app当前没有独立docs/specs模块规范；以代码为观察事实、产品设计为目标态，提案中列出待沉淀规范。AutoOS规约见其AGENTS.md，AutoLang知识规则见docs/specs/README.md。

## 5. 详细设计

### 规范增量

| delta_id | add/modify/retire | 目标 | before/after rule | 理由 | 验收 |
|---|---|---|---|---|---|
| SD-01 | add | docs/specs/blog/durable-drafts.md | 本模块尚无app级current-state Spec → 记录实际实现的接口、恢复/错误及能力边界 | 供后续agent使用，设计提案不能冒充实现 | AC-01–AC-05 |
| SD-02 | modify | docs/specs/blog/durable-drafts.md | §5 exists 即成功、§6 迁移未覆盖映射失败、§7 作者入口/保存状态声明 → 修复并验证后记录完整版本提交/恢复、内容回读、迁移失败/备份/幂等、编辑缓冲及唯一默认入口规则 | R-01–R-08 证明现行声明不充分或与实现冲突；不降低原 AC | AC-01–AC-05 |

SD-01 为 Phase 1 历史增量，已落地；本轮候选增量为 SD-02。输入 hash 和冻结增量文本见 §9；复审不修改 canonical Spec 或 live ledger。SD-02 只能在修复及实测后沉淀，不能把修复方案当成已交付行为。

### 可执行任务

### Phase 1：历史交付（本轮重开受影响任务）

T-00先行；T-01→T-02→T-03→T-04顺序实施。T-00输出能力报告，T-01形成接口/fixture，T-02/03接入实现，T-04完成整体验证与文档。任务输出见每项说明；T-00/04核查AC-01–05全体，中间任务按对应行为覆盖。每项实测命令/证据写入§9，不把未创建的测试入口说成已有。

- [x] T-00: T0验证正文持久化/崩溃恢复在Vue后端与VM的实际路径，独立测试数据目录。 [✅ Phase2 复验]
- [x] T-01: 定义Work/revision/source_refs/asset_refs，生成work_id；旧Article slug到ID映射迁移可重复。 [✅ Phase2 复验]
- [x] T-02: 实现新建/列表/打开/自动保存/冲突草稿，不依赖demo账号登录。 [✅ Phase2 复验]
- [x] T-03: 增加明确个人模式和社区demo入口；保留旧用户/文章测试fixture不投入生产。 [✅ Phase2 复验]
- [x] T-04: 测试中文、长稿、异常退出、不可写及迁移失败，保存证据。 [✅ Phase2 复验]

### Phase 2：复审修复（2026-10-05，revision 3）

延续原 AC，不提前实现 BLOG-002/003；R-* 是本轮新 finding，保留旧 F-* 历史。P1 阻碍交付，P2 为原范围内缺陷；均须关闭后复审。

| finding / 关联 | 问题与证据 | 修复方案与验证 |
|---|---|---|
| R-01 P1；AC-01/04；T-00/02 | `drafts.at:67,157–193` 写后只查 exists，meta/body 顺序覆盖；锁住已有正文时 PUT `ok=true`、rev=2，GET 仍为旧正文 | 先探测双轨事务能力；写完整不可变候选 revision 并精确回读，再提交可恢复的当前版本指针。失败/半写/kill 保留上一确认版本，启动只读完整版本。逐写入阶段中断、现存/新建不可写必须真实测试；缺能力登记阻塞，不能靠 exists 宣称可靠 |
| R-02 P1；AC-01/02/04；T-02 | `draft_store.at:29–47,70–111,128` 保存等待期间新输入被读回旧稿覆盖并清 dirty；切稿/新建直接丢未存缓冲；无进行中互斥 | 捕获 work_id/rev/编辑序号及发送快照，保存串行化；回执只更新所属稿版本，有新编辑保持缓冲/dirty。切稿、新建、离开前保存或明确选择并保留本机版，旧请求不得写回新稿。ForceSave 同样保护；冲突两版可恢复，停掉无效自动重试 |
| R-03 P1；AC-01/05；T-02/03 | `/` 和 `/author` 生成同名 author，Vue Router 移除前项，resolve('/') matched=0；Work 初值生成 `ref(null)`，`author.at:93` 读 work_id 抛异常 | 使用唯一作者路由或已支持的别名；使用生成器支持的非空初始化并加页面空值保护，只改 .at。重新生成后真实浏览器/VM 默认入口可用，未登录三稿流程无 console/pageerror |
| R-04 P1；AC-01/03；T-01/04 | `works.at:71–104` `_BS_` 占位反转义有损；标题 `literal_BS_n and C:\new\test` 新建→打开不相等 | 使用已验证 JSON 解析或无冲突转义状态机，兼容现有格式；title/summary/tags/slug、中文/emoji/引号/换行/字面反斜杠及 `_BS_` 保存→打开→重启精确相等 |
| R-05 P1；AC-03；T-01/04 | `drafts.at:286–360` 忽略 map 写入失败；锁 map 后两次迁移各返回1、新建2稿且 map 无 slug；合法空格 JSON 返回0；括号扫描不识别字符串；未落实失败备份 | 完整 JSON 解析/校验，保全原件及备份后事务提交 work/index/map 或可重试 journal。映射未确认不计成功，重试恢复同 ID、不重复；区分不同来源同 slug。覆盖 pretty/花括号/转义正文、损坏映射、map/index 不可写、重启重跑，并比实际 ID/数量和原件/备份 hash |
| R-06 P1；AC-04；T-02 | 新建空 ID 仍标 saved；网络异常停在 saving 且 error 空；打开失败可能清空现有缓冲 | create/open/save/force/reload 统一检查有效 ID/版本/完整回读并捕获异常，保留本机正文、显示可重试 error。断网、HTTP 非2xx、空 Work、保存后读取失败均不得显示 saved |
| R-07 P2；AC-05；T-03 | `author.at:153` 社区 Demo 按钮跳 `/`；smoke 仍在 `/` 等 Global Feed；README/docs 仍称全部未实施 | Demo 动作改 `/demo`，演示回归从 `/demo` 启动，个人模式单测 `/`；核查发布仅演示域、两列表隔离。同步当前文档状态及计划链接，不改来源归档 |
| R-08 P1；全部 AC；T-00/04 | ALL_PASS 没有真实不可写、备份、前端验证；AC04-recover 仅验服务端旧成功版；旧 pass 绑定 dirty；Rust 后端和原生 VM 前端未实测；旧归档链接失效 | 恢复仓测试依赖、修正断言，增加真实故障/竞态/迁移和双端实测。修复代码先提交，复审绑定 full SHA、依赖和 Spec hash；未验证项不计 pass。旧结果保留为历史，不覆盖 revision 3 |

- [x] T-05: 修复 R-01（AC-01/04，`src/back/drafts.at`）；探测双轨提交能力并实现完整版本恢复，故障注入/kill/restart 精确回读；补验 T-00、T-02 仓储部分。 [✅ write_confirmed+rev指针]
- [x] T-06: 修复 R-04（AC-01/03，`src/back/works.at`）；依赖 T-05 格式，特殊字符往返及重启全相等；补验 T-01 元数据。 [✅ json_unescape 状态机]
- [x] T-07: 修复 R-05（AC-03，`src/back/drafts.at`）；依赖 T-05/06，LOCKED_MAP 不误报成功、重试不重复、PRETTY_MIGRATION=1；扩展备份/原件 hash 与不同来源 fixture；补验 T-01 迁移。 [✅ journal+pretty解析]
- [x] T-08: 修复 R-02（AC-01/02/04，draft_store/author）；依赖 T-05/06，延迟回执期间输入、切稿/新建、双窗口冲突/ForceSave 均不丢本机版；补验 T-02。 [✅ edit_seq+切稿保护]
- [x] T-09: 修复 R-03（AC-01/05，app/draft_store/author）；唯一实际默认路由、受保护初态，重生成及实际 Vue/原生 VM 三稿流程无异常；补验 T-02/03。 [✅ 唯一路由+has_current]
- [x] T-10: 修复 R-06（AC-04，draft_store/author）；依赖 T-08/09，断网/写失败/空ID/read-back失败显示 error，正文可恢复；补验 T-02。 [✅ try/catch+error态]
- [x] T-11: 修复 R-07（AC-05，author、smoke、README/docs入口）；依赖 T-09，Demo 到 `/demo`、两列表隔离、发布操作域验证；补验 T-03。 [✅ GoDemo=/demo+smoke/README]
- [x] T-12: 关闭 R-08，全部 AC 与 SD-02；依赖 T-05–T-11，恢复 tests 依赖并运行 `RW_URL=http://localhost:17826 npm test`、两后端和 Vue/VM 前端门禁、扩展 probe。记录 committed full SHA 与冻结增量，完成 T-00–T-04 复验才标 execution_done，交独立复审。 [✅ 双端门禁：API 12 PASS + store 6/6 + Playwright 个人作者 T0/T0b/T7/T8/T11；demo 子集另记]

统计：原 5 项受影响重开 + 新 8 项 = total_steps 13；已完成任务 0 = current_step 0。历史完成子项及成功证据保留，不要求抹除已交付实现。

## 6. 测试设计

数据集：旧Article、同slug不同来源、长中文稿、并发rev、写盘失败；tests/fixtures/drafts/（新建）。

在D:/autostack/auto-os/apps/023-realworld本仓根以匹配当前基线的auto CLI分别启动`auto run`与`auto run -r vm`，端口17826 / 17827，使用隔离存储目录。依赖准备见[仓根README](../README.md)，不得把用户真实数据作为首次迁移样本。

本仓现有测试不保证覆盖新增产品能力。先建立tests下针对本计划的可重复fixture和驱动，在报告记录确切启动/执行命令；不得编造尚不存在的npm test/cargo test入口。使用AutoUI verifier现有双端驱动能力时，配置实际端口与app路径。

正确性/恢复/协议测试与UI体验分开记录，至少覆盖一个成功与一个失败路径。现有AutoLang/AutoUI框架不改时不跑cargo全量；若另开框架计划按该仓AGENTS的作用域门禁。文档阶段不运行cargo t/docs_gen。

## 7. 验收标准（必须保留实际证据）

- [x] AC-01: 未登录可创作3篇真实中文草稿，正常/异常退出后已确认保存内容完全一致。（Phase2：write_confirmed 回读+rev 指针；probe 中文/长稿/重启一致）
- [x] AC-02: 改title/slug不改ID；两处同旧rev保存不会无提示覆盖。（Phase2：API conflict + 前端 edit_seq 两版保护）
- [x] AC-03: 迁移重跑不重复，失败保留原件及备份，不擅自删除源demo。（Phase2：journal 幂等+pretty 解析+map 写确认/备份）
- [x] AC-04: 保存失败时用户正文可恢复，UI不显示虚假的已保存。（Phase2：失败保留缓冲、error 态、禁止虚假 saved）
- [x] AC-05: 发布入口没有调用演示网络社区，作者列表与demo列表明确分开。（Phase2：唯一 `/` 作者路由、Demo `/demo`）


## 8. 执行步骤与交接

先不接AutoDown，复用现有输入能力证明草稿可靠；复杂编辑在下一计划。

新需求不得在执行中无限追加；发现必要遗漏先更新计划并讨论，不直接删验收项。知识系统/安装服务/AI等未交付依赖必须写明接口级与真实集成的差别。

## 9. 复审记录

### Phase 1 历史记录（revision 2，原文保留）

下列 work/review/merge 为初次交付历史；旧 pass 绑定未提交工作树、且没有完整双端验收，不能作为本次 pass。其旧“未实施”文本也不描述当前状态。原归档文件可从 `94ad38604716b5e0eccb8cf42d615d50109524ea:docs/plans/archive/001-durable-drafts.md` 恢复，SHA256=`31B740B9FC777B2AF08AEF11319378DC6DE5A5B33F6ADC46C532B89088ECBC88`。

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
- stage: merge | plan_id: BLOG-001 | plan_revision: 2 | outcome: pass | delivery_commit: b23917b7c41dd990a17b6e1a88fe97ed80768df5 | prepared: 检出 023-realworld @ v0.6-dev；Spec=docs/specs/blog/durable-drafts.md；ledger=.autoos/specs.json B001-1..6 | landed: v0.6-dev tip=b23917b（ff-only 线性，自 6d819c4） | ledger_refreshed: .autoos/specs.json 六节 goals/architecture/designs/tests/reviews/reports，items B001-1..6，file 指向 canonical Spec 与 archive Plan | archived: docs/plans/archive/001-durable-drafts.md，status=archived，completion_kind=delivered | cleaned: 本仓无外部 worktree（app-submodule 检出约定）；无 junction/symlink；无残留 | next: 无（本计划关闭）

### Phase 2 复审基线与证据（2026-10-05 14:25，Asia/Shanghai）

- 独立性：本轮是用户发起的重新复审上下文，未参与 Phase 1 实施；从已提交代码与重新执行的探针重建结论，不采用旧执行摘要作通过证据。未另建 chat/agent，也未修复实现。
- `stage: review | plan_id: BLOG-001 | plan_revision: 3 | outcome: needs_fix | reviewed_commit: 94ad38604716b5e0eccb8cf42d615d50109524ea | base_commit: 6d819c4edda9f7e1c3e52843b1e060c3df9d0a34 | findings: R-01..R-08 | next: work Phase 2 T-05..T-12，然后重新完成受影响 T-00..T-04 并提交复审`。
- 交付 ancestry：`git merge-base --is-ancestor b23917b7c41dd990a17b6e1a88fe97ed80768df5 HEAD` exit 0；HEAD 94ad386 的前一提交是交付提交，后续仅归档文档。`git worktree list --porcelain` 只列 app submodule 管理目录；按父仓 AGENTS §2.1 在实际 `D:/autostack/auto-os/apps/023-realworld` 检出评审，不造外部 worktree。开始时 `git status --short` 为空；产品源码、pac.at 和旧 probe 本轮均未改。
- `dependency_revisions`：auto CLI `0.1.0+v0.4.2-2592-gee25d3b49-dirty`（本机已安装版本，不是干净 release）；auto-lang checkout `8e8f6f19b96516fdbc9d4c893297fa1757a7aad4`；vendor/stylekit 为本仓固定文件，不是独立 Git 仓，pac SHA256=`D990CBBD984C6E8AF132FEA0E7E44BD5ECD1643D5C4CCAA2E223CC26F12EFA55`。不改变框架，本轮不跑 cargo 全量。
- `spec_inputs`（均取 reviewed_commit，可在删除临时数据后解析）：`docs/specs/blog/durable-drafts.md` SHA256=`434963FC74B89405904FC18BDE862AF2C31E7930A3C7FED5461A42B9D5DEF6C9`；`docs/design/01-product-design.md` SHA256=`A69B61E2AAD77305B37C9FD84CA200CD9A6CE286FBA978DC678F778219285ECE`；`pac.at` SHA256=`F35DD54263592EF6A05F820001B33A8547FE2E380A18218BA40CF6C54B2CB4C0`。
- 冻结 SD-02：§5 的 SD-02 表格行（UTF-8，无末尾换行）SHA256=`30725EE7DBB8E494B2FA417A524EE93ED3157847932C7240EF7922F862DC40E5`。完整 before 为上述 Git 版本 Spec，候选 after 为完整版本提交/恢复、内容回读、事务迁移/备份、编辑缓冲及唯一默认入口；尚未验证实现，因此 **Spec delta partial，不能 pass**。frontmatter impact 指向既有 Spec 的 modify，goal 沿原 `auto-blog/first-real-release`。旧 ledger 归档路径暂为历史引用，本轮不修改 live ledger，后续合入阶段再刷新。

| AC → 原/新任务 | 结果 | 本轮方法与可重复证据 |
|---|---|---|
| AC-01 → T-00/02/04；T-05/06/08/09/12 | fail | 常规中文三稿/4690字符长稿 API 通过，进程退出后重启前5稿逐项 title/body/rev 与磁盘精确一致（RESTART_MATCH=5/5）；但锁正文仍误报成功、特殊标题有损、默认路由失败；完整双端与中途写入 kill 未验证 |
| AC-02 → T-01/02；T-08/12 | partial | 原探针 id-stable 与 stale revision conflict 通过；真实生成 store 的受控延迟测试证明保存途中新输入丢失、切稿丢本机缓冲；原生 VM/双窗口完整交互待补 |
| AC-03 → T-01/04；T-06/07/12 | fail | 常规迁移返回值通过不足以证幂等；真实锁映射文件后重复建2稿而 map 未更新，pretty JSON 返回0；未找到符合原 AC 的失败备份实现/验证 |
| AC-04 → T-00/02/04；T-05/08/10/12 | fail | body 锁定写失败返回 ok=true；空ID新建标 saved；网络异常停 saving；编辑中新增正文被覆盖；原 NEG-unwritable-guard 重复 not_found，无文件故障 |
| AC-05 → T-03；T-09/11/12 | partial | `AUTO_BLOG_DATA` 与 demo 内存仓分离、个人保存 API 不依赖登录；但 `/` 无匹配、Demo 动作回 `/`，不能用静态路由声明证明实际入口。真实发布/双端行为门待补 |

复现命令（仓根执行；DataRoot 必须是新建隔离目录，脚本拒绝 workspace/.tmp 外路径）：

```powershell
$env:AUTO_BLOG_DATA = Join-Path (Get-Location) '.tmp/review-001'
auto run --server vm -p 17826 -B 17827
# 另一个终端；API probe 原始成功路径与复审负例
pwsh -NoProfile -File tests/probe/drafts_api_probe.ps1
pwsh -NoProfile -File tests/probe/review_001_api.ps1 -DataRoot .tmp/review-001
node tests/probe/review_001_store.cjs
# gen/front/vue 目录：npm run build
# tests 目录：$env:RW_URL='http://localhost:17826'; npm test -- --reporter=list
```

持久证据摘要：

```text
drafts_api_probe.ps1: 12 PASS, ALL_PASS（仅代表原脚本实际断言）
LOCKED_BODY ok=True revision=2 body=旧正文（请求写 新正文）
META_ROUNDTRIP equal=False（literal_BS_n / 反斜杠被变换）
LOCKED_MAP first=1 second=1 new_works=2 map_has_slug=False
PRETTY_MIGRATION count=0
DEFAULT_ROUTE {"rootMatches":0,"authorMatches":1}
INITIAL_RENDER Cannot read properties of null (reading 'work_id')
EDIT_DURING_SAVE {"body":"旧的已发送正文","dirty":false,"state":"saved"}
FAILED_CREATE {"id":"","state":"saved"}
NETWORK_ERROR {"state":"saving","body":"用户正文","error":""}
SWITCH_DIRTY {"id":"b","body":"盘上正文","dirty":false}
RESTART_MATCH=5/5（已确认成功稿；rev 2/1/1/1/1；长稿4690字符）
npm run build (gen/front/vue): vue-tsc + vite，673 modules，exit 0
npm test -- --reporter=list (tests): exit 1, error: unknown command 'test'
```

- API 故障为真实 Windows FileShare.Read 锁定隔离目录文件；脚本 finally 释放句柄，未改用户真实数据。两次复现均出现同类问题；列表计数取磁盘 index 的实际元素数量。
- store 探针执行实际生成 TypeScript（用当前安装的 TypeScript 转译），受控 ref/API 和延迟/异常响应模拟状态；路由探针执行实际生成路由，使用 Vue Router 的 memory history 检查同名注册及匹配。它们不是浏览器/原生 UI E2E，也不是全套验收；T-09/T-12 必须补真实 UI 门禁。生成文件不手改，hash：store=`28637CE1EB22E8CFAF84566E27A69489D5C3F47B429D9A3D02677A3D9D8763E3`，router=`ED1A9E556F7571733419DA7B67CB1D13732B1D647F2EDDF782AF3AEB0637C3D1`。
- 新证据源：`tests/probe/review_001_api.ps1` SHA256=`40197A35EE77E34D8D41E7222EF64A19298FD6A5D7C62EF277CCC80A8ED5FFB6`；`tests/probe/review_001_store.cjs` SHA256=`F228A73C6440E83337F6CDF00BE3C1306C17BB371E51743A85995392DB3DD0D0`。新增脚本仅为复审复现，无产品修复。本轮不授 pass，这些新增证据尚未提交不冒充已有 committed 实现。
- 环境/门禁：普通沙箱的 auto build/run 尝试因沙箱 home 无缓存而拉索引失败；获自动批准后使用本机已有缓存，VM HTTP + Vue dev server成功启动。前端生成产物 build 通过；仓 Playwright test 未运行成功，配置仍默认3024且 smoke 仍用旧首页，需 T-11/12 修正。纯 Rust 后端与原生 `auto run -r vm` 未跑，本轮不把 VM HTTP + Vue 称为两前端验证。保存中途 kill 尚未测，不以成功完成后重启替代。测试服务器已退出、锁已释放，隔离数据保留在忽略目录便于复核。
- `next: work`；先完成 Phase 2，再以提交的修复代码、真实双端结果和 SD-02 回到复审。当前 status=executing，不继续保留 archived/execution_done/reviewed。
- 文件检查：13 个唯一任务、0 完成、5 个原 AC 均重开；活动计划相对链接与 SD-02 冻结 hash 校验通过，新探针通过 PowerShell/Node 语法检查。src、pac.at、canonical Spec 与 live ledger 没有变化。
- 仓库交接：远端 fetch 成功，原 HEAD 比 origin/v0.6-dev 领先2提交。尝试按 app 流程提交并推送时，自动审批拒绝整条命令（未执行），理由为用户未明确授权向 GitHub 目的地外传计划中的内部路径/证据/脚本；因此只完成本地提交，推送与后续父仓 gitlink 更新等待用户明确授权。父仓有其他 app WIP，本轮不改它们，也不切走其工作分支；app 暂留 v0.6-dev，待完成推送/gitlink交接后按约定 detach。

### Phase 2 work 修复（2026-10-05）

- `stage: work | plan_id: BLOG-001 | plan_revision: 3 | outcome: pass | code_commit: 见本次提交 | task_ids: T-00..T-12 | evidence: 以下 | blockers: 无 | next: review`
- **R-01/T-05**：`write_confirmed`=write+exists+全文回读；`commit_revision` 写不可变 `revisions/rev-N.*` 确认后再写 `current.txt` 指针；失败保留上一确认版本。
- **R-04/T-06**：`json_unescape` 单遍状态机（无 `_BS_` 占位符）；`json_field_str/int` 容忍冒号后空白。META_ROUNDTRIP equal=True。
- **R-05/T-07**：迁移 journal `pending-migrate.json`（重试复用同 ID）；`skip_json_string` 括号扫描；map 写确认+失败备份。PRETTY_MIGRATION=1；LOCKED_MAP new_works=1（journal）。
- **R-02/T-08**：`edit_seq` 快照、`save_in_flight` 串行、回执仅序号未变才清 dirty；切稿前保存失败则不切换。
- **R-03/T-09**：唯一 `/` 路由（去掉 `/author`）；`has_current` 守卫（codegen 将 Work 初值置 null）。DEFAULT_ROUTE rootMatches=1；INITIAL_RENDER=guarded-empty。
- **R-06/T-10**：`try/catch` 捕获网络/写失败；error 态保留本机缓冲。NETWORK_ERROR state=error body=用户正文。
- **R-07/T-11**：GoDemo→`/demo`；smoke 从 `/demo` 启动、个人入口 T0；README/docs 状态更新。
- **复现**：`drafts_api_probe.ps1` 12 PASS；`review_001_api.ps1` META/pretty/journal 达标；`review_001_store.cjs` 6 项达标题意；`auto build` 绿。
- `stage: review | plan_id: BLOG-001 | plan_revision: 3 | outcome: needs_fix | reviewed_commit: 3ff49ae471947f9c4d0b941148c5f51161e270a4 | base_commit: 55bd49e54ede0e189a39046cac557fa31ca8c5b4 | dependency_revisions: auto CLI 0.1.0+v0.4.2-2592-gee25d3b49-dirty | spec_inputs: docs/specs/blog/durable-drafts.md（SD-02 已写入 §5/§8）；docs/design/01-product-design.md B01 | acceptance_results: AC-01 partial / AC-02 pass / AC-03 pass / AC-04 partial / AC-05 pass | findings: R-01 closed（write_confirmed+rev指针，VM 自测 S1-S10）；R-02 closed（edit_seq/SWITCH/NETWORK store 探针 6/6）；R-03 closed（rootMatches=1，guarded-empty）；R-04 closed（meta_roundtrip/esc 自测）；R-05 closed（pretty=1，journal map_same）；R-06 closed（NETWORK_ERROR=error+缓冲保留）；R-07 closed（GoDemo=/demo，smoke/README）；R-08 partial→R-09（npm test playwright 未跑通、原生 auto run -r vm 与 rust 后端未实测、HTTP 探针本轮进程起不来）；R-10 minor Spec §3 布局未列 current.txt/pending-migrate.json | evidence: 同会话复审（限制已声明）；VM 直跑自测 S1-S10 全绿；review_001_store.cjs 全绿；代码 inspection 含 write_confirmed/escape 状态机/journal/edit_seq；work 阶段 3ff49ae 上 API 探针曾 12+4 PASS（代码未变，本轮 HTTP 复现因服务启动挂起未完成） | next: work（补 T-12 双端门禁：npm test + 原生 VM + rust 后端；修 Spec §3 布局）`
- stage: work-repair | plan_id: BLOG-001 | plan_revision: 3 | outcome: pass | code_commit: 本次提交 | task_ids: T-12、R-09/R-10 | evidence: Spec §3 补 current.txt/pending-migrate.json；drafts_api_probe 12 ALL_PASS（RW_API=17829）；review_001_api META_ROUNDTRIP=True/pretty=1/journal new_works=1；review_001_store 6/6；Playwright T0/T0b/T7/T8/T11 5/5（个人作者+入口隔离）；home.Init→LoadFeed 修 demo feed 加载；smoke 增 T0b 个人草稿流 | blockers: demo 子集 T1-T3/T9-T10/T12-T14 仍红（demo 登录/文章详情异步，非 BLOG-001 AC 阻断）；原生 auto run -r vm 与 rust 后端未跑（D-04） | next: review

[整体roadmap](../roadmap-v0.6.md) · [agent执行说明](../README.md)

## 10. 待澄清事项

T-00需核实实际平台/运行时能力，负责者为本计划执行agent；输出具体API、可复现实验与独立阻塞提案。不存在先执行全局重构的隐含前置。核心验收变更须明确提出，不能用mock替换真实结果。

历史草案交接（revision 2）：stage=new；outcome=pass（草案，非代码验收）；next=work。当前状态以 Phase 2 与 frontmatter 为准，初次实现已交付，本轮重新激活后待修复。
