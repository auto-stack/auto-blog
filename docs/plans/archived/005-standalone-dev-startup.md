---
plan_id: BLOG-005
status: archived
feature_name: "普通开发启动与编辑器运行路径收口"
author: [Codex]
created_at: 2026-10-31
updated_at: 2026-10-31
plan_revision: 1
current_step: 8
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

- [x] T-00（owner_stage=work；依赖001/002/003/004已有交付；AC-01/02）：完成版本冻结及dev/preview最小责任探针、准备/超时决策稿；复用现有配置，必要时消费实际owner最小前置。[✅ 已完成 2026-11-01] 决策稿=docs/plans/evidence/005/startup-decision.md（版本冻结：CLI `390e664e…`/tool `4d2198b8…` 为本计划基线，pac.at/author.at/verify_dual.py/run_vue.rs/run_vm.rs 与计划表逐字节一致，auto-ui-tools/src/vue.rs=5a9a79cb 新冻结；F-2 当日复现=dayjs CJS default export 断裂、outlet 空；责任矩阵 6 轮控制变量：根声明 mermaid/lowlight/katex + optimizeDeps.include 三者=cand5 全绿，同稿 preview 对照全绿；修复=app 半边 pac.at npm_deps 三声明（官方管线验证透传）+ auto-ui owner 前置（vue.rs generate_vite_config 增发 npm_deps include，已逐字验证）；原生轨不受影响；vite dev 绑 localhost(::1)、磁盘正文在 body.txt 两口径已记录）
- [x] T-01（owner_stage=work；依赖T-00；AC-01）：补文档化正式准备/启动与冷缓存/工具身份/端口故障门，不依赖OS或改生成物。[✅ 已完成 2026-11-01] README「准备与启动（Windows 正式路径）」落地（前置/六步进度/双判据就绪 localhost+127.0.0.1/有界预算/故障语义）；冷缓存整轮 238.4s（wipe target+gen→双判据就绪，冷 scaffold 从 pac.at 重建含全部 npm_deps，决策稿 §6b）；故障门实测：构建错 rc=1+具名 120s 后端上限（E-7 PASS）、坏 tool 身份门 EXIT=1 具名 FileNotFoundError、front 端口冲突框架静默（E-4a 落他栈/E-4b 自增撞后端端口——owner 前置补 strictPort，README 记核对缓解）、后端端口冲突 Windows 不可注入（E-5）、exe 锁挂起（E-6）；收割 004 时代孤儿 vite preview ×8+（E-8）；进程/端口收割验证干净
- [x] T-02（owner_stage=work；依赖T-00及实际必要前置交付；AC-02）：修dev依赖/author动态挂载接缝，B-02真实引擎与textarea合法控制全过。[✅ 已完成 2026-11-05] 消费 auto-ui PLAN-050（optimizeDeps.include+strictPort 发射）+ PLAN-051（①main.ts 拼接 ②ref(null) ③page-named TypedInst dispatch 三回归修复）+ app 侧三防御（back .at str `.len()`→`.length` ×68、auth Init 防御重置、**use_engine/force_engine 迁入 draft_store**——页面重挂载重播种页模型默认致切降级回弹的根治，09cb4ef）。终局门：vue-dev-rust **全冷 16/16 EXIT=0**（20261105-030441：真引擎挂载/渲染/三通道逐字/空稿起稿/切引擎/预览/重启续写/缺资源降级恢复全 PASS）；B-02 全 oracle 过。
- [x] T-03（owner_stage=work；依赖T-01/02；AC-03）：闭合B-03缺资源保稿与恢复，回放B-04所需Rust/原生/快照回归。[✅ 已完成 2026-11-05] B-03 dev 腿落地（missing/recover 相位：缺资源=可诊断失败+保稿 kept=true、恢复=引擎重挂载+续写入盘 rev=2）；**B-04 终局回放全绿（新工具链）**：native-vm-rust **22/22 EXIT=0**（20261105-031420：author_task 全流程/autosave/冲突保留/KeepMine 恢复/正常退出+强杀重开持久化）、vue-rust **15/15 EXIT=0**（20261105-032036）、vue-dev-rust 16/16。修复=auto-ui PLAN-051 ③（page-named TypedInst dispatch：活键派发/恰一存活重定向/墓碑真迟到丢弃/零存活根回退，b3414750）+ app 店面迁移（09cb4ef）。
- [x] T-04（owner_stage=work；依赖T-03；AC-04）：在既有调度器建立dev profile，跑B-01..05、原门与失败控制，输出SD候选和真实覆盖。[✅ 构建+执行完成 2026-11-01；AC-04 红待 owner 前置] `--profile vue-dev-rust` 落地（tests/dual/verify_dual.py：phases=[api,vue-dev-ui]，官方 `auto run` 组合，front_url 实测解析+可达栈解析，端口漂移反控=请求端口≠实际即具名失败；tests/dual/vue_dev_scenarios.cjs=B-02 区分性 oracle：真引擎挂载/渲染/三通道回读/空稿起稿/切引擎/预览切换/重启续写，fatal 必须计失败）；执行=诚实红：api 电池+重启持久化过（13/14），dev UI 腿红=F-2 冷缓存复现（dayjs CJS），dev-ui.missing_resource_degradation pending（owner 具名），EXIT=1；失败控制：expectation 注入=EXIT=1 具名（report.json 15 执行）、port 注入=CLI 具名"API backend not ready within 120s (port …)"（service-pre.log）RC=1（harness 分支行日志缺失记观察项 E-10）；顺带修复 pick_port Windows 排除区盲选（bind(0) 临时端口可落 excludedportrange→显式重绑 10013 崩溃，改为复验重抽，E-9）+ 场景脚本 fatal 传播缺口（首轮 14/14 假绿教训：fatal 未计失败=假绿，已修并重跑定红）；SD 候选=§5 增量表+决策稿 §4/§6；旧门 vue-rust/native-vm-rust 语义未动（重放绿，见 T-03 证据）。[✅ AC-04 转绿 2026-11-05] 终局全门（全冷）：vue-dev-rust 16/16 + native 22/22 + vue-rust 15/15 = **53/53 EXIT=0**（030441/031420/032036）；SD 候选定稿见 §5 增量表
- [x] T-05（owner_stage=work；依赖T-04；AC-01..04）：核对源/工具漂移及README/roadmap，提交execution_done和版本绑定证据。[✅ execution_done 2026-11-05] **终局版本绑定**：auto-blog `09cb4ef`（本提交）；auto-ui master `b3414750`（PLAN-050+051+followup），tool exe `ecc96200…`、CLI exe `6b940bad…`（auto-man@03bb65e+auto-lang@70b4a1de7 窗口）；SD-01/02/03 候选=§5 增量表（merge 落地）。漂移核对：决策稿冻结基线（CLI 390e664e/tool 4d2198b8）→终局（上列）——owner 线按其 plan-046/050/051/933 推进，消费门全绿即为兼容实证；README 准备/启动章节=T-01 落地面（本轮无新漂移）；roadmap 无需更新（本计划无 roadmap 项）。AC-01..04 全部过（见 T-02/T-03/T-04 行 + 三 profile report）。
- [x] T-06（owner_stage=review；依赖T-05；AC-05）：同clone独立上下文最终复审；必要dev/native门未过时返回work。[✅ PASS 2026-11-05] 独立上下文（general-purpose 子代理）自行复跑三门 **53/53 EXIT=0**（032648/033738/034554）并逐项核对 AC-01..05 全 pass、修复抽样语义等价、SD 候选与支持面一致；义务=F-01 README 刷新（已落 61b21d3）、F-02 diag 还原+attachments 处置（已落）、SD 落地（已落 9af748a）、F-03 SD-02 措辞按实际面（已遵）、F-04 E-10 承继（留统一门 owner）。receipt=D:/autostack/plan-artifacts/plan-005/review-t06/review-t06.md
- [x] T-07（owner_stage=merge；依赖T-06 pass；AC-06）：仅app规范/归档/提交push/自有产物收尾，不更新OS子模块。[✅ 已完成 2026-11-05] SD-01/02/03 落地（9af748a）；F-01/F-02 落地（61b21d3）；attachments 处置；归档+push 见 merge receipt。

