---
plan_id: BLOG-004
status: execution_done
feature_name: dual-runtime-acceptance
author: [Codex]
created_at: 2026-10-29
updated_at: 2026-10-30
plan_revision: 2
current_step: 8
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
- [x] T-02（owner_stage=work；依赖T-01、auto-lang/PLAN-885实际交付；AC-02）：消费语言侧修复/无需修复回执，用其固定版本重新生成Blog Rust后端；只做必要纯.at兼容接入，不动已验存储语义；缺口未闭不继续Rust验收。证据：重建 auto-man CLI（e6cc06f `cargo build -p auto` exit 0，新 auto.exe SHA256 `44B23860…`，旧 `C049ABE…`；链接 auto-lang master `dacd00184`=885 交付）；正式入口 `auto service --server rust -B 17829` 冷生成+release 编译 exit 0+`AUTO_SERVICE_READY` 服务就绪（纯 .at 零改动接入，存储语义未动）。过程中发现并清除 ui-003 时期遗留的陈旧 `rust-workspace/Cargo.toml`（钉在未含 885 修复的 `.wt/ui-003/auto-lang`）——首次再生成 37 errors；删除后生成器正确解析主检出；毒化清单复现实验中被正确重写（run3），run1 的保留现象未复现（记录为观察，见 §11）。HTTP 电池 13/13 PASS：中文/长中文创建、列表/打开回读、条件保存 rev1→2、陈旧 rev 冲突拒绝、迁移幂等、not_found/坏 body 4xx/坏内层 JSON→0/空 slug→0 负例（`tests/probe/drafts_api_probe.ps1` migrate 形状修正为生成合同 `{"items":"<json>"}` 并新增外层坏 body 负例）；`AUTO_BLOG_DATA` 隔离实测（`.tmp/t02-data` 落盘 index/works/slug-map，默认目录不存在）；time epoch 有效（created_at=1793275608==now）；停服务重启后回读逐字段一致。原始日志 docs/plans/attachments/004/t02-*（不入库；battery `05e6bce3`、gen2 `86bc2eb7`）。
- [x] T-03（owner_stage=work；依赖T-01、auto-ui/PLAN-003实际交付；AC-04）：接入已验证的原生启动/驱动入口，保留其VM HTTP隔离证据身份；若应用.at接缝需修，局限于既有作者任务，登记真实代码修改。**部分完成+具名阻塞（2026-10-29 23:15）**：①**应用.at接缝已修（真实代码修改，本次登记）**——`src/front/app.at` 的裸 `store.Init()` 同时匹配 Auth/Article 两 store（均声明 Init），VM 渲染按 plan-446 A1 拒绝歧义（`ambiguous store method Init matches stores [AuthStore, ArticleStore]`，证据 attachments/004/t06-run4.log）→ 限定为 `AuthStore.Init()` + `ArticleStore.LoadFeed()`（LoadFeed 专名即此设计）+ Logout/SetToken 同步限定归属；②**接入面已实证**——`auto run -r vm --server rust`（-F/-B/-d + AUTOUI_MCP_PORT/AUTO_HTTP_PORT/AUTO_FRONT_PORT）真实窗口"博客"启动、MCP `http://127.0.0.1:<port>/mcp` JSON-RPC 驱动生效（autoui_snapshot/autoui_action press 均达 App 壳 handler `.__navigate`）、Rust 后端 api=200、跨进程数据链路通；③**剩余阻塞（owner auto-ui，VM 渲染器）**——导航 '/' 加载 **author 页静默失败**（无 Init 派发、无 panic 输出；对照：'/demo' 的 home 页同一机制加载成功 9555 字符快照；无路由单页夹具 PLAN-003 正常）→ 作者任务（V-03 输入/选择/点击到数据落盘）无法在原生窗口执行。嫌疑：author 页特有模板特性（timer 每 3s/多条件/列表）。证据 attachments/004/t06-run5.log、t06b.log。T-06 作者任务与 T-07 传递阻塞。
- [x] T-04（owner_stage=work；依赖T-02；AC-02/05）：建立tests/dual/verify_dual.py调度/隔离/失败传播，接真实Rust API电池及001存储负例，不建立第二套存储实现。证据：`tests/dual/verify_dual.py`（487 行，纯 stdlib）——`--profile vue-rust|native-vm-rust` 固定入口；预检（auto.exe SHA256/四仓 HEAD/临时端口绑定分配）；隔离数据目录 `.tmp/dual/<profile>-<pid>/data`（AUTO_BLOG_DATA 直达后端）；每 run 独立 artifacts `attachments/004/dual/<profile>-<ts>/`（service-pre/post.log、report.json，不入库）；服务树只清理本次 spawn 的 PID（taskkill /T 定向）；场景注册表 13 项（中文/引号/换行创建、epoch 有效性、列表/打开回读、条件保存 rev2、陈旧 rev 冲突、迁移幂等、4690 字长中文回读 + not_found/外层坏 body 4xx/内层坏 JSON→0/空 slug→0 存储负例 + 数据目录隔离 oracle + post-restart 自动重启持久化）；V-06 内置负控 `--inject-failure {port,expectation}`。验证（正控→负控→完整 profile）：`--scenarios api,neg,store` 13/13 EXIT=0；`--inject-failure expectation` EXIT=1（失败保留于 report）；`--inject-failure port` EXIT=1（启动失败具名 service-pre.log）；完整 `--profile native-vm-rust` 13 绿+vm-ui pending EXIT=2（owner=T-06 具名，不静默跳过；0 场景路径 EXIT=3）。仅 HTTP+数据目录存在性/子串 oracle，未建第二套存储实现；每轮清成员源+工作区清单强制依赖重解析（对冲 §11 陈旧清单观察），target/ 保留增量编译。原始报告 attachments/004/dual/（不入库）。
- [x] T-05（owner_stage=work；依赖T-04；AC-03/05）：Vue＋Rust真实交互、自动/手动保存、冲突/错误/重启回放，保存有区分力的UI与数据证据。**已关闭（2026-10-29 22:11）**：前置 auto-ui/PLAN-010 交付后，`verify_dual.py --profile vue-rust` **15/15 EXIT=0**——真实浏览器全链路：中文/引号/换行创建、**3秒自动保存（tickSaved=true rev=3）**、独立 HTTP 读回（同 work_id/数据一致）、改标题手动保存、外部抢写→"保存冲突"可见且不显示已保存、保留本机版本恢复（后端为 UI 内容 rev=6）、**刷新重开（len=18）**、**后端重启重开（rev=6 bodyMatch=true）**；API 电池 13 项与服务级重启持久化全绿。报告 `attachments/004/dual/vue-rust-20261029-221135/`（report cf 级 hash 见附件；UI 截图 .tmp/dual/vue-ui-*.png）。此前部分状态（手动保存绿/自动保存红）及其根因（auto-ui 渲染器多 store 裸调用绑错 store → App.vue mounted 抛错中断 post-flush → 页面 mounted 回调丢失）已由 PLAN-010 关闭，历史证据保留于本行 git 历史与 attachments/004/timer_probe*.cjs。原始部分证据文本：`tests/dual/vue_ui_scenarios.cjs`（真浏览器 Playwright 驱动，NET 捕获+截图+独立 HTTP 对照）经 `verify_dual.py --profile vue-rust`（正式 `auto run --server rust`，front 由 vite 实测 `::1`）实跑——**绿**：真实输入创建（中文/引号/换行）、手动保存、独立 HTTP 读回（同 work_id，UI 与后端数据一致）、改标题保存、外部抢写→UI 显示"保存冲突"且不显示已保存、保留本机版本恢复→后端为 UI 内容；API 电池 13 项与重启持久化（服务级）全绿。**红（同一根因，owner auto-ui）**：`ui.autosave_3s` tick 永不触发（15s 零 PUT；页面内手动调 `store.AutosaveTick()` 立即 PUT 成功——机制正常、timer 未注册）；`ui.refresh_reopen_persists`/`ui.restart_backend_persists` 刷新/重启后列表不可达（页面 mounted 钩子未运行→LoadList 不执行）。根因证据：生成的 `gen/front/vue/src/pages/author.vue` 含两处 onMounted（LoadList+setInterval(3000)）但运行时不生效；App.vue mounted 抛 `store.LoadFeed is not a function` 与 `Cannot read properties of null (reading 'token')`（probe 脚本与输出 attachments/004/timer_probe*.cjs、dual/vue-rust-20261029-210029/ report `cf8c9fad` pre.log `40258229`）。非自动保存路径全绿证明 Vue 组件/状态机/API 客户端接线本身健康；缺陷在页面级 mounted 接线，属 auto-ui Vue 渲染器（auto-ui-tools）层，Blog 侧不越仓修补。
- [x] T-06（owner_stage=work；依赖T-03/T-04；AC-04/05）：原生VM＋Rust真实窗口任务及退出恢复；缺驱动/环境则具名阻塞，不用Vue、API或mock顶替。
- [x] T-07（owner_stage=work；依赖T-05/T-06；AC-05）：冻结双方profile场景与独立数据oracle，验证负控非零/正控通过；核查001保稿、恢复/迁移与下次恢复操作，无未执行必需门。**冻结完成（2026-10-30，HEAD 73f3594）**：冻结基线=CLI `da0558e7` + tool `563afa4a`（已部署发现路径）+ auto-blog 73f3594 + auto-ui 交付面 `df39593`/c11015c + auto-lang 交付面 `dacd00184`；冻结证据：`--profile vue-rust` **15/15 EXIT=0**（vue-rust-20261030-111303，冻结 HEAD 上重绑）、`--profile native-vm-rust` **22/22 EXIT=0**（native-vm-rust-20261030-110613，独立复跑，真实窗口 MCP 作者任务全链）；负控非零：vue expectation 注入 14/13/1 EXIT=1（vue-rust-20261030-111806）、native port 注入 EXIT=1（native-vm-rust-20261030-112342）+ 另一会话聚合器变异灵敏度（exit1/exit0/exit3，见 §11 消费回执）；001 链核查：条件保存/陈旧 rev 冲突/迁移幂等/重启持久化/恢复后下一操作（vue conflict_recovery rev5、native forced_reopen rev6 bodyMatch）全部在场景注册表内，两 profile 场景清单即冻结 oracle（runtime-acceptance.md §3）。
- [x] T-08（owner_stage=work；依赖T-07；AC-01..05）：准备SD-01/02可审查增量，提交实现/测试/摘要，复核HEAD/依赖未漂移，转execution_done；本步不把尚未关闭的门算完成。**完成（2026-10-30）**：SD-01=`docs/specs/blog/durable-drafts.md` D-04/D-06 更新为经版本绑定证据关闭的准确支持范围；SD-02=`docs/specs/blog/runtime-acceptance.md` 新增（永久入口/退出码合同/工具前置与部署纪律/场景合同/原生会话附加合同/证据口径）。漂移复核：验收二进制钉定（auto.exe `da0558e7`、tool `563afa4a` 部署 `71503100→563afa4a`），冻结 HEAD 73f3594 未变；auto-lang/auto-ui master 在验收后有他 会话推进，但不影响已构建验收二进制（静态闭包）。簿记补齐：另一会话 T-03/T-06 关闭未写 §9 回执——本提交一并补记（见 §9）。**转 execution_done**：AC-01..05 全部有当前代码绑定的通过证据，无未执行必需门（T-09 复审/T-10 合并门除外，owner 另计）。
- [ ] T-09（owner_stage=review；依赖T-08；AC-06）：同一clone停止实现，按冻结输入做最终复审；记录上下文独立性限制；无pass不进入merge。
- [ ] T-10（owner_stage=merge；依赖T-09；AC-07）：完成必要统一门、Spec/索引/归档、app推送和AutoOS精确pin/组合健康验证；更新总表并显式detach组合子模块，独立clone留main。

