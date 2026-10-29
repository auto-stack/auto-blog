---
plan_id: BLOG-004
status: executing
feature_name: dual-runtime-acceptance
author: [Codex]
created_at: 2026-10-29
updated_at: 2026-10-29
plan_revision: 2
current_step: 1
total_steps: 10
depends_on: ["BLOG-001", "auto-lang/PLAN-885", "auto-ui/PLAN-003"]
supersedes_spec_components: ["docs/specs/blog/durable-drafts.md"]
new_spec_components: ["docs/specs/blog/runtime-acceptance.md"]
touched_goals: ["auto-blog/first-real-release"]
---

# BLOG-004：Rust后端与原生VM界面运行及验收补齐

## 0. 变更摘要

接续已归档BLOG-001的D-04/R-16（Rust后端）和D-06（原生VM UI）两个缺口；001的草稿功能与历史记录不重开；来源为 [已归档001](archived/001-durable-drafts.md)。BLOG-002/003已有编辑器/资产预览与发布包合同，本计划不占用或启动它们。本计划交付完成前，总表保持“本地草稿能力已实现、双端运行验收待补齐”，不能仅凭001 archived将Blog升为完整A类。

## 1. 目标

默认Rust API后端能从纯.at生成、编译、启动并处理真实草稿；Vue＋Rust后端与原生VM窗口＋Rust后端都完成新建、编辑、保存、冲突反馈、失败保稿、强制退出重开。固定应用/工具链/依赖版本，提供可重复执行且能传播失败的验收入口。

非目标：新编辑器、富文本、资产/预览、导出/发布包、社区/认证重构、Linux适配及全框架重构。Linux仍等auto-os-distro的Nix＋COSMIC基础；当前Windows双端不依赖发行版完成。

## 2. 架构方案

主导仓为auto-blog，唯一应用开发/顺序复审检出 `D:/autostack/auto-blog`，main；`auto-os/apps/auto-blog` 仅组合固定pin。一个写入者，不建外部app worktree、不建junction/symlink。应用后端保持纯.at，禁止手修生成Rust、添加手写Rust业务后端、把pac默认api改成vm逃避Rust验收。

依赖为单向：语言生成链与UI驱动各自交付 → Blog接入并做最终组合验收；两份框架计划不反向等待BLOG-004完成。框架成功只能解除对应前置，不能替代Blog实际UI用户任务。

- [auto-lang/PLAN-885](D:/autostack/auto-lang/docs/plans/885-blog-generated-rust-backend-parity.md)：公开生成入口、runtime路径/类型/借用等必要兼容性；实际缺项由首探针定界，59为历史记录不是当前错误数量承诺。
- [auto-ui/PLAN-003](D:/autostack/auto-ui/docs/plans/003-blog-native-vm-run-and-acceptance.md)：原生VM窗口/进程/驱动可验证性，允许以真实VM HTTP做独立隔离；该隔离腿不关闭Blog的默认Rust后端组合门。
- 若新鲜证据落到auto-man CLI编排，先登记实际owner的最小前置Plan与关闭条件再修改该仓，不能在Blog越仓补丁或把两份前置误称覆盖所有未知问题。

## 3. 技术栈

现有Auto/AutoUI、Vue、原生VM/AutoUI MCP、a2r生成Rust API；正式验收为 `auto run --server rust` 与 `auto run -r vm --server rust`。`auto service --server rust`用于API隔离；`auto run -r vm --server vm`只供原生窗口问题定位。CLI帮助已确认server/render/back-port参数存在；实际MCP协议与可用工具版本由T-01固定，不能编造动作API。

现有端口17826/17827；测试可使用明确空闲端口并贯穿前后端/MCP配置。环境变量 `AUTO_BLOG_DATA` 必须作用到实际后端，不只设在外层shell。启动错误/超时/退出都算失败，不能靠重复切环境直到“看起来绿”。

## 4. 需求分析与背景调查