## 9. 复审记录

- stage: new | plan_id: BLOG-005 | plan_revision: 1 | outcome: pass（仅有界 T-00 就绪，产品与双端验收未执行） | next: work/T-00（等待后续实施指令）。
- 现有归档计划、Spec 与源码保持原样；旧验收只证明其冻结版本与已声明范围。应用提交/push 不升级 AutoOS 组合版本。

stage: work | plan_id: BLOG-005 | plan_revision: 1 | outcome: partial（T-00完成；T-01..T-05未开始） | worktree_path: D:/autostack/auto-blog（main，本仓合同唯一检出） | branch: main | base_commit: 805e05f | code_commit: 本提交（pac.at npm_deps 增声明 mermaid/lowlight/katex；docs/plans/evidence/005/startup-decision.md 决策稿；计划簿记） | dependency_revisions: CLI 390e664e、tool 4d2198b8（本计划冻结基线）；run_vue.rs 0c325ac1、run_vm.rs e058a3e8 与计划表一致；auto-ui-tools/src/vue.rs 5a9a79cb（现行 vite 配置发射源，新增冻结）；vendor 引擎 pin c3464d0 未动 | task_ids: T-00（已勾选附证据） | evidence: 决策稿 §1..§5（D:/autostack/plan-artifacts/plan-005/t00/ 本地原始件）；官方入口 dev 复现 F-2（dayjs CJS 断裂/outlet 空，dev-run.log）+ 6 轮责任矩阵（candidates.log，cand5 全绿）+ 同稿 preview 对照全绿（preview-run.log）；官方管线 npm_deps 透传验证（regen-run.log） | blockers: T-02 配置发射半边=auto-ui owner 前置（vue.rs generate_vite_config 增发 optimizeDeps.include npm_deps 键——已逐字验证的最小增量，决策稿 §4）；owner 交付前 dev 门保持红 | next_responsible_role: work（T-01 文档化准备/启动与故障门）

