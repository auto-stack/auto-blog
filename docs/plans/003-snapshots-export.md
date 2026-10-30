---
plan_id: BLOG-003
title: "固定版本与本地发布包"
status: drafting
feature_name: "固定版本与本地发布包"
author: [Codex]
created_at: 2026-10-04T00:00:00Z
updated_at: 2026-10-30T00:00:00Z
plan_revision: 3
current_step: 2
total_steps: 5
created: 2026-10-04
base_branch: main
base_commit: e6877ca7d0e02e6ea2d0f3910c78c67f74fa0e11
depends_on: ["BLOG-002"]
supersedes_spec_components: []
new_spec_components: ["docs/specs/blog/snapshots-export.md"]
touched_goals: ["auto-blog/first-real-release"]
---

# BLOG-003：固定版本与本地发布包

## 0. 变更摘要

修订3（2026-10-30）：按已交付基线（001 草稿存储、004 双运行时验收、002 编辑器/资产/导入）修订工作位置、运行/验收合同、模块定位与任务设计；任务/AC 语义保持原意（B05/B06 本地发布包），代码尚未实施。前次（rev2, 2026-10-04）仅获授权编制设计/roadmap/实施计划。

## 1. 目标

覆盖需求：B05、B06（本地历史）（定义见[产品设计](../design/01-product-design.md)）。依赖：[BLOG-002](002-editor-assets-preview.md)

原始导入commit用于识别来源，不要求后续计划回退到该commit；实际开工从 D:/autostack/auto-blog main（修订时 HEAD e6877ca）及已验收前序计划（001/004/002 均已交付归档）起步。T-00 是有限能力核查（二进制资产管道 / HTML 生成途径 / 打包形态），若需跨仓 runtime 改动（如 a2r 生成器暴露新面），提交单独设计/计划，当前任务保留未完成验收，不偷偷将真实能力换成 stub。

## 2. 架构方案

publications（不可变快照/发布状态机）+ exporters（Markdown+manifest 与 HTML+assets 打包）+ 历史/导出 UI；不部署外部站点、不建设真实社区。

当前定位（2026-10-30 实况）：后端 `src/back/{api,db,drafts,works}.at`（001/002 交付面）；前端 `src/front/pages/author.at`（写作/预览/资产/导入）+ `draft_store.at`；测试 `tests/dual/{verify_dual.py,vue_ui_scenarios.cjs,native_vm_scenarios.py}`、`tests/probe/`、fixtures `tests/fixtures/{authoring,exports/}`。新增模块建议：`src/back/publications.at`、`src/back/exporters/`（md/html 两个纯文本打包器）、历史/导出 UI 并入 author.at 或新页（开工核对后可小幅调整并记录）。禁止修改源demo、SOURCE-IMPORT.json、source-sync基线、未同步的四大app及AutoOS主桌面协议。后端纯 .at，不手改生成 Rust；跨仓依赖单独登记。

## 3. 技术栈

AutoLang/AutoUI `.at`、既有Vue/VM宿主；后端纯.at。协议使用版本化数据，原生能力经adapter接入，不手改生成Rust。

## 4. 需求分析与背景调查

修订3（2026-10-30）：①工作位置按 004/002 交付合同=D:/autostack/auto-blog 独立 clone 的 main（rev2 的 auto-os/apps 检出约定作废）；②运行/验收合同已固化于 [docs/specs/blog/runtime-acceptance.md](../specs/blog/runtime-acceptance.md)（vue 腿 build+preview=F-2、原生腿 MCP 驱动、双 profile 统一门）；③002 交付面事实：AssetRef/SourceRef=JSON Lines 追加形态（F-8：禁对中文内容做 len/slice 索引）、资产现为 http/local 引用（sha256 对远程显式 null）、`asset-check` 端点已在；④a2r fs 已存在 `read_bytes/write_bytes`（未经 .at 可见性/VM parity 实证——T-00 首项）。

授权：2026-10-30 用户指示启动 M3（/auto-plan-new BLOG-003）=本计划修订授权（计划准备）。代码实施授权沿用 002 模式：修订交付复审通过后由用户明确启动（"执行计划"）。产品方向讨论不是代码实现已批准的证据。

版本证据：frontmatter base_commit（修订时 HEAD e6877ca）与 SOURCE-IMPORT.json；源码路径见§2。本仓已有三份 canonical 规范（durable-drafts/runtime-acceptance/editor-assets-preview）；003 新增 snapshots-export（SD-01）。AutoOS规约见其AGENTS.md，AutoLang知识规则见docs/specs/README.md。

## 5. 详细设计

### 规范增量