用户2026-10-29明确授权“建立Blog后续计划，专门补齐Rust后端和原生VM界面的运行与验收，关联必要框架前置计划，并更新总跟踪表”。本轮只编制合同、必要反链与组合pin，不实施代码、不运行全局Cargo门、不宣布运行缺口已关闭。后续执行须按四技能进入work；未指定模型、独立会话、自动续跑或并行agent。

观察基线：Blog `3fdf7289a4e227a40cf7f63a63ae632e6730f803`，001最终代码复审为db207f2，至本基线src/tests/pac无差异；当前main已有001收尾提交尚未推远端，计划文档交付时按现有流程一并核对线性历史。源码/规范观察：

- `pac.at` — SHA256 `f35dd54263592ef6a05f820001b33a8547fe2e380a18218ba40cf6c54b2cb4c0`。
- `src/back/api.at` — SHA256 `2b7956deadb7072702a96809d14360c9a48f8f4b1428827ac1caf4caa4f6694f`。
- `src/back/db.at` — SHA256 `4e652fb0baf07d576207599d8d7701467386e1fc176db10b21bfd6d6b221f11d`。
- `src/back/works.at` — SHA256 `ed8eab0cd31158f46cdbe322bfc4576f3b3ce27f322c5f6114db0878be44d319`。
- `src/back/drafts.at` — SHA256 `02068e695fd3d770d78d6a7cea8bd006ccc01d514d2b870544d4a677e7f6af15`。
- `src/front/app.at` — SHA256 `edd8955c497d982b03551d1d505dbfdb585cf603a663674769b492c4c9c415a2`。
- `src/front/pages/author.at` — SHA256 `8852ea753364c41f283440bac054f4180070572f21ea22ad9ebcbef25291b297`。
- `src/front/draft_store.at` — SHA256 `570ddedec0a4ecaca0bdb698439b1b2317535c398911d2f5f8506ec70f81ccde`。
- `docs/specs/blog/durable-drafts.md` — SHA256 `8f9363f8c657ce3bc7bfe806e23fbc492ce128068c082061a3957627691e4790`。
- `docs/plans/archived/001-durable-drafts.md` — SHA256 `ea8eda4eaa9a6b74706a7073081bae8bc351c19f76b0667f7c9378c7d25193a5`。

001记录：Rust a2r产物59 errors（含time路径、E0308/E0061/E0277/E0599），原生VM UI四轮不可驱动；前次核查仅VM HTTP＋Vue/存储证据。2026-10-29独立抽查Blog七项真实VM HTTP持久化路径通过，不能推出Rust或原生窗口通过。当前独立a2r-std已导出time，而API生成器 `qualify_a2r_std` 的路径分流与内嵌facade并不等同；这是调查线索，不预先断定所有59错的根因。

已归档001内容hash在本轮前后保持；现存002/003不变。

## 5. 详细设计

### 执行入口与依赖门

首个可执行任务仅T-01（无框架交付前置）：核对HEAD/WIP，记录应用/CLI/lang/ui/man四仓实际源码与可执行文件指纹、启动命令、数据目录、测试端口；各做一次Rust生成/冷编译与原生VM启动诊断，形成拟新增 `docs/plans/evidence/004/baseline-and-routing.md`。没有进展时明确非零/超时与owner，不进入无界重试。

T-02/T-03消费实际前置回执（已交付commit＋适用生成/运行证据），不是看到draft、archived或文件存在就放行。若问题在当前版本不再复现，仍以有效正控＋历史反例/原因核对关闭，不能伪造“修了59处”。T-04..07按实际声明profile分别运行，默认Rust、原生VM原样保留。

持久化、幂等迁移和缓冲保护沿001/current Spec，不能为修转译而删除条件revision/回读保护或改成内存种子。原有demo域失败按原始范围归因；若阻止默认个人作者入口或影响共享运行链，就属于本计划阻断，不能统称既有红而跳过。

### 规范增量