stage: work | plan_id: BLOG-005 | plan_revision: 1 | outcome: partial（T-01完成；T-02..T-05未开始；T-02 等待 owner 前置交付） | worktree_path: D:/autostack/auto-blog（main，本仓合同唯一检出） | branch: main | base_commit: cec1dcd | code_commit: 本提交（README 准备/启动/故障语义章节；决策稿 §6/§6b 增补；计划簿记；产品源码零改动） | dependency_revisions: 同 T-00 冻结（CLI 390e664e、tool 4d2198b8、vue.rs 5a9a79cb） | task_ids: T-01（已勾选附证据） | evidence: 冷缓存整轮 238.4s 双判据就绪+冷 scaffold npm_deps 透传（cold-result.txt/cold-run.log）；构建错门 rc=1 具名 120s 上限（fault-build-result.txt，E-7）；坏 tool 身份门 EXIT=1 具名（verify_dual native preflight）；端口冲突静默实态 E-4a/E-4b + 缓解核对（fault-port2/3/4.log）；E-5 后端端口不可注入/E-6 exe 锁挂起/E-8 孤儿 preview 收割 | blockers: 同 T-00（owner 前置）；E-4 strictPort 发射并入 owner 前置清单 | next_responsible_role: work（T-02：app 半边已交付，等 owner 前置交付后闭合 B-02；期间不空转——可推进 T-03 与 T-04 不依赖 dev 红腿的部分并如实分账）

stage: work | plan_id: BLOG-005 | plan_revision: 1 | outcome: blocked（T-02 配置发射半边=auto-ui owner 前置未交付；app 半边已交付；T-03 部分、T-04 构建完成并以诚实红执行，T-05 execution_done 不可声明） | worktree_path: D:/autostack/auto-blog（main，本仓合同唯一检出） | branch: main | base_commit: fa8feba | code_commit: 本提交（tests/dual/verify_dual.py：vue-dev-rust profile+端口漂移反控+pick_port 排除区修复；tests/dual/vue_dev_scenarios.cjs：B-02 区分性 oracle+fatal 传播；决策稿 §6c；计划簿记） | dependency_revisions: CLI 390e664e、tool 4d2198b8（冻结）；本轮实测 auto-ui HEAD 期间被 owner 会话推进（145d414→d43425c→e2ee696，另会话并行，本仓只读） | task_ids: T-03（◐ B-04 回放全绿；B-03 dev 腿 pending owner 前置）、T-04（✔ 构建完成；AC-04 红=dev 腿） | evidence: B-04 回放 vue 15/15、native 22/22、003 探针 16+5+8 全绿（t03/verify-*.log）；vue-dev-rust 13/14+pending EXIT=1 诚实红（冷缓存 dayjs CJS 复现）；expectation 注入 EXIT=1 具名 report.json；port 注入 RC=1×5 + CLI 具名 120s（E-10 分支行留 owner 验证）；假绿教训与 pick_port 修复见决策稿 §6c（E-9） | blockers: **T-02 dev 挂载闭合依赖 auto-ui owner 交付**：`auto-ui-tools/src/vue.rs::generate_vite_config()` 增发 `optimizeDeps.include = pac.at npm_deps 键集`（最小增量已逐字验证=cand5，app 侧 pac.at 声明已就绪；附带请 owner 评估 strictPort/host 发射以闭合 E-4a/b 端口静默） | next_responsible_role: user/owner（交付上述 auto-ui 最小前置后，本计划以同一目标恢复 work：清 gen/front/vue/node_modules/.vite 冷缓存重跑 vue-dev-rust 至绿 → 闭合 T-02/T-03/T-04 → T-05 execution_done → review → merge）