| delta_id | add/modify/retire | 目标 | before/after rule | 理由 | 验收 |
|---|---|---|---|---|---|
| SD-01 | add | docs/specs/blog/snapshots-export.md | 本模块尚无app级current-state Spec → 记录实际实现的接口、恢复/错误及能力边界 | 供后续agent使用，设计提案不能冒充实现 | AC-01–AC-05 |

### 可执行任务

T-00先行；T-01→T-02→T-03→T-04顺序实施（owner_stage=work）。T-00输出能力报告+决策工件，T-01形成快照/历史接口，T-02/03接入实现，T-04完成双轨验证与文档。T-00/04核查AC-01–05全体，中间任务按对应行为覆盖。每项实测命令/证据写入§9，不把未创建的测试入口说成已有。

- [x] T-00（决策工件，先行）：能力核查——①二进制资产管道：a2r `fs.read_bytes/write_bytes` 的 .at 可见性与类型映射、VM 轨 parity（合并模式 shim）、base64/编解码可得性；②HTML 生成途径排序：vue=引擎 DOM 采集（rich-html/innerHTML→交后端入库为文本 artifact）vs 后端纯 .at 模板（禁自写正则渲染器）vs 跨仓 autodown-core 提案；③打包形态：目录树（相对路径引用）为默认，zip 可选。输出：能力报告+决策记录（§9），AC-01/AC-04 的机制路径据此落定。
  [✅ 已完成] 决策=**D1 base64-at-rest 纯文本资产管道**（ingest=前端 base64+crypto.subtle sha256→write_text(assets/<id>.b64)；export=read_text/copy+data-URL 自包含 HTML；字节保真=b64 无损+sha 存证+迁出解码说明）。关键事实：VM 独立脚本 []int→stdlib shim 断裂（Invalid list ID，**F-9** 登记，产品 rust 后端不受影响）；str→[]int 无 .at 原语；base64/hex 为 #[vm] str 面；file.copy 双轨可见 ✓。HTML=vue 引擎 DOM 采集（VM=边界说明）。探针 tests/probe/export_cap_t00.at；报告 `attachments/003/t00-findings.md`。
- [x] T-01：`src/back/publications.at`——从已保存 revision 生成不可变 snapshot（meta/body/asset_refs/source_refs 冻结副本）+ Publication（publication_id、work_ref+revision、content_hash、target、artifact_refs、state=exported/published/withdrawn、created_at）+ 历史列表/打开 API（复用 001 存储纪律：write_confirmed/JSON Lines/清单化提交；禁逐字节扫描）。
  [✅ 已完成] Publication={publication_id,work_id,work_revision,title,content_hash,target:local,state,created_at,artifact_refs}；正文冻结=引用 works revisions（不复制）；content_hash=内容签名 sig-<h>-<len>（len/replace 算术、非加密、F-8 免疫）；API：POST /api/works/:id/publish（条件 rev、冲突无半成品）/ GET /api/works/:id/publications / GET /api/publications/:pid / POST withdraw；状态机 snapshotted→exported、→withdrawn、published 不可达（AC-05 在 API 层强制）。**电池 7/7**（`PUB_API=http://127.0.0.1:17827 python tests/probe/probe_pub_api.py`，PUB-01..07，隔离 .tmp/t01-pub-data）。新发现（已绕行；spec 待记）：**F-10** a2r 名字解析对「内建调用实参含本地 2 参函数调用」断裂（E0201 无名字输出）→ 路径纯串接；**F-11** 用户函数「字段访问」实参（fn(w.body)）同断 → 提升局部变量。
- [ ] T-02：`src/back/exporters/`——按 T-00 决策实现 Markdown+manifest（来源/格式/版本/hash）与 assets 打包（字节管道按 T-00 决策；相对路径、无越界写、无绝对本机路径）；导出=临时目录完整校验后落地，失败/中断不记 exported/published；重试不覆盖已存在不同版本。
- [ ] T-03：前端历史/导出 UI（author.at 或新页）+ HTML 生成按 T-00 决策（vue=引擎 DOM 采集交后端入库；VM 轨 HTML=能力边界说明）+ 历史比较/打开/再次输出；草稿改动不影响旧快照（AC-02）。
- [ ] T-04：双轨验证（隔离数据目录；vue build+preview、native MCP）+ 离线换目录打开实测 + 迁出/能力说明（Markdown vs HTML 差异）+ 网络发布 target 接口仅为提案；统一双 profile 门保持绿。

## 6. 测试设计

数据集：article-with-assets（含中文/列表/引用/两图）、改稿v2、重名target、missing-asset、导出中断；`tests/fixtures/exports/`（新建）。