## 9. 复审记录

r2起草校正：AC-02将泛称“CRUD”展开为001实际已有的创建/读取/保存/迁移，明确不加入删除草稿新功能；T-01..10与其余AC不变。r1原稿保留于 `d844b8b5223f8197441704cfb9a4b67d0deb0ba2`，本修订继承用户原运行验收范围。

stage: new | plan_id: BLOG-004 | plan_revision: 2 | outcome: pass（首个有界诊断任务就绪；两份前置仅draft，运行缺口未关闭） | next: work/T-01（另行执行）。T-02/T-03等实际前置交付，未实施、未跑构建/双端验收，10项任务全部未勾选。001归档与002/003原合同保持。

stage: work | plan_id: BLOG-004 | plan_revision: 2 | outcome: partial（T-01完成，T-02..T-08阻塞于前置未交付） | worktree_path: D:/autostack/auto-blog（main，本计划合同不建外部app worktree） | branch: main | base_commit: 48e0c831fb99fca73d8db64845d367ec22ba8f75 | code_commit: 无源码改动（仅docs） | dependency_revisions: auto-lang 69d90c52（885仍drafting/step0）、auto-ui b00fd30（003仍drafting/step0）、auto-man e6cc06f | task_ids: T-01（已勾选并附证据） | evidence: docs/plans/evidence/004/baseline-and-routing.md（四仓指纹；`auto service --server rust`冷生成成功；`cargo build` exit 101 复现59 errors=E0433×7/E0308×31/E0277×10/E0061×9/E0599×2；`-r vm --server rust`因Rust编译门整体不可运行；`-r vm --server vm`后端VM HTTP 22 routes可起但前端17826无监听、无原生窗口；AUTO_BLOG_DATA实现已读但运行时实测被编译门阻断）；原始日志docs/plans/attachments/004/（不入库） | blockers: auto-lang/PLAN-885、auto-ui/PLAN-003 均仍drafting/step0（仅prepare提交57382e9c0/d5c7b86），无实际交付回执可消费 | next_responsible_role: work（T-02/T-03），等前置实际交付。