stage: goal | plan_id: BLOG-005 | plan_revision: r1 | round: 1 | from: goal | to: user | status: archived（frontmatter 未随 work receipt 推进，簿记差异照旧记录） | outcome: waiting | worktree: D:/autostack/auto-blog（main，合同唯一检出） | commit: 6769d6e | evidence: 阻塞复核（2026-11-04）：auto-ui HEAD `89b30ed3` 全 crates 无 `optimizeDeps`/`strictPort` 发射，vue.rs 现值 `7842103e`（plan-041/036/044 并行推进所致漂移）；auto-ui docs/plans 无覆盖本前置的计划；app 侧 pac.at 半边与 cand5 验证维持有效 | blockers: 同 §10（owner 前置未交付） | next: user（①授权在 auto-ui 仓按其 Plan/worktree 规约新建最小计划交付该发射，或 ②自行/另会话交付后恢复 work）

stage: goal | plan_id: BLOG-005 | plan_revision: r1 | round: 2 | from: goal | to: user | status: archived（簿记差异照旧） | outcome: waiting | worktree: D:/autostack/auto-blog（main，合同唯一检出） | commit: 本提交 | evidence: 复核（2026-11-04）：auto-ui HEAD 推进至 `6891edaa`（新提交=plan-043 T-01..06 交接、plan-044 T-04/T-05 receipts，均与本前置无关）；在飞 worktree `ui-043`/`ui-044` 的 vue.rs 均 0 处 `optimizeDeps`；仍无覆盖计划 | blockers: 同 §10（owner 前置未交付） | next: user（等待 2/3）

stage: goal | plan_id: BLOG-005 | plan_revision: r1 | round: 3 | from: goal | to: work（经 auto-ui 前置交付） | status: archived（簿记差异照旧） | outcome: pass | worktree: D:/autostack/auto-blog（main） | commit: 本提交 | evidence: 复核（2026-11-04）：auto-ui HEAD `27b9c74a` 仍未交付（vue.rs `7842103e` 零发射、无覆盖计划）；**用户本轮显式授权路线 ①**：在 auto-ui 仓按其 Plan/worktree 规约新建最小计划交付 `optimizeDeps.include`+`strictPort` 发射，随后回本计划恢复 work 直至归档 | blockers: 无（阻塞解除路径已授权并开工） | next: work（先 auto-ui 前置交付，再回 BLOG-005：冷缓存 vue-dev-rust 至绿 → T-02/T-03/T-04 → T-05 → T-06 → T-07）

stage: work | plan_id: BLOG-005 | plan_revision: r1 | outcome: partial（owner 前置已交付并消费；T-02 dev 腿核心 oracle 全绿，余 2 子场景+pending 场景未闭合；新增 E-11 环境观察） | worktree_path: D:/autostack/auto-blog（main，合同唯一检出） | branch: main | base_commit: 6769d6e | code_commit: 本提交（src/back/works|drafts|api|exporters|publications.at：str `.len()`→`.length` ×68；src/front/auth_store.at：Init 防御重置；tests/dual/vue_dev_scenarios.cjs：RW_DEBUG_DOM 门控 DOM/console 转储；计划簿记） | dependency_revisions: **auto-ui PLAN-050 r3 交付 @a03b4ee0（ff-only，range-diff 四提交全等）**，SD-01 canonical docs/specs/build/generated-vite-config.md sha256 `055c74b6`，归档 024fe57a；消费构建 tool `81116bab`+CLI `befe2707`（auto-man@2bbd954+auto-ui@024fe57a+auto-lang@9f38bbf69）部署 auto-man/target/debug；冻结消费组实验（auto-man@1eeac78+auto-lang@174652b5c，含 auto-web/auto-down 同级）已用毕拆除 | task_ids: T-02（◐ dev 腿核心绿）、T-03（B-04 dev 级 restart/reopen 绿） | evidence: **21:12 门=13/14+pending**（docs/plans/attachments/004/dual/vue-dev-rust-20261104-211222/）：api 电池全绿（中文引号标题 roundtrip、陈旧 rev 冲突保留输入、重启持久化 rev=2）+ dev 真引擎挂载/渲染种子 h1/UI→API→磁盘三通道逐字/空稿 textarea 规则/切引擎/重启重开引擎重挂载全 PASS；PLAN-050 发射实测生效（Local host 固定形+strictPort+`.vite` 冷重预打包）；**剩余红**：dev.preview_renders（预览 h1 不可见、errors:[]）、dev.post_restart_next_save（重启后键入未落盘）、pending dev-ui.missing_resource_degradation——三者历史首次可达（Nov-1 挂载即 fatal）；**app 侧两项链回归防御**：①back `.at` str `.len()`→`.length` ×68（当前链方法形发字节/slice 发字符→生成后端中文必 panic works.rs:150；`.length` 字段形在 f79ea988c:3075 与 master expr_emit:3092 均渲染 chars().count()，双链健壮）；②auth_store Init 防御重置（auto-ui plan-041 T-03 店工厂对结构字面量默认发射 `ref<any>(null)`→null.token pageerror）；**E-11（新环境观察）**：21:14 后同二进制同输入 CLI 在 run_ui step2→3 静默 exit -1/127（harness/手动/全冷清态复现，21:12 同态全过，0 cargo 仍死） | blockers: ①preview_renders/post_restart_next_save 需浏览器级诊断（转储已就位）②E-11 待静默窗口重跑③上游双缺陷（auto-lang 方法形 len 渲染、auto-ui plan-041 初始化器丢失）已精确定位待 owner，app 防御已生效 | next_responsible_role: work（静默窗口重跑 → 浏览器级诊断两子场景 → B-03 缺资源场景落地）