运行/验收按 [runtime-acceptance 合同](../specs/blog/runtime-acceptance.md)：vue 腿=构建模式（F-2：dev 下含引擎路由页装载失败）+ preview 代理 /api；原生腿=`auto run -r vm --server rust` + MCP 驱动（AUTO_UI_TOOL_BIN）；隔离数据目录 `AUTO_BLOG_DATA` 直达后端，不接触用户真实数据。003 定向探针写入 `tests/probe/`（probe_export_*.py/cjs），参照 002 的 authoring_t0X/probe_vm_t0X 模式。

本仓现有测试不保证覆盖新增产品能力。先建立tests下针对本计划的可重复fixture和驱动，在报告记录确切启动/执行命令；不得编造尚不存在的npm test/cargo test入口。交付前统一门=verify_dual 双 profile 保持/恢复全绿（002 复审已建立该口径）。

正确性/恢复/协议测试与UI体验分开记录，至少覆盖一个成功与一个失败路径。现有AutoLang/AutoUI框架不改时不跑cargo全量。文档阶段不运行cargo t/docs_gen。

## 7. 验收标准（必须保留实际证据）

- [ ] AC-01: 含中文、列表、引用、两图的文章导出后换目录断网打开，资产hash与原件一致。
- [ ] AC-02: 更新草稿导出v2后v1内容hash与页面不变；ID/revision/来源正确。
- [ ] AC-03: 中断/不可写/缺资产不会出现成功发布状态；重试不覆盖已存在不同版本。
- [ ] AC-04: 导出包无绝对本机路径和越界写入，Markdown及HTML差异有能力说明。
- [ ] AC-05: 仅本地exported状态，不伪装为外部published；原demo鉴权不参与输出。


## 8. 执行步骤与交接

真实网络发布需要独立target计划、回执/认证/重试与用户明确操作，不混入当前首版；仅本地 exported 状态，不伪装外部 published。

执行上下文：本仓合同=main 唯一检出直开发（无外部 worktree）；CLI=004 冻结基线（da0558e7）；验收入口/负控/证据口径见 runtime-acceptance 合同。新需求不得在执行中无限追加；发现必要遗漏先更新计划并讨论，不直接删验收项。未交付依赖必须写明接口级与真实集成的差别。

## 9. 复审记录

- 实际起点HEAD/工作目录/工具版本：未执行。
- T0能力与阻塞报告：未执行。
- 各AC项证据路径、命令及结果：未执行。
- 独立复审：未执行；重新对照代码检查AC项、遗漏/延后/workaround、格式/告警/调试输出，不信任已有勾选。
- 债务与风险：未登记；测试真实阻塞不得伪装通过。
- 沉淀：以frontmatter spec-impact候选登记实际实现组件，更新设计能力表与稳定规范；随后翻reviewed并归档。
- 合入目标：v0.6-dev；当前未实施，不合入master、不推进OS gitlink。

[整体roadmap](../roadmap-v0.6.md) · [agent执行说明](../README.md)

## 10. 待澄清事项

T-00需核实实际平台/运行时能力，负责者为本计划执行agent；输出具体API、可复现实验与独立阻塞提案。不存在先执行全局重构的隐含前置。核心验收变更须明确提出，不能用mock替换真实结果。

草案交接（rev2, 2026-10-04）：stage=new；plan_revision=2；outcome=pass（可审查的草案，非代码验收）；next=work（选定计划并确认实施范围后）。当前均未实施。

修订交接（rev3, 2026-10-30）：stage=new；plan_revision=3；outcome=pass（基线修订就绪，待用户确认实施授权后进入 work）；changed=§0/§1/§2/§4/§5（T-00..T-04 全部重写为当前基线机制）/§6/§8+frontmatter（base→main e6877ca）；AC-01..05 与 SD-01 目标语义未变；next=work（待用户执行授权）。关键待决（T-00 决策工件所有）：二进制资产管道可行性、HTML 生成机制路径（vue 引擎采集 vs 跨仓提案）、打包形态。

stage: work | plan_id: BLOG-003 | plan_revision: 3 | outcome: partial（T-00 完成；T-01..T-04 未开始） | worktree_path: D:/autostack/auto-blog（main，本仓合同唯一检出） | branch: main | base_commit: 1f177ac | code_commit: 本提交（tests/probe/export_cap_t00.at 探针+计划簿记；产品源码零改动） | dependency_revisions: CLI da0558e7、tool 563afa4a、auto-lang 129ef6057、auto-ui 02cd088、auto-man e6cc06f | task_ids: T-00（已勾选附证据） | evidence: stdlib 实证（write_bytes/read_bytes/copy 双轨声明、base64/hex #[vm] 面、str→[]int 无原语）+ VM shim 断裂复现（F-9）；决策工件 attachments/003/t00-findings.md | blockers: 无阻塞项；F-9 跨仓观察不阻塞（D1 不依赖） | next_responsible_role: work（T-01 publications.at）