| delta_id | action | docs/specs target | before/after rule | rationale | AC |
|---|---|---|---|---|---|
| SD-01 | modify | docs/specs/blog/durable-drafts.md §8 D-04/D-06 | Rust/原生UI未验 → 经版本绑定证据关闭的准确支持范围；未通过前保留限制 | 不抹去001边界，不用环境债替代必需门 | AC-02..06 |
| SD-02 | add | docs/specs/blog/runtime-acceptance.md（拟新增） | 无统一合同 → 两profile、后端真实身份/数据根、用户任务、失败/恢复、工具前置和证据口径 | 后续可复验 | AC-01..06 |

本轮不修改canonical Spec或ledger；T-08仅准备增量，最终复审后由merge沉淀。

## 6. 测试设计

证据政策：原始日志/编译诊断/截图/探针输出放本地 `docs/plans/attachments/`（不提交非md证据）；Plan内保留命令、退出码、版本、关键结果及本地路径+内容hash摘要。不得以日志里的pass字样代替断言。所有测试使用独立数据目录与明确端口；先检查占用，只关闭本次创建的PID，不批量杀同仓或其他用户进程。

| case_id | AC / owner | 输入与实际入口 | 可区别错误实现的判据 |
|---|---|---|---|
| V-01 | AC-01/02，T-01/04 | 清洁应用构建输出、固定工具链，`auto service --server rust`真实生成/编译 | 编译exit0、运行正确二进制hash；原time/List/借用诊断逐组有归因；实际API创建并回读，不只cargo check |
| V-02 | AC-03，T-05 | `auto run --server rust`真实Vue，空目录输入中文/引号/换行稿并改标题 | 磁盘与独立HTTP读回对应同work_id/revision；手动和3秒自动保存都正确，页面刷新与后端重启不丢已确认数据 |
| V-03 | AC-04，T-06 | `auto run -r vm --server rust`，真实原生窗口经实际MCP/驱动输入、选择、点击 | 事件到达原生widget/store并产生正确后端数据；不是后台直接POST后只截一张窗口；正常关闭与硬终止重开保持数据 |
| V-04 | AC-05，T-04..06 | 同旧rev双写、目标open等待期继续编辑、不可写/断连 | 后端拒绝陈旧写；两端保留新输入、显示error/conflict而非saved；恢复服务可重试，001原缓冲保护反例复用并绑定当前源 |
| V-05 | AC-05，T-07 | 实际损坏当前revision的body/ok、合法旧稿迁移/坏类型迁移、写中杀进程 | 沿当前Spec的指针/清单语义报错或恢复；非法迁移零写、合法迁移幂等；不能以删数据重建取得绿灯 |
| V-06 | AC-05，T-07 | 对验收驱动注入失败（如不可达独立端口/错误预期），另跑合法控制 | 入口非零且保留失败；合法控制重新通过；跳过、0场景、timeout不可计pass |

拟新增永久入口（T-04建立，不是当前已存在脚本）：`python tests/dual/verify_dual.py --profile vue-rust` / `--profile native-vm-rust`。每次输出真实场景明细/所选数/依赖与artifact hash；UI启动资料与日志按profile独立隔离。既有 `tests/probe/review_001_r5_store.cjs`、`review_001_r6_review.ps1` 和drafts_api_probe按变更触面复用，mock store只作反例单元检查，不能替代V-02/03。

执行与最终复审角色顺序分离；无授权独立agent时如实记录同上下文限制，从工件重建，不自称独立。代码/输入/配置未变可复用明确绑定旧证据；本计划两条缺口不得仅沿用旧VM HTTP记录。冻结后由最终review/merge约定owner运行一次统一应用门，修复只重跑受影响项。

## 7. 验收标准

