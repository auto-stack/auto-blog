---
plan_id: BLOG-005
status: drafting
feature_name: "普通开发启动与编辑器运行路径收口"
author: [Codex]
created_at: 2026-10-31
updated_at: 2026-10-31
plan_revision: 1
current_step: 0
total_steps: 8
base_branch: main
base_commit: cd9b5d5c445e852fb13616593bf30553ce2f8493
depends_on: ["BLOG-001", "BLOG-002", "BLOG-003", "BLOG-004"]
supersedes_spec_components: ["docs/specs/blog/runtime-acceptance.md", "docs/specs/blog/editor-assets-preview.md"]
new_spec_components: ["docs/specs/blog/standalone-startup.md"]
touched_goals: []
---

# BLOG-005：普通开发启动与编辑器运行路径收口

## 0. 变更摘要

复用001草稿、004 Rust/原生验收、002编辑预览和003快照输出，解决加入AutoDown后普通Vue开发启动路由空白的问题，并提供可重复的本仓准备/启动路径。004已通过的历史结果保留；不重新做Rust后端或将build＋preview的通过冒充dev路径已修。

## 1. 目标

从本仓文档化准备后执行正式 `auto run --server rust`，作者页真正挂载并可编辑/保存/预览；原生 `auto run -r vm --server rust` 同样完成核心写作任务。冷缓存、坏依赖、端口被占和页面加载错误必须可诊断；退出重开及下一次编辑可靠。

非目标：新编辑器、网络发布渠道/社区认证、HTML采集新原语（003/F-12）、OS联动、Linux或auto-web新迁移。本计划不把既有用户认可的Markdown输出范围改成全HTML发布。

## 2. 架构方案

开发、内部检查和最终复审顺序使用同一个 `D:/autostack/auto-blog` 独立 clone、`main` 分支；不新建应用 worktree、不在 AutoOS 子模块中实现，一 app 一写入者，复审时暂停实现写入。框架变更必须在实际 owner 仓另走其 Plan/worktree 规约；本计划不自动取得框架源写入权。

用户本轮授权（2026-10-31）：建立后续计划、更新本 app README/roadmap、提交与推送这些文档；**暂不实施，不更新 AutoOS 子模块**。后续实施需另行进入 work。应用验收与交付不以 AutoOS 装配或 Linux 为前置；Linux 仍 `WAIT_DISTRO_M1`。OS 组合版本由未来统一集成计划接收，本计划 merge 只交付 app，不改父仓 gitlink、manifest 或 `.gitmodules`。

实现保持纯 `.at`，复用公开 SDK 与既有测试；不手写业务 Rust、不改生成 Rust/Vue 或临时生成目录来交付修复。`docs/specs/` 是现实现单源；下面的规范增量只是提案，本轮不写 canonical Spec、旧 ledger 或手工索引。原始截图/日志/报告本地保存，Plan 记录命令、退出码、版本/hash 和摘要；不提交新的非 Markdown 证据附件。

保留现有author页、AutoDown固定vendor和textarea降级、Rust后端与revision协议。先查当前已交付的依赖配置/运行能力，复用受支持的配置入口；若确为通用Vite配置发射问题，向auto-ui实际owner提出最小前置并消费交付，不能永久手改gen或将vendor引擎复制改写成另一实现。

## 3. 技术栈

应用 `.at`、`pac.at` npm依赖、固定AutoDown引擎、Vue/Vite、Rust生成服务、原生VM。复用 `tests/dual/verify_dual.py` / `native_vm_scenarios.py`、`tests/probe/drafts_api_probe.ps1` 以及002/003既有回归。普通dev和build＋preview分别出证据，profile不能混计。

## 4. 需求分析与背景调查

- 已交付：004档案有Rust生成/服务、Vue 15/15、原生22/22及失败控制；002已交付编辑/预览、003已交付不可变快照与Markdown包。本轮不将它们仍写成draft。
- 已观察：`editor-assets-preview.md`的F-2记录引擎依赖链mermaid→dayjs CJS互操作在vite dev下使作者页求值失败，导航壳正常；验收目前依赖build＋preview。这个假绿形态必须用真实正文编辑断言区分。
- 当前auto-ui `run_vue.rs`会刷新生成的vite.config；`VueGenerator::generate_vite_config`是现行配置源。旧gen手补配置不能交付。F-2是否在当前版本仍复现以及最小责任边界留T-00探针，不预先宣称框架必改。
- 004已固定CLI和实际auto-ui-tool；001的59个Rust编译错误已由885消费关闭，不重新增加885/旧UI草案为未交付前置。保留002的空稿textarea规则；F-7引擎空文档占位不要求本包重做。