## 10. 待澄清事项

本次规划没有待用户重新确认的产品方向。T-00 负责核实技术能力与实际 owner，决策稿必须先闭合再进入依赖实现。若探针显示必须改变目标、降低必需验收或扩大跨仓写入范围，报告具体证据并保留受影响任务未完成；不得用占位、跳过、API 预操作或历史总数替代必需用户任务。

**阻塞（2026-11-01 work 交接）**：T-02/T-03 dev 腿与 AC-02/AC-04 的绿灯闭合依赖一项 **auto-ui owner 最小前置交付**（本计划无框架源写入权，证据见 docs/plans/evidence/005/startup-decision.md §4/§6c）：

1. `auto-ui-tools/src/vue.rs::generate_vite_config()` 增发 `optimizeDeps: { include: [<pac.at npm_deps 键集>] }`——已由 cand5 控制变量轮逐字验证（本仓 pac.at 已声明 mermaid/lowlight/katex，app 半边就绪）；
2. 附带评估 `server.strictPort`（+或 host 校验）发射以闭合 E-4a/E-4b 端口冲突静默改道。

**解除动作**：owner 交付后回到本计划 work——清 `gen/front/vue/node_modules/.vite`（冷缓存）→ `python tests/dual/verify_dual.py --profile vue-dev-rust` 至全绿 → 勾闭 T-02（B-02）、T-03（B-03）、T-04 转 green → T-05 execution_done → T-06 复审 → T-07 归档。交付前 dev 门保持诚实红，不以 build+preview 冒充。

**等待复核（2026-11-04 goal round 1）**：auto-ui HEAD `89b30ed3` 仍未交付该前置（全 crates 无 `optimizeDeps`/`strictPort` 发射；vue.rs 现值 `7842103e`；auto-ui 侧无覆盖计划）。待用户决策解除路线：①授权本目标在 auto-ui 仓按其自身 Plan/worktree 规约新建最小计划交付该发射，随后恢复本计划 work；或 ②用户/另一会话自行交付，交付后本计划以同一目标恢复 work。连续三轮等待未决则按 cap 置 blocked。

**等待复核（2026-11-04 goal round 2）**：auto-ui HEAD 推进至 `6891edaa`（新提交均系 plan-043/044，与本前置无关）；在飞 worktree `ui-043`/`ui-044` 的 vue.rs 均 0 处 `optimizeDeps`。阻塞不变，等待 2/3。

**授权落地（2026-11-04 goal round 3）**：用户拍板 **①**——授权本目标在 auto-ui 仓按其自身 Plan/worktree 规约新建最小计划交付 `vue.rs::generate_vite_config()` 的 `optimizeDeps.include`（pac.at npm_deps 键集透传）+ `server.strictPort`/host 发射，交付后回本计划恢复 work（冷缓存重跑 `vue-dev-rust` 至绿 → 闭合 T-02/T-03/T-04 → T-05 → T-06 → T-07）。本轮实测 auto-ui HEAD `27b9c74a` 仍未交付（vue.rs `7842103e` 零发射）；等待 cap 解除。