| ID | owner_stage | 结果与关闭证据 |
|---|---|---|
| AC-01 | work | 当前错误/原生启动失败可复现或有不复现的有效正控；逐根因归组、owner/前置/关闭条件、真实版本/数据根/配置可追溯，无未具名必需路径 |
| AC-02 | work | 纯.at经公开入口冷生成、Rust编译exit0，真实服务健康/草稿创建/读取/保存/迁移/条件revision与001语义一致；time产生有效epoch而非0，占位/手修生成物不算 |
| AC-03 | work | Vue＋Rust后端从真实输入完成创建、编辑/自动保存、重开及可见冲突/失败保护；数据与HTTP/磁盘一致 |
| AC-04 | work | 原生VM真实窗口＋Rust后端完成同一任务及正常/异常退出后恢复，驱动行为确实到达UI；VM HTTP隔离或窗口可见不能代替 |
| AC-05 | work | V-04/05/06含失败控制及恢复后的下一次操作通过；驱动不可用/超时/零选择明确失败，两条profile永久入口可重复运行；无必需门pending |
| AC-06 | review | 冻结提交/依赖对照AC-01..05与SD-01/02最终复审；无未闭框架或环境缺口，不把必需门改称债务；保留001与002/003原范围 |
| AC-07 | merge | 相应最终门通过后沉淀Spec/ledger、归档004并推送app；AutoOS只更新本app精确交付pin、健康门/组合验证与总表，子模块clean/detached、开发clone留main；Linux仍WAIT_DISTRO_M1 |

## 8. 执行步骤

- [x] T-01（owner_stage=work；依赖无；AC-01）：当前版本/两条全路径诊断与错误归组，输出baseline-and-routing.md；先固定真实工具链和数据目录，准备前置消费清单。证据：[docs/plans/evidence/004/baseline-and-routing.md](evidence/004/baseline-and-routing.md)（四仓 HEAD/CLI/源文件指纹；`auto service --server rust` 冷生成成功、`cargo build` exit 101 复现 001 同款 59 errors 并按 E0433×7/E0308×31/E0277×10/E0061×9/E0599×2 归组；`auto run -r vm --server rust` 因 Rust 编译门失败、`-r vm --server vm` 后端 VM HTTP 22 routes 可起但前端 17826 无监听且无原生窗口）。原始日志 docs/plans/attachments/004/（不入库）。
- [ ] T-02（owner_stage=work；依赖T-01、auto-lang/PLAN-885实际交付；AC-02）：消费语言侧修复/无需修复回执，用其固定版本重新生成Blog Rust后端；只做必要纯.at兼容接入，不动已验存储语义；缺口未闭不继续Rust验收。
- [ ] T-03（owner_stage=work；依赖T-01、auto-ui/PLAN-003实际交付；AC-04）：接入已验证的原生启动/驱动入口，保留其VM HTTP隔离证据身份；若应用.at接缝需修，局限于既有作者任务，登记真实代码修改。
- [ ] T-04（owner_stage=work；依赖T-02；AC-02/05）：建立tests/dual/verify_dual.py调度/隔离/失败传播，接真实Rust API电池及001存储负例，不建立第二套存储实现。
- [ ] T-05（owner_stage=work；依赖T-04；AC-03/05）：Vue＋Rust真实交互、自动/手动保存、冲突/错误/重启回放，保存有区分力的UI与数据证据。
- [ ] T-06（owner_stage=work；依赖T-03/T-04；AC-04/05）：原生VM＋Rust真实窗口任务及退出恢复；缺驱动/环境则具名阻塞，不用Vue、API或mock顶替。
- [ ] T-07（owner_stage=work；依赖T-05/T-06；AC-05）：冻结双方profile场景与独立数据oracle，验证负控非零/正控通过；核查001保稿、恢复/迁移与下次恢复操作，无未执行必需门。
- [ ] T-08（owner_stage=work；依赖T-07；AC-01..05）：准备SD-01/02可审查增量，提交实现/测试/摘要，复核HEAD/依赖未漂移，转execution_done；本步不把尚未关闭的门算完成。
- [ ] T-09（owner_stage=review；依赖T-08；AC-06）：同一clone停止实现，按冻结输入做最终复审；记录上下文独立性限制；无pass不进入merge。
- [ ] T-10（owner_stage=merge；依赖T-09；AC-07）：完成必要统一门、Spec/索引/归档、app推送和AutoOS精确pin/组合健康验证；更新总表并显式detach组合子模块，独立clone留main。

## 9. 复审记录