stage: goal | plan_id: BLOG-004 | plan_revision: 2 | round: 1 | from: new | to: work | status: executing | outcome: blocked | worktree: D:/autostack/auto-blog/main | commit: （docs未提交，待T-08统一提交） | next: user

stage: goal | plan_id: BLOG-004 | plan_revision: 2 | round: 2 | from: work | to: work | status: executing | outcome: partial | worktree: D:/autostack/auto-blog/main | commit: 840aea0（T-01基线诊断已提交） | next: 用户授权继续执行两份前置（885 已交付）

stage: work | plan_id: BLOG-004 | plan_revision: 2 | outcome: partial（T-02 完成；Rust 缺口经正式入口关闭） | worktree_path: D:/autostack/auto-blog（main，计划合同唯一开发/复审检出） | branch: main | base_commit: a258449 | code_commit: 本提交（tests/probe/drafts_api_probe.ps1 migrate 合同形状修正 + 本计划文档；.at 源零改动） | dependency_revisions: auto-lang master 09bb4148（交付 dacd00184，885 archived；主检出 docs/design/*.md 存在他人 WIP，未触碰）、auto-man e6cc06f（重建 auto.exe 44B23860）、auto-ui 0261ae9（未消费） | task_ids: T-02（已勾选附证据） | evidence: 正式入口 `auto service --server rust` 冷生成+编译 exit 0+服务就绪；电池 13/13 PASS（含迁移幂等与 5 负例）；AUTO_BLOG_DATA 落盘隔离实测；time epoch 有效；重启持久化逐字段一致；陈旧 rust-workspace 清单毒化已定位并记录观察（§11） | blockers: T-03/T-06 仍阻塞于 auto-ui/PLAN-003（drafting）；T-04/T-05 无阻塞可继续 | next_responsible_role: work（T-04 建 tests/dual/verify_dual.py，或 T-03 等前置交付）

stage: work | plan_id: BLOG-004 | plan_revision: 2 | outcome: partial（T-04 完成；永久双运行时验收入口可用） | worktree_path: D:/autostack/auto-blog（main） | branch: main | base_commit: ecdeb09 | code_commit: 2a7c958（tests/dual/verify_dual.py 新增 487 行） | dependency_revisions: 同上（auto-lang 09bb4148 / auto-man e6cc06f / auto.exe 44B23860 / auto-ui 0261ae9） | task_ids: T-04（已勾选附证据） | evidence: 正控 `--scenarios api,neg,store` 13/13 EXIT=0；V-06 负控注入 expectation/port 均 EXIT=1 且失败明细保留；完整 `--profile native-vm-rust` 13 绿+pending EXIT=2（T-06 具名）；报告与日志 attachments/004/dual/（不入库） | blockers: T-05 无阻塞（下一步）；T-03/T-06 阻塞于 auto-ui/PLAN-003（drafting） | next_responsible_role: work（T-05 Vue＋Rust 真实交互）

stage: work | plan_id: BLOG-004 | plan_revision: 2 | outcome: blocked（T-05 部分完成+具名阻塞；T-03/T-06 维持阻塞） | worktree_path: D:/autostack/auto-blog（main） | branch: main | base_commit: 2a7c958 | code_commit: 本提交（tests/dual/vue_ui_scenarios.cjs 新增；verify_dual.py run 模式/front URL 解析/可达性探测；本计划文档） | dependency_revisions: auto-lang 09bb4148（885 交付）、auto-man e6cc06f（auto.exe 44B23860）、auto-ui 0261ae9（auto-ui-tool 重建于 20:23，15:04 旧 exe 不含 885 修复面——run 路径生成经该工具进程，与 CLI 同理需重建消费） | task_ids: T-05（保持未勾选：自动保存+刷新重开两条 AC-03 要求未过） | evidence: `--profile vue-rust` 完整实跑 15 场景=13 绿+2 红（report `cf8c9fad`）；非自动保存 UI 全链路绿（创建/手动保存/独立HTTP读回/改标题/冲突可见/保留本机恢复）；2 红同一根因=生成 Vue 页面级 mounted 钩子不执行（timer 未注册+LoadList 不跑；App.vue mounted 另抛 LoadFeed/token 异常）；手动调 store.AutosaveTick() 立即 PUT 证明机制正常——缺陷在 auto-ui Vue 渲染器接线（attachments/004/timer_probe*.cjs） | blockers: (1) auto-ui Vue 渲染器页面 mounted 接线缺陷（自动保存 timer 不触发、刷新后列表不可达）——owner auto-ui，须先登记最小修复（可并入 PLAN-003 范围或其独立最小前置）；(2) auto-ui/PLAN-003 仍 drafting（其 docs 正被他人 WIP 编辑中，本轮未触碰）；T-03/T-06/T-07/T-08 传递阻塞 | next_responsible_role: user/auto-ui（交付上述两项后回到本计划 T-03/T-05 续跑）

stage: goal | plan_id: BLOG-004 | plan_revision: 2 | round: 3 | from: work | to: work | status: executing | outcome: blocked | worktree: D:/autostack/auto-blog/main | commit: 本轮提交（T-04=2a7c958、T-05 部分提交） | next: user（解除动作见 §10：auto-ui/PLAN-003 交付 + auto-ui Vue 渲染器 mounted 接线缺陷修复；两项到位后 T-03/T-05 续跑无需重新授权）

stage: work | plan_id: BLOG-004 | plan_revision: 2 | outcome: partial（T-05 关闭；原生腿 T-03/T-06 进行中） | worktree_path: D:/autostack/auto-blog（main） | branch: main | base_commit: a47eb43 | code_commit: 本提交（本计划文档；无 .at/源码改动） | dependency_revisions: auto-lang 09bb4148/2fdee4b0（885 交付）、auto-man e6cc06f（auto.exe 44B23860→CLI 闭包不变）、auto-ui master a448d57（**PLAN-010 交付消费**：86a1006 裸 store 路由 + 131125d 增量路径 + 3a3c12e 前导点归一化 + a448d57 回执；spec docs/specs/runtime/vue-bare-store-routing.md；auto-ui-tool 重建部署 71503100） | task_ids: T-05（已勾选） | evidence: `verify_dual.py --profile vue-rust` 15/15 EXIT=0（vue-rust-20261029-221135）——AC-03 全项（含 3s 自动保存、刷新重开、后端重启重开）+ V-02 全域输入；AC-05 的 vue 腿失败控制（冲突可见/保留本机恢复/独立数据目录）通过 | blockers: T-03/T-06 原生腿待接线（PLAN-003 夹具已交付）；T-07/T-08 待原生腿 | next_responsible_role: work（T-03/T-06 原生 VM 真实窗口驱动）

stage: work | plan_id: BLOG-004 | plan_revision: 2 | outcome: blocked（T-03 部分完成；VM author 页加载阻塞 T-06..T-08） | worktree_path: D:/autostack/auto-blog（main） | branch: main | base_commit: ed0e830 | code_commit: 本提交（**src/front/app.at 歧义限定修复**——T-03 授权的 .at 接缝修改：AuthStore.Init/ArticleStore.LoadFeed/ArticleStore.SetToken 限定归属；本计划文档） | dependency_revisions: auto-ui master a448d57（PLAN-010 已消费）、auto-lang 2fdee4b0、auto-man e6cc06f（auto.exe 44B23860） | task_ids: T-03（保持未勾选：作者任务未在原生窗口执行） | evidence: app.at 歧义错误与限定修复（attachments/004/t06-run4.log `ee69070e`）；窗口/壳/MCP/后端集成通 + home 页加载成功对照（t06b.log `0fa4784a`）；app.at 修改后 vue-rust 回归 15/15 EXIT=0（vue-rust-20261029-224153） | blockers: auto-ui VM 渲染器 author 页动态加载静默失败（§10 第 3 项，owner auto-ui；该仓另一会话正活跃于 UI-005，须协调） | next_responsible_role: user/auto-ui（VM 缺陷修复后 T-03/T-06 续跑）
stage: work | plan_id: BLOG-004 | plan_revision: 2 | outcome: pass（T-03/T-06 关闭，另一会话执行；簿记补记） | worktree_path: D:/autostack/.wt/ui-015/auto-blog（用户授权的组树覆盖，已清理，证据迁出 D:/autostack/plan-artifacts/plan-015/） | branch: plan-015-dev 消费工作 | base_commit: 22045f0 | code_commit: 261413b（native_vm_scenarios.py 317 行 + verify_dual.py 原生扩展）、73f3594（T-03/T-06 勾选+消费回执） | dependency_revisions: auto-ui master（PLAN-015 r2 交付 df39593，归档+spec vm-route-page-loading.md `9de289fd…`，worktree 清理） | task_ids: T-03、T-06（勾选） | evidence: `verify_dual.py --profile native-vm-rust` 22/22 EXIT=0（native-vm-rust-20261030-100302，report `f26d93b0…` 存 plan-artifacts）；本会话 2026-10-30 独立复跑 22/22 EXIT=0（native-vm-rust-20261030-110613） | blockers: 无 | next_responsible_role: work（T-07/T-08）
stage: work | plan_id: BLOG-004 | plan_revision: 2 | outcome: pass（T-07/T-08 完成；execution_done） | worktree_path: D:/autostack/auto-blog（main，计划合同唯一检出） | branch: main | base_commit: 73f3594 | code_commit: 8ac6981（SD-01 durable-drafts.md D-04/D-06 关闭改写；SD-02 runtime-acceptance.md 新增；T-07/T-08 勾选）+ 本提交（回执补记） | dependency_revisions: 冻结基线 CLI `da0558e7` + tool `563afa4a`（部署自 auto-ui 交付面 df39593）+ auto-blog 73f3594 | task_ids: T-07、T-08（勾选附证据） | evidence: 冻结双 profile 全量 vue 15/15 EXIT=0（vue-rust-20261030-111303）+ native 22/22 EXIT=0（native-vm-rust-20261030-110613）；负控 vue expectation EXIT=1（111806）/native port EXIT=1（112342）；漂移复核=验收二进制钉定不受 master 后续移动影响 | blockers: 无（T-09 复审/T-10 合并门 owner 另计） | next_responsible_role: review（T-09 最终复审）

## 11. 前置交付登记（round 2 续）

**auto-lang/PLAN-885 已完整交付**（work→review→merge→archive→cleanup）：交付提交 `dacd00184c6b1db8332115349ac43b88de4e1a2b`（master，rebase 后 patch 等价验证），实现提交 `f5e2d1a9053a2a3c0d8a252486c853a83209fd0e`；ledger v137（P885-D1/D2/R1/REP）；归档 `docs/plans/archive/885-blog-generated-rust-backend-parity.md`（status: archived）。**BLOG-004 T-02 的 Rust 前置解除**：Blog 用 885 修复后的生成器冷生成 → cargo build exit 0（001 同款 59 errors 全部关闭：E0433 time×7/E0308×31/E0277×10/E0061×9/E0599×2），HTTP 创建/列表/保存/陈旧 rev 冲突/重启持久化全链路通过。**消费注意事项**：auto-man CLI（auto.exe C049ABE）仍链接旧 auto-lang，重建 CLI 后才能用正式 `auto run --server rust`/`auto service --server rust` 验收——重建属 auto-man 构建动作，T-02 执行时以 worktree 生成器或重建 CLI 进行。auto-ui/PLAN-003 仍 drafting，T-03 继续阻塞。

**T-02 消费回执（2026-10-29，本轮）**：重建 CLI（44B23860）后经正式入口 `auto service --server rust -B 17829` 冷生成+编译 exit 0+服务就绪，电池 13/13 PASS——885 交付版本消费确认，Rust 缺口经正式入口关闭。**观察（非阻断，交最终复审/上游登记）**：Blog `rust-workspace/Cargo.toml` 曾存在 ui-003 时期遗留清单（钉 `.wt/ui-003/auto-lang`，未含 885 修复），首次再生成（19:55，新 CLI）保留了陈旧路径并复现 37 errors；删除清单后生成器正确解析主检出 `../../auto-lang/…`；将清单重新毒化后再生成则被正确重写（run3，日志 attachments/004/t02-gen3.log）——run1 的"保留陈旧清单"未能复现，成因未定位（候选：exe 替换竞态/文件锁窗口）。当前行为（毒化→重写正确）已验证；T-04 的 verify_dual.py 每轮从干净 rust-workspace 起步以规避不确定性。此坑属生成器落点/清单维护语义，归 auto-lang 上游知晓，不在 Blog 仓越仓修补。

## 10. 待澄清事项

无须再次确认Rust/原生VM是否必须完成，用户已明确要求。技术不确定性由T-01及两份前置首任务负责：当前编译诊断数量/根因、CLI/ui工具是否旧构建、原生窗口是否有可驱动会话、真实数据env传递。如果需要外部交互桌面或越出已登记仓的能力，给出具体条件并保持依赖阻塞，不能静默修改验收口径。

前置规划登记：auto-lang/PLAN-885 本地提交 `57382e9c046dee861b3d916d7eddd93b70e194df`；auto-ui/PLAN-003 本地提交 `d5c7b865c442d8f82a4afebb972f7f6d27bd1c89`。框架仓原有未推送历史及在途WIP未随本次起草推送；执行者使用上述本地主检出合同，框架交付时再登记实际发布版本。

**阻塞与解除动作（2026-10-29 work 阶段收尾，goal round 3）**：

1. **auto-ui/PLAN-003 交付**（T-03/T-06 前置）：原生 VM 真实窗口正控（可见、可驱动、退出重开）交付回执。该仓 PLAN-003 docs 正被他人 WIP 编辑中，本轮未触碰。
2. ~~auto-ui Vue 渲染器页面 mounted 接线缺陷~~ **已交付关闭（2026-10-29）**：auto-ui/PLAN-010（裸 store.Method 归属路由，master a448d57：86a1006+131125d+3a3c12e，spec vue-bare-store-routing.md，worktree 已清理）→ T-05 15/15 EXIT=0。
3. **auto-ui VM 渲染器 author 页动态加载静默失败**（T-03/T-06 关闭条件，新具名阻塞，2026-10-29）：`auto run -r vm --server rust` 窗口/壳/MCP 驱动/后端集成全通，但导航 '/' 时 author 页加载无任何输出即失败（无 Init 派发；对照 '/demo' home 页同机制成功、PLAN-003 无路由单页夹具正常）→ 原生窗口无法执行作者任务。嫌疑：author 页 timer（every_ms 3000）/多条件/列表模板特性。解除：auto-ui/PLAN-015 已起草（2026-10-30，`docs/plans/015-vm-route-page-dynamic-load.md`，master 5ed4b30——编号避让 009/011，保守模式仅计划文档；T-01 有界调查定界根因，验收含消费者 native-vm-rust 全 profile EXIT=0）。开工唯一前置=与该仓 UI-005 在途会话协调确认；到位后 T-03/T-06 以同一 MCP 驱动模式续跑（接入面已验证），无需重新授权。
3. 消费登记（Blog 侧已做的框架构建动作，均不改框架源）：重建 auto-man CLI（`cargo build -p auto`，新 hash 44B23860）；重建 auto-ui-tool（`cargo build -p auto-ui-tools --bin auto-ui-tool`）——`auto run --server rust` 的生成经该工具进程，旧 exe（15:04）不含 885 修复面。

## 11. T-01 阻塞（goal round 1）

T-01 已完成（见 §8 证据与 §9 work 回执）：当前版本可复现 001 同款 59 Rust errors 并完成根因归组（time 路径/字符串借用/int 宽度/模块类型/函数签名，全部归 auto-lang/PLAN-885），原生 VM 前端窗口未启动（归 auto-ui/PLAN-003）。**T-02/T-03 需要两份前置的实际交付回执（已交付commit＋适用生成/运行证据），当前两者均仍 drafting/step0（仅 prepare 提交），故 work 阶段阻塞**。

解除阻塞动作（精确）：在 auto-lang 执行 PLAN-885（先其 T-01 诊断再修复，交付 885 回执）并在 auto-ui 执行 PLAN-003（交付原生窗口正控回执）；各自回执到位后回到本计划继续 T-02/T-03。无需重新授权——用户 2026-10-29 已明确要求补齐 Rust 后端与原生 VM 运行验收。


2026-10-30 auto-ui/PLAN-015 r2 native consumption receipt (delivered): AutoUI master delivery `df39593b53412fed10055d18c0aab90b0590bd27` (reviewed 59930ab, equal rebase patches), canonical `auto-ui/docs/specs/runtime/vm-route-page-loading.md` SHA256 9de289fddf1ef9e1925c78d098687e9d4abec1e8a18253d7703e639a238d34ae. Blog test-driver delivery `261413b3d24ed1491c8239b397b933584c25a01c`, only tests/dual changed, application .at/Vue/storage sources unchanged from 22045f0. User explicitly authorized the Blog-only native driver extension and `/goal resume`; implementation used the sole group tree D:/autostack/.wt/ui-015/auto-blog, overriding this Plan's historical main-only development note for that authorized scope.

`python tests/dual/verify_dual.py --profile native-vm-rust`: 22/22 passed, failed=0, pending=0, EXIT=0. Native windows and UI-derived work_id w-1793325878321-5 were observed over three owned sessions. Real MCP input created/edited/saved Chinese/quotes/newlines; 3s autosave, visible conflict retaining buffer, KeepMine, independent HTTP and current/revision/body/meta/.ok disk checks passed. q exit0 and forced process-tree termination both released owned processes/ports; reopening the same data returned the exact confirmed body (final rev6). Actual closed-MCP refusal is paired with fresh live snapshots. Aggregator mutation of the real 22-case result -> exit1, restored result -> exit0, zero result -> exit3; this is result sensitivity, not an extra live replay.

Full raw report: D:/autostack/.wt/ui-015/auto-blog/docs/plans/attachments/004/dual/native-vm-rust-20261030-100302/report.json SHA256 f26d93b0788512d5d1e464ea90db39328614e4b81600012dc838610035271ae5; lifecycle SHA256 2db13ebd11bd131b6b3fcaccd7654b70dbae2b46a5382ecc41a3923d63b34f8b. These local originals are being preserved under D:/autostack/plan-artifacts/plan-015/consumer-evidence/ before tree cleanup; the AutoUI archive holds the recovery receipt. Tested full-profile tool SHA256 56d346091e36bb2e3a573ecccba54806a565dfc01c7cd6aeabaf6af0e7036bab; final post-rebase/gated installed default tool SHA256 563afa4aa70d6a20e18885f0b607433b70cc3fadc73fcf593c3c3cbe777668d2 has the same implementation, and its native route/store fixture smoke passes. CLI SHA256 da0558e7a979b7333fe6d3274c3700328582d68e043b4ddc56e2f366d9cea682; pinned language implementation eb6ecc937 and down c3464d0. Driver source SHA256 78e844027d9b11e913659a573d78e893bde413545fe718932e2c97ec384cc6ae matches the committed source even though the run started before the driver commit.

T-03/T-06 are closed by this evidence. Historical unresolved VM-author notes above are superseded. Current progress is 6/10; T-07/T-08 and this Blog Plan's own final review/merge/Spec/push/AutoOS composition remain open. This receipt closes the native prerequisite and tasks only; it does not claim delivery of all BLOG-004 acceptance or silently waive its other storage/recovery gates.