stage: work | plan_id: BLOG-005 | plan_revision: r1 | outcome: partial（续上 receipt：E-11 静默窗口复跑服务恢复=瞬态环境实锤；新增 nav 60s 裕量；owner 测试套件压载窗口计时 oracle 不跑） | worktree_path: D:/autostack/auto-blog（main） | branch: main | base_commit: 4411dbb | code_commit: 本提交（tests/dual/vue_dev_scenarios.cjs：首页导航 waitFor 30s→60s——vite 每轮冷进程按需转换+高负载下 30s 可超） | dependency_revisions: 同上 receipt；auto-lang owner HEAD 推进 9f38bbf69→44d64c4ed（21:17，plan-933 ace 测试面——方法形 len emitter 未修，app `.length` 防御维持必要） | task_ids: T-02（◐ 同上） | evidence: 21:40 轮=E-11 已消（服务 UP、api 12/12 过）但 nav 30s 超时 fatal + 重启 E-11 类死（vue-dev-rust-20261104-214643）；21:46 复跑=nav 仍超 + cargo/rustc 11-12 进程（owner plan-933 套件压载）——计时型场景在压载窗口不具证据力 | blockers: 同上 receipt（preview_renders/post_restart_next_save 诊断 + pending 场景）+ 需静默机器窗口 | next_responsible_role: work（静默窗口：重跑门至 15 用例全绿 + DOM 转储诊断两子场景 + B-03 缺资源场景落地 → T-05）

stage: work | plan_id: BLOG-005 | plan_revision: r1 | outcome: partial（vue-dev-rust **16/16 EXIT=0** 全绿含 B-03 缺资源场景落地；vue-rust 15/15 绿；native-vm-rust 13/14 红=新工具链回归，定责完成待 owner/授权） | worktree_path: D:/autostack/auto-blog（main） | branch: main | base_commit: 6743663 | code_commit: 本提交（tests/dual/vue_dev_scenarios.cjs：wid 读 DUAL_WID 修复、preview oracle 根类修正 .streaming-document、missing/recover 相位、console 捕获、超时裕量；tests/dual/verify_dual.py：missing_resource 相位调度——vendor package.json 临时改名模拟+.vite 冷清+恢复重启、PENDING 登记 vic 长、strictPort 停启裕量） | dependency_revisions: 消费对不变（tool `81116bab`+CLI `befe2707`）；auto-lang owner HEAD 推进 30b396d72（22:00）、auto-ui HEAD 推进 3e23b1bc（owner 活跃） | task_ids: T-02（✔ dev 腿全绿）、T-03（◐：B-04 vue 臂回放绿、原生臂红=上游回归） | evidence: **vue-dev-rust-20261104-230731=16/16 EXIT=0**（api 12+author_task_dev 8 子场景+restart_dev_persists+missing_resource_degradation：缺资源 editorMounted=false+consoleErr≥1+保稿 kept=true、恢复后 engine 挂载+续写 rev=2 入盘）；vue-rust-20261104-231517=15/15（build+preview 新工具链回放）；native-vm-rust 20261104-231904/232232/233311 三轮 deterministic 13/14：新建草稿后编辑视图不出现（快照仍列表页+Sign in/Sign up 导航）；**定责 A/B**：checkout 掉 auth 防御行同败（233311）→ app 改动排除；冻结工具（d43425c 构建 `7dfe744d`）与当前 CLI 协议漂移 rc=1 无法直接 A/B（232715）→ 回归落在 auto-ui master 工具（plan-041/043/044 窗口），与 vue 侧 ref(null) 同族（store 工厂/VM 场景生成）；gen/main.ts 拼接缺换行（vue.rs:1566 router_import 与 store_ctx_import 间）为同窗口第三处，冷 scaffold 必坏=B-01 阻塞（暖 gen 诊断性补行已验证全链绿） | blockers: **原生臂 + B-01 冷准备均阻塞在 auto-ui master 三处回归**（①VM 场景新建草稿不跳转②店模型结构字面量默认 ref(null)③main.ts import 拼接缺换行——同 plan-041 窗口） | next_responsible_role: user/owner（三处皆为 auto-ui 侧最小修复；授权路线①同构介入或等 owner 自修后回本计划收口 B-01 冷+原生回放 → T-05）