r2起草校正：AC-02将泛称“CRUD”展开为001实际已有的创建/读取/保存/迁移，明确不加入删除草稿新功能；T-01..10与其余AC不变。r1原稿保留于 `d844b8b5223f8197441704cfb9a4b67d0deb0ba2`，本修订继承用户原运行验收范围。

stage: new | plan_id: BLOG-004 | plan_revision: 2 | outcome: pass（首个有界诊断任务就绪；两份前置仅draft，运行缺口未关闭） | next: work/T-01（另行执行）。T-02/T-03等实际前置交付，未实施、未跑构建/双端验收，10项任务全部未勾选。001归档与002/003原合同保持。

stage: work | plan_id: BLOG-004 | plan_revision: 2 | outcome: partial（T-01完成，T-02..T-08阻塞于前置未交付） | worktree_path: D:/autostack/auto-blog（main，本计划合同不建外部app worktree） | branch: main | base_commit: 48e0c831fb99fca73d8db64845d367ec22ba8f75 | code_commit: 无源码改动（仅docs） | dependency_revisions: auto-lang 69d90c52（885仍drafting/step0）、auto-ui b00fd30（003仍drafting/step0）、auto-man e6cc06f | task_ids: T-01（已勾选并附证据） | evidence: docs/plans/evidence/004/baseline-and-routing.md（四仓指纹；`auto service --server rust`冷生成成功；`cargo build` exit 101 复现59 errors=E0433×7/E0308×31/E0277×10/E0061×9/E0599×2；`-r vm --server rust`因Rust编译门整体不可运行；`-r vm --server vm`后端VM HTTP 22 routes可起但前端17826无监听、无原生窗口；AUTO_BLOG_DATA实现已读但运行时实测被编译门阻断）；原始日志docs/plans/attachments/004/（不入库） | blockers: auto-lang/PLAN-885、auto-ui/PLAN-003 均仍drafting/step0（仅prepare提交57382e9c0/d5c7b86），无实际交付回执可消费 | next_responsible_role: work（T-02/T-03），等前置实际交付。

stage: goal | plan_id: BLOG-004 | plan_revision: 2 | round: 1 | from: new | to: work | status: executing | outcome: blocked | worktree: D:/autostack/auto-blog/main | commit: （docs未提交，待T-08统一提交） | next: user

## 10. 待澄清事项

无须再次确认Rust/原生VM是否必须完成，用户已明确要求。技术不确定性由T-01及两份前置首任务负责：当前编译诊断数量/根因、CLI/ui工具是否旧构建、原生窗口是否有可驱动会话、真实数据env传递。如果需要外部交互桌面或越出已登记仓的能力，给出具体条件并保持依赖阻塞，不能静默修改验收口径。

前置规划登记：auto-lang/PLAN-885 本地提交 `57382e9c046dee861b3d916d7eddd93b70e194df`；auto-ui/PLAN-003 本地提交 `d5c7b865c442d8f82a4afebb972f7f6d27bd1c89`。框架仓原有未推送历史及在途WIP未随本次起草推送；执行者使用上述本地主检出合同，框架交付时再登记实际发布版本。

## 11. T-01 阻塞（goal round 1）

T-01 已完成（见 §8 证据与 §9 work 回执）：当前版本可复现 001 同款 59 Rust errors 并完成根因归组（time 路径/字符串借用/int 宽度/模块类型/函数签名，全部归 auto-lang/PLAN-885），原生 VM 前端窗口未启动（归 auto-ui/PLAN-003）。**T-02/T-03 需要两份前置的实际交付回执（已交付commit＋适用生成/运行证据），当前两者均仍 drafting/step0（仅 prepare 提交），故 work 阶段阻塞**。

解除阻塞动作（精确）：在 auto-lang 执行 PLAN-885（先其 T-01 诊断再修复，交付 885 回执）并在 auto-ui 执行 PLAN-003（交付原生窗口正控回执）；各自回执到位后回到本计划继续 T-02/T-03。无需重新授权——用户 2026-10-29 已明确要求补齐 Rust 后端与原生 VM 运行验收。