| 源文件 | SHA256（完整值） |
|---|---|
| `docs/specs/blog/runtime-acceptance.md` | `81d569a6d1c02fce6be5d1f9926530e1bea494c1c21f7e9c3ffc833d47df1020` |
| `docs/specs/blog/editor-assets-preview.md` | `fad62488553ca8f65612f993f8552dd161942388ad7b3a1c60ccf84fc1d0d105` |
| `docs/specs/blog/snapshots-export.md` | `fc20f46fb6c0919e0616e9cbdd484b8abd9617c5b7cf44dda46cc779e1469714` |
| `pac.at` | `e9151ffc3602f0813561455baa28c55bafe32c51310299fe4d92943e1d98bd5b` |
| `src/front/pages/author.at` | `17913cfc61623aa06ede0d88204b1407030ec9b8dee41895d64511ee2af61814` |
| `tests/dual/verify_dual.py` | `c63251616a8fe9511299820c375725066428932d20c220c0134c7f4f5d4ac318` |
| `auto-ui` 观察版本 | `d85edbb0988f1cb91e3ec6a7e21ba4d872bdfb02` |
| `D:/autostack/auto-ui/crates/auto-ui-compiler/src/ui_gen/vue.rs` | `fe786c94219310355b053355534dd91efa11aba04b1899fb27b374acbfd87172` |
| `D:/autostack/auto-ui/crates/auto-ui-runtime/src/ui/aura_view_builder.rs` | `9d92519c1f9a96387af6a324dbe8f3ede7e8b1c5822fa2045466dc9122557800` |
| `D:/autostack/auto-ui/crates/auto-ui-tools/src/run_vue.rs` | `0c325ac1272be01c01ea489d64bdaa3584a8d36ff0df80e46b5fe1572821aa84` |
| `D:/autostack/auto-ui/crates/auto-ui-tools/src/run_vm.rs` | `e058a3e84c21790d73e2e5c1ed338a3e12321bd0d56f348c48d4eaaf01822065` |

## 5. 详细设计

1. **T-00 决策稿（新增）** `docs/plans/evidence/005/startup-decision.md`：固定源码/引擎pin、CLI/tool hash与实际发现路径；用同一稿件对照dev和preview的真实author页；最小普通项目与含固定引擎项目做责任区分。冻结可复用的公开配置/依赖预构建入口和必要最小owner前置。
2. **正式准备/启动**：不依赖AutoOS、历史生成目录或先手动开启另一应用；文档提供Windows可复制步骤、环境覆盖、版本/包管理器前置。本app无target缓存的首轮准备有进度、就绪判定和可配置有界超时；坏tool、构建错、端口冲突不能留下看似成功的空页面。T-00先固定实际预算，不承诺任意机器固定秒数。
3. **编辑器挂载**：非空Markdown稿进入现有AutoDown；空稿按既有textarea起稿再切引擎，输入逐字保留。dev路由动态加载成功须由实际editor DOM/文本输入/API独立读回证明。引擎资源缺失时显示明确错误与可用降级编辑，不能只有导航壳或丢稿；合法完整依赖时必须真实挂载引擎。
4. **原生与数据回归**：复用004的真实原生窗口、timer自动保存、条件revision冲突、强杀/正常退出重开；复验002的格式/预览和003快照不受草稿变更影响。SD只关闭实证缺口，不把HTML采集/真实网络published写成完成。
5. **永久入口**：T-04扩展现有双运行时调度器，拟新增 `--profile vue-dev-rust`，与既有`vue-rust`（当前build＋preview）和`native-vm-rust`分别验收；延续0/1/2/3退出码且必需场景pending/零个为非零。入口旗标由T-04落地前不存在，不作为本轮已执行命令。

### 规范增量

| delta_id | add/modify/retire | docs/specs/... target | before/after rule | rationale | acceptance IDs |
|---|---|---|---|---|---|
| SD-01 | modify | docs/specs/blog/runtime-acceptance.md | 分列dev/preview/native及冷准备/工具身份/故障合同 | 不混用运行证据 | AC-01/03/04 |
| SD-02 | modify | docs/specs/blog/editor-assets-preview.md | F-2实证关闭或具名定位；正常引擎与缺资源降级均真实可写 | 修日常开发路径与空壳假绿 | AC-02/03 |
| SD-03 | add | docs/specs/blog/standalone-startup.md | 新增本仓准备/启动、依赖版本和平台边界 | 独立用户可重复运行 | AC-01/04 |

## 6. 测试设计

下列B-01..05由work负责，T-04使dev profile和必要用例成为永久入口。旧脚本继续消费相同草稿协议，修改参数时保留原有断言；不用导航截图证明作者页挂载。