stage: goal | plan_id: BLOG-005 | plan_revision: r1 | round: 4 | from: goal | to: user | status: archived（frontmatter 簿记差异照旧） | outcome: waiting | worktree: D:/autostack/auto-blog（main） | commit: 481e57c（状态未变） | evidence: 等待复核（2026-11-04 深夜）：auto-ui HEAD 推进至 `6e9baa83`（plan-046 主题迁移演示线，owner 活跃）但三处回归均未修（main.ts 拼接 vue.rs:1566 仍无分隔、ref(null) 仍在、VM 跳转无相关修复提交）；用户未拍板 | blockers: 同前 receipt——native 臂回放 + B-01 冷准备阻塞在 auto-ui 三处最小回归，待路线拍板（①授权同构介入 / ②等 owner / ③暂停） | next: user（等待 1/3）

stage: goal | plan_id: BLOG-005 | plan_revision: r1 | round: 5 | from: goal | to: work（经 auto-ui PLAN-051） | status: archived（簿记差异照旧） | outcome: pass | worktree: D:/autostack/auto-blog（main） | commit: 本提交 | evidence: **用户本轮显式授权路线①（同构）**：在 auto-ui 仓按其 Plan/worktree 规约新建最小计划修三处回归（①VM 新建草稿不跳转 ②店模型结构字面量默认 ref(null) ③main.ts import 拼接缺换行），交付后回本计划：B-01 冷 scaffold 验证 + native 22/22 回放 + vue-dev-rust 全绿复跑 → T-05 → T-06 → T-07 | blockers: 无（解除路径已授权并开工） | next: work（auto-ui PLAN-051 先行）

stage: goal | plan_id: BLOG-005 | plan_revision: r1 | round: 6 | from: goal | to: work（auto-ui PLAN-051 进行中） | status: archived | outcome: partial | worktree: D:/autostack/auto-blog（main） | commit: 481e57c+（BLOG-005 面无新改动；PLAN-051 面=auto-ui master `4e5e6796`+worktree b8e23710/f7a0b276） | evidence: **PLAN-051 进展**：授权轮（用户拍板①，bb650b9）→ 计划新建（三回归：店模型结构默认 ref(null)/main.ts 拼接/VM 跳转）→ **T-01/T-02 完成并组回归全绿**（store_init_to_js Expr::Node 臂=对象字面量发射，oracle struct_default_kept+non_struct_unchanged；main_ctx 前导换行，oracle 四组合；compiler lib 268/268、tools lib 205/205 扣 5 既有基线红）；T-03=VM press→msg 分发调查已开局（press 服务在 auto-ui-runtime 内嵌 MCP 层，非 tool 进程——调查面=runtime ui/mcp 层 plan-041/044 窗口变更） | blockers: PLAN-051 T-03（VM 跳转根因）未闭合 → T-04/T-06/T-07 → 回本计划收口（B-01 冷/native 回放/T-05/T-06/T-07） | next: work（PLAN-051 T-03 调查继续）

stage: goal | plan_id: BLOG-005 | plan_revision: r1 | round: 7 | from: goal | to: work（PLAN-051 ③ 续） | status: archived | outcome: partial | worktree: D:/autostack/auto-blog（main） | commit: 481e57c（本仓状态未变） | evidence: 本轮=auto-ui ③ 深挖两步：layer-1 定责 A/B（app 改动排除）+ 诊断探针（exe 含 PLAN051-DIAG 但 sweep/ensure 零输出）→ **双重发现**：(i) author 实例确曾在册后被帧清扫释放（本轮墓碑命中）(ii) 诊断轮零输出与墓碑命中矛盾 → **双 VmBridge 假说**（视图构建桥与派发桥的注册表/墓碑所有权分离；bridge_identity() 探针在位）；layer-2 修复已落 auto-ui master b3161594（三态判定+墓碑；runtime 2212/2220 同基线）但消费回放仍 drop | blockers: native 臂 ③ = 双 bridge 实例所有权问题（PLAN-051 followup 详录），需专轮 bridge_identity 追踪 | next: work（PLAN-051 ③ 双桥追踪 → native EXIT=0 → 本计划 T-05/T-06/T-07）

stage: goal | plan_id: BLOG-005 | plan_revision: r1 | round: 8 | from: goal | to: work（PLAN-051 ③ 续） | status: archived | outcome: partial | worktree: D:/autostack/auto-blog（main） | commit: 2e49b1b（本仓无新改动） | evidence: 本轮=auto-ui ③ 深挖定责到终极层：**同一 build 内 read_all_state 读 use_engine=false 而 `.use_engine` 条件求值 true**（同帧对照 trace 提交 fbc26aff）——两份 use_engine 副本（root vs author 实例 bindings）在 plan-041 实例绑定设计下分叉；RES trace 实证 author 页从不注册 child instance（live=[]）；ToggleEngine dispatch/写入链路全部正常；其余两回归（①main.ts ②ref(null)）修复已实证（全冷 16/16） | blockers: native 臂红 = plan-041 实例绑定设计的双副本分叉，需 auto-ui owner/专轮深挖 VM 实例状态副本合一 | next: work（专轮：双副本合一 → native EXIT=0 → 清 diag → T-05 → T-06 → T-07）

stage: goal | plan_id: BLOG-005 | plan_revision: r1 | round: 9 | from: goal | to: work（PLAN-051 ③ 续） | status: archived | outcome: partial | worktree: D:/autostack/auto-blog（main） | commit: 2e49b1b（本仓无新改动） | evidence: 本轮=③ 再下探一层后触及 auto-lang VM SET_FIELD 槽位语义边界：read probe 实证 obj=4000012 idx=36 单槽 use_engine=Bool(false) 无重复；COND 同帧 `.use_engine => true`——分叉在 VM handler 赋值的槽位写入与 read_state 缓存索引读取之间（auto-lang core SET_FIELD/GET_FIELD 语义），非 runtime 层可闭合 | blockers: native 臂红 = VM 槽位写读分叉（auto-lang core 侧） | next: work（auto-lang VM SET_FIELD/GET_FIELD 槽位语义追踪 → 修复 → native EXIT=0 → 清 diag → 本计划 T-05/T-06/T-07）


stage: work | plan_id: BLOG-005 | plan_revision: r1 | outcome: pass（**execution_done**：AC-01..04 全绿，T-01..T-05 完成） | worktree_path: D:/autostack/auto-blog（main，合同唯一检出） | branch: main | base_commit: 09cb4ef | code_commit: 本提交 | dependency_revisions: auto-ui master `b3414750`（PLAN-050 optimizeDeps/strictPort 发射 + PLAN-051 三回归修复 + ③ page-named TypedInst dispatch 统一三态判定+墓碑）、tool exe `ecc96200…`、CLI exe `6b940bad…`（auto-man@03bb65e）、auto-lang@70b4a1de7 窗口 | task_ids: T-02（✔ 店面迁移根治+dev 腿全绿）、T-03（✔ B-03 场景落地+native 22/22+vue-rust 15/15）、T-04（✔ 53/53 全门）、T-05（✔ execution_done+版本绑定） | evidence: **终局全门（全冷，2026-11-05）**：vue-dev-rust **16/16 EXIT=0**（20261105-030441）、native-vm-rust **22/22 EXIT=0**（031420）、vue-rust **15/15 EXIT=0**（032036）；修复链=auto-ui PLAN-050（① optimizeDeps/strictPort）+PLAN-051（② ref(null) ③ main.ts 拼接 ④ page-named TypedInst dispatch 统一三态）+app（back .at .length ×68、auth Init 防御、use_engine/force_engine 店面迁移） | blockers: 无 | next_responsible_role: review（T-06 同 clone 独立上下文最终复审 AC-01..05+SD-01..03；merge 义务=SD 落地+归档+push）

stage: merge | plan_id: BLOG-005 | plan_revision: r1 | outcome: pass（**交付完成**） | delivery_commit: main 线性史（fix 09cb4ef → execution_done 808f9cd → F-01/F-02 61b21d3 → SD 落地 9af748a → 本归档提交） | checkpoints: landed（main 线性 ff 史，本仓即开发检出）；canonical_verified（SD-01=runtime-acceptance.md 三 profile 分列+§6 冷准备/工具身份/故障合同、SD-02=editor-assets-preview.md F-2 关闭+F-8 登记、SD-03=standalone-startup.md 新建，均随 9af748a 落地）；archived（docs/plans/archived/005-...，status: archived，completion_kind: delivered）；cleaned（native_vm_scenarios.py diag 还原、attachments 处置、plan-artifacts/plan-005 保留至 push 后按 delete-at-merge 删除） | final_evidence: **终局全门 53/53 EXIT=0**（vue-dev-rust 16/16=030441+032648、native 22/22=031420+033738、vue-rust 15/15=032036+034554——实现轮+独立复审轮双实证）；版本绑定 auto-ui@b3414750/tool ecc96200/CLI 6b940bad/auto-man@03bb65e/auto-lang@70b4a1de7 | consumer_notes: auto-ui PLAN-050/051 已各自归档；其③修复的深层语义（page-named TypedInst dispatch）随 b3414750 在 master，后续消费方直接受益 | next: push + goal complete