| Case ID | AC / invariant | 输入/正式入口 | 区分性 oracle / 预期 | 边界 |
|---|---|---|---|---|
| B-01 | AC-01 | 无本app target/gen缓存的文档准备＋普通dev启动；坏tool/端口冲突 | 真实author页和自有Rust后端正确、可操作；失败非零/可诊断且收割自有进程 | 允许正式准备阶段 |
| B-02 | AC-02 | dev打开已有非空Markdown稿、空稿起稿、切换引擎与预览 | 作者正文实际可编辑；中文引号换行经UI→API→磁盘逐字一致；合法依赖时引擎确实挂载 | 不以壳加载/textarea永远替代引擎 |
| B-03 | AC-03 | 缺引擎资源/路由求值故意失败；正常依赖对照 | 明确错误及保稿降级；恢复依赖后可继续编辑保存；普通dev缺陷反例必须被门检测 | 隔离测试缓存 |
| B-04 | AC-03/04 | preview与native原有完整profile；3s自动保存、陈旧rev、正常/强杀重开 | 自动保存推进rev，冲突保留输入，重开同稿且下一次保存成功；既有快照不随改稿变 | 按既有002/003/004范围 |
| B-05 | AC-04 | 实际渲染断言反控/端口反控和恢复控制 | 被操纵的真实结果非零，合法对照为0；无必需skip/pending/零场景 | 只关本次PID |

最终review由独立上下文在同一clone核对dev真实页面与数据oracle、必要preview/native回归和SD增量；不自动创建agent或新会话，不跑无关语言全仓Cargo。

## 7. 验收标准

- AC-01（owner_stage=work）：README准备/正式dev和原生入口不依赖OS/旧生成目录，冷缓存与故障判定可复验，B-01通过。
- AC-02（owner_stage=work）：普通dev下AutoDown实际挂载并保真编辑/保存/预览，空稿规则有效，B-02通过。
- AC-03（owner_stage=work）：加载失败/缺资源可见且保稿可继续；原有Rust/原生保存冲突/退出恢复不回归，B-03/B-04通过。
- AC-04（owner_stage=work）：dev、preview、native分列的永久门全部执行并过，B-05失败传播成立；README/roadmap和SD候选对应实际支持面。
- AC-05（owner_stage=review）：冻结提交最终复审AC-01..04与SD-01..03，不借旧004总数跳过新的dev缺口。
- AC-06（owner_stage=merge）：仅本app规范/文档/新计划归档与push真实收尾，历史001..004不重开，OSpin留统一计划。

## 8. 执行步骤

- [ ] T-00（owner_stage=work；依赖001/002/003/004已有交付；AC-01/02）：完成版本冻结及dev/preview最小责任探针、准备/超时决策稿；复用现有配置，必要时消费实际owner最小前置。
- [ ] T-01（owner_stage=work；依赖T-00；AC-01）：补文档化正式准备/启动与冷缓存/工具身份/端口故障门，不依赖OS或改生成物。
- [ ] T-02（owner_stage=work；依赖T-00及实际必要前置交付；AC-02）：修dev依赖/author动态挂载接缝，B-02真实引擎与textarea合法控制全过。
- [ ] T-03（owner_stage=work；依赖T-01/02；AC-03）：闭合B-03缺资源保稿与恢复，回放B-04所需Rust/原生/快照回归。
- [ ] T-04（owner_stage=work；依赖T-03；AC-04）：在既有调度器建立dev profile，跑B-01..05、原门与失败控制，输出SD候选和真实覆盖。
- [ ] T-05（owner_stage=work；依赖T-04；AC-01..04）：核对源/工具漂移及README/roadmap，提交execution_done和版本绑定证据。
- [ ] T-06（owner_stage=review；依赖T-05；AC-05）：同clone独立上下文最终复审；必要dev/native门未过时返回work。
- [ ] T-07（owner_stage=merge；依赖T-06 pass；AC-06）：仅app规范/归档/提交push/自有产物收尾，不更新OS子模块。

## 9. 复审记录

- stage: new | plan_id: BLOG-005 | plan_revision: 1 | outcome: pass（仅有界 T-00 就绪，产品与双端验收未执行） | next: work/T-00（等待后续实施指令）。
- 现有归档计划、Spec 与源码保持原样；旧验收只证明其冻结版本与已声明范围。应用提交/push 不升级 AutoOS 组合版本。

## 10. 待澄清事项

本次规划没有待用户重新确认的产品方向。T-00 负责核实技术能力与实际 owner，决策稿必须先闭合再进入依赖实现。若探针显示必须改变目标、降低必需验收或扩大跨仓写入范围，报告具体证据并保留受影响任务未完成；不得用占位、跳过、API 预操作或历史总数替代必需用户任务。
