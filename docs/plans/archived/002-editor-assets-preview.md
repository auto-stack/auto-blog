---
plan_id: BLOG-002
title: "编辑器复用、资料与预览"
status: archived
feature_name: "编辑器复用、资料与预览"
author: [Codex]
created_at: 2026-10-04T00:00:00Z
updated_at: 2026-10-04T00:00:00Z
plan_revision: 2
current_step: 5
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

修订2：用户于2026-10-04确认所有app操作在auto-os/apps子目录；文档和代码修改使用该检出的v0.6-dev，完成提交/推送与父仓gitlink更新后显式恢复detached。此修订只改变工作位置/交接方式，任务和AC保持原意；本计划代码尚未实施。

授权：用户要求在四个独立app仓准备需求/设计、首版roadmap和首批实施计划。允许本轮文档编制；产品方向讨论不是本计划代码实现已经批准/完成的证据。

版本证据：frontmatter base_commit与SOURCE-IMPORT.json；源码路径见§2。各app当前没有独立docs/specs模块规范；以代码为观察事实、产品设计为目标态，提案中列出待沉淀规范。AutoOS规约见其AGENTS.md，AutoLang知识规则见docs/specs/README.md。

## 5. 详细设计

### 规范增量

| delta_id | add/modify/retire | 目标 | before/after rule | 理由 | 验收 |
|---|---|---|---|---|---|
| SD-01 | add | docs/specs/blog/editor-assets-preview.md | 本模块尚无app级current-state Spec → 记录实际实现的接口、恢复/错误及能力边界 | 供后续agent使用，设计提案不能冒充实现 | AC-01–AC-05 |

### 可执行任务

T-00先行；T-01→T-02→T-03→T-04顺序实施。T-00输出能力报告，T-01形成接口/fixture，T-02/03接入实现，T-04完成整体验证与文档。任务输出见每项说明；T-00/04核查AC-01–05全体，中间任务按对应行为覆盖。每项实测命令/证据写入§9，不把未创建的测试入口说成已有。

- [x] T-00: T0核实固定AutoDown版本、Vue/VM可用能力和依赖安装；不直接依赖其他app未提交代码。
  [✅ 已完成] 探针app tests/probe/autodown_cap/（端口17836-17839，种子覆盖中文标题/加粗/引用/列表/表格/代码/远程图片）。**Vue轨 6/6**（engine编辑器挂载/渲染预览/编辑回传/降级保稿/切回可逆/零页面错误，`node tests/probe/autodown_cap/probe_vue.cjs`，build+preview，evidence `attachments/002/t00-vue-probe.log` 70774872）；**VM轨 5/5**（原生窗口双面渲染/降级/切回/q退出 exit 0，`python -I tests/probe/autodown_cap/probe_vm.py`，`t00-vm-probe.log` 859E63EE、快照 FDE1BCEE）。能力结论：部署CLI（da0558e7，autodown default feature）双轨原生支持 `autodown_editor`/`autodown` widget（vue=@autodown/engine SFC import；VM=框架内 autodown-core，零额外app依赖）；引擎基面 c3464d0（dist已建）与生成SFC导入面兼容；auto-notes vendor pin c39ac7f9 同源（其后仅fmt提交）。**发现 F-1..F-5**（run 120s就绪窗<冷编译需预编译；vue dev模式 linked engine 传递CJS依赖断裂、build模式正常→产品vue验收走build+preview；pnpm多级相对路径不稳用绝对/3层vendor形式；vite dev绑IPv6；npm镜像断、离线store可用）详见 `attachments/002/t00-findings.md` B6370E14。F-2的产品vue验收路径约束已入T-03/T-04验证设计依据。T-02资产通道事实：a2r类型映射无二进制（int/str/bool）；生成后端自带 auto-media-core 管线（/api/__auto/media/:id/:revision）population为Rust/UI侧，.at不可控；VM渲染markdown图片→View::Image{src}透传。
- [x] T-01: 实现标题/摘要/标签/封面、常见Markdown编辑和纯文本fallback；无引擎可基本写稿。
  [✅ 已完成] 后端合同扩展：`create_draft(+format)`/`save_draft(+cover,+format)`（api/db/drafts 三层；格式仅接受 text/markdown，非法值保存时保留当前、创建时归一 text；旧 revision meta 缺 body_format 读回归一 text；迁移路径恒 text）。前端：draft_store 增 editing_cover/editing_format/body_was_empty（采纳时刻快照），CoverEdit/FormatEdit 消息，全部保存路径（普通/强制/切前）扩为全字段快照+读回确认（含 cover/format）；author.at 内联写作面（格式切换、引擎/降级切换、空稿起稿规则：空稿先 textarea+提示，正文非空后「切引擎」点亮，有内容稿重开默认引擎；引擎空文档 0 块不可输入=F-7，VM 子件静默失败=F-6 内联规避）。vendor：@autodown/engine 固定副本 vendor/auto-down（pin c3464d0，PROVENANCE.md，src+dist 2.3MB），pac.at npm_deps `file:../../../vendor/...`。**Vue 轨 8/8**（空稿起稿/起稿后切引擎渲染/引擎内输入+保存/独立HTTP读回全字段含 body_format=markdown+cover/降级保稿 rev 推进/格式切换落盘/刷新重开引擎回读/页面错误=0（已知 auth token null 时序除外，BLOG-004 登记），`node tests/probe/authoring_t01.cjs`，evidence `attachments/002/t01-vue-probe.log`）；**VM 轨 7/7**（原生窗口同链+磁盘 rev meta body_format=markdown+q 退出 exit 0，`python -I tests/probe/probe_vm_t01.py`，`t01-vm-probe.log`）。既有 battery 随合同更新（verify_dual.py 6 处 payload、drafts_api_probe.ps1 加 cover/format，语义不变）。
- [x] T-02: 实现图片/说明及AssetRef；Notes/Reader导入保留来源rev/locator，区分引用与副本。
  [✅ 已完成] 后端：`POST /api/drafts/:work_id/asset-ref`（追加图片资产：AssetRef 条目{asset_id,kind:image,storage_ref,caption,mime,sha256:null,size:null,mode:copy|reference}；正文同步追加 `![caption](ref)` 行；条件 revision 写）+ `POST /api/drafts/import-compose`（多来源 envelope 组合新作品：producer/body 必填；mode 缺省 copy 并入正文、reference 仅登记；source_refs 逐条{producer,original_uri,captured_at,locator,source_revision,mode,title}，缺失字段显式 null；count==0 拒绝零写入；原件零接触）。**refs 存储形态=JSON Lines**（每行一对象；"" 或 "[]" 为空；追加零索引——F-8 多字节错位规避），SD-01 记录该契约。fixtures：tests/fixtures/authoring/（notes/reader envelope、reference 变体、损坏 envelope）。前端：作者页资产行（引用+说明+添加图片）与导入面（粘贴 envelope JSON 数组+组合为新作品；dirty 时显式 save_before_import 拒绝，不覆盖缓冲）。**API 7/7**（两来源组合/source_refs 精确/原件 sha256 前后一致/reference 不并入/负例拒绝/资产×2+正文图片行/空 ref+非法 mode+陈旧 rev 冲突，`python -I tests/probe/probe_t02_api.py`）；**Vue 4/4**（UI 添加图片落 refs+alt 行/粘贴两来源组合采纳"导入："标题/reference 不并入，`node tests/probe/authoring_t02.cjs`）；**VM 4/4**（原生窗口同链+磁盘 meta+q 退出，`python -I tests/probe/probe_vm_t02.py`）。证据 `attachments/002/t02-probe.log`。新发现 F-8（.len 字节/.slice 字符单位错位=逐字节扫描禁用规则的运行时根因；JSON Lines+find 基规避），见 `attachments/002/t00-findings.md`。
- [x] T-03: 实现桌面/窄屏本地预览、缺资源/断链提示；禁止预览主动执行文章脚本。
  [✅ 已完成] 预览=可返回的独立状态（预览/返回编辑按钮对；编辑内容与 work_id/rev 不被覆盖）；预览面=autodown 渲染器（vue=StreamingRenderer，VM=原生块渲染）+横幅「本地预览（离线可用）· 未识别语法按原文显示」。缺资源可读提示=新增 `GET /api/drafts/:work_id/asset-check`（find 基解析 JSON Lines，零逐字节扫描；分类：远程=断网显示断图 / 本地=浏览器预览不可解析导出时打包 / 缺失=空引用），预览横幅下方可见。窄屏：主行响应式 flex-col md:flex-row（375px 纵排，编辑区全宽 343px，草稿列表仍可达；VM 轨 class 惰性=桌面窗口布局不变）。脚本不执行：引擎组件化渲染 + `<script>` 按原文显示（负控注入实测 window.__pwned 未定义、无 script 元素）。**Vue 8/8**（预览渲染/脚本负控/中文列表引用图片/返回编辑同ID/断网预览/窄屏可用，`node tests/probe/authoring_t03.cjs`）；**VM 3/3**（预览+本地资产分类提示+script 按原文/返回编辑 rev 保持/q 退出，`python -I tests/probe/probe_vm_t03.py`）。证据 `attachments/002/t03-probe.log`。边界：VM「窄屏」等价物=桌面窗口缩放，MCP 驱动不支持窗口 resize，VM 侧窄屏以响应式 class 惰性（桌面布局）+vue 侧 375px 实测覆盖，SD-01 记录。
- [x] T-04: 验证切换编辑/预览仍保存同work_id/revision，不把渲染转换悄悄写回原稿。
  [✅ 已完成] 切换矩阵（vue 编辑形态互切 textarea→引擎→降级→引擎 / 预览往返 / 刷新重开 / 导入后回原稿）全程 work_id/revision 稳定；**不写回 = 字节级断言**：客户端编辑器值逐字节等于基线 + 服务端 body sha256 前后一致 + 预览往返 rev 不变（无幻影写）；真实编辑保存 rev 正常推进（+1）；重启重开磁盘 rev body 逐字节一致；多源导入创建新 work 且源稿/原件不变（AC-03/AC-04 收口）。**Vue 7/7**（`node tests/probe/authoring_t04.cjs`）+ **VM 5/5**（`python -I tests/probe/probe_vm_t04.py`，q 退出+重启重开+磁盘 sha）。证据 `attachments/002/t04-probe.log`。

## 6. 测试设计

数据集：Notes envelope、Reader quote、带图中文Markdown、损坏资产、AutoDown不可用；tests/fixtures/authoring/（新建）。

在D:/autostack/auto-os/apps/023-realworld本仓根以匹配当前基线的auto CLI分别启动`auto run`与`auto run -r vm`，端口17826 / 17827，使用隔离存储目录。依赖准备见[仓根README](../../README.md)，不得把用户真实数据作为首次迁移样本。

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

- 实际起点HEAD/工作目录/工具版本：2026-10-30开工。HEAD 0c90951（BLOG-004归档后尖峰）；主检出 D:/autostack/auto-blog main（本仓合同：唯一应用开发/复审检出，无外部app worktree，单写入者）；工具=004冻结基线（CLI da0558e7A979B7…、tool 563afa4aA70D…，当日哈希复核一致）；依赖HEAD：auto-lang 28f6170be（交付面 dacd00184 之后移动，钉定二进制不受影响）、auto-ui c11015c、auto-man e6cc06f、auto-down c3464d0、auto-notes 82b4d2f。
- T0能力与阻塞报告：已完成（T-00勾选项附全证据）。双轨真渲染可用，无跨仓runtime阻塞；发现F-1..F-5（见勾选项与attachments/002/t00-findings.md）。
- 各AC项证据路径、命令及结果：见各任务勾选项与 attachments/002/t0{0,2,3,4}-probe.log；统一口径：AC-01（T-01 vue 8/8+vm 7/7 编辑面 + T-03 vue/预览渲染）、AC-02（T-01 降级保稿 + T-00 探针 fallback 臂 + VM Core 框架诚实降级语义）、AC-03/AC-04（T-02 api 7/7 + T-04 导入新work/源不变）、AC-05（T-03 提示/离线/窄屏/脚本负控）。
- 独立复审：未执行；重新对照代码检查AC项、遗漏/延后/workaround、格式/告警/调试输出，不信任已有勾选。
- 债务与风险：未登记；测试真实阻塞不得伪装通过。
- 沉淀：以frontmatter spec-impact候选登记实际实现组件，更新设计能力表与稳定规范；随后翻reviewed并归档。
- 合入目标：v0.6-dev；当前未实施，不合入master、不推进OS gitlink。

[整体roadmap](../roadmap-v0.6.md) · [agent执行说明](../README.md)

## 10. 待澄清事项

T-00需核实实际平台/运行时能力，负责者为本计划执行agent；输出具体API、可复现实验与独立阻塞提案。不存在先执行全局重构的隐含前置。核心验收变更须明确提出，不能用mock替换真实结果。

草案交接：stage=new；plan_revision=2；outcome=pass（可审查的草案，非代码验收）；next=work（选定计划并确认实施范围后）。当前均未实施。

stage: work | plan_id: BLOG-002 | plan_revision: 2 | outcome: partial（T-00完成；T-01..T-04未开始） | worktree_path: D:/autostack/auto-blog（main，本仓合同唯一开发/复审检出） | branch: main | base_commit: 0c90951 | code_commit: 本提交（tests/probe/autodown_cap/ 探针app+双轨驱动脚本+计划簿记；产品源码零改动） | dependency_revisions: CLI da0558e7、tool 563afa4a（004冻结基线，当日复核一致）、auto-lang 28f6170be、auto-ui c11015c、auto-man e6cc06f、auto-down c3464d0（探针引擎消费面） | task_ids: T-00（已勾选附证据） | evidence: vue轨 build+preview 6/6（probe_vue.cjs）、VM轨 5/5（probe_vm.py，q退出 exit 0）；证据文件 attachments/002/（t00-vue-probe.log 70774872、t00-vm-probe.log 859E63EE、t00-vm-snapshot.txt FDE1BCEE、t00-findings.md B6370E14、diag-page.png 3878570F，均不入库） | blockers: 无阻塞项；F-2（vue dev互操作）以build+preview路径绕行，跨仓修复另行提案不阻塞 | next_responsible_role: work（T-01 编辑器主体）

stage: work | plan_id: BLOG-002 | plan_revision: 2 | outcome: partial（T-01完成；T-02..T-04未开始） | worktree_path: D:/autostack/auto-blog（main，本仓合同唯一开发/复审检出） | branch: main | base_commit: 5882b51 | code_commit: 本提交（src/back api/db/drafts/works 合同扩展、src/front draft_store/author 写作面、pac.at npm_deps、vendor/auto-down 引擎固定副本、既有 battery 合同跟随；探针脚本 tests/probe/authoring_t01.cjs+probe_vm_t01.py） | dependency_revisions: CLI da0558e7、tool 563afa4a（004冻结基线）、auto-lang 28f6170be、auto-ui c11015c、auto-man e6cc06f、auto-down 引擎快照 c3464d0（vendor pin，PROVENANCE.md） | task_ids: T-01（已勾选附证据） | evidence: Vue 8/8（build+preview+Playwright，t01-vue-probe.log）+ VM 7/7（原生窗口 MCP+磁盘落盘，t01-vm-probe.log）；新发现 F-6（VM 子件静默失败→内联规避）/F-7（引擎空文档 0 块→空稿起稿规则），见 attachments/002/t00-findings.md；纯 .at 后端 a2r 冷生成编译 exit 0（auto run 内置） | blockers: 无阻塞项；F-6/F-7 跨仓提案另行登记不阻塞 | next_responsible_role: work（T-02 资产与来源导入）

stage: work | plan_id: BLOG-002 | plan_revision: 2 | outcome: partial（T-02完成；T-03/T-04未开始） | worktree_path: D:/autostack/auto-blog（main） | branch: main | base_commit: 23c7883 | code_commit: 本提交（src/back drafts/api/db T-02 端点、src/front author.at+draft_store.at 资产/导入面、tests/fixtures/authoring/ 四 envelope、tests/probe/{probe_t02_api.py,authoring_t02.cjs,probe_vm_t02.py}、compose_probe.at 单元探针、计划簿记） | dependency_revisions: CLI da0558e7、tool 563afa4a、auto-lang 28f6170be、auto-ui c11015c、auto-man e6cc06f | task_ids: T-02（已勾选附证据） | evidence: API 7/7 + Vue 4/4 + VM 4/4（attachments/002/t02-probe.log）；F-8 登记于 t00-findings.md | blockers: 无阻塞项；F-8 的 json_array_valid 中文敏感（migrate 路径）保持 001 原状登记跨仓观察 | next_responsible_role: work（T-03 预览）

stage: work | plan_id: BLOG-002 | plan_revision: 2 | outcome: partial（T-03完成；T-04未开始） | worktree_path: D:/autostack/auto-blog（main） | branch: main | base_commit: f992419 | code_commit: 本提交（src/back asset_check 端点、src/front author.at 预览面+响应式布局、draft_store PreviewCheck、tests/probe/{authoring_t03.cjs,probe_vm_t03.py}、计划簿记） | dependency_revisions: CLI da0558e7、tool 563afa4a、auto-lang 28f6170be、auto-ui c11015c、auto-man e6cc06f | task_ids: T-03（已勾选附证据） | evidence: Vue 8/8 + VM 3/3（attachments/002/t03-probe.log） | blockers: 无阻塞项；VM 窄屏=桌面窗口缩放边界记入 SD-01 | next_responsible_role: work（T-04 切换一致性验证）

stage: work | plan_id: BLOG-002 | plan_revision: 2 | outcome: pass（T-00..T-04 全部完成；execution_done 待最终复审） | worktree_path: D:/autostack/auto-blog（main，本仓合同唯一检出） | branch: main | base_commit: 5ef6a63 | code_commit: 本提交（tests/probe/{authoring_t04.cjs,probe_vm_t04.py}、docs/specs/blog/editor-assets-preview.md（SD-01 沉淀）、计划簿记；产品源码本轮零改动——T-04 为纯验证任务） | dependency_revisions: CLI da0558e7、tool 563afa4a（004 冻结基线，全程未重建）、auto-lang 28f6170be、auto-ui c11015c、auto-man e6cc06f、auto-down 快照 c3464d0（vendor pin） | task_ids: T-04（已勾选附证据）；T-00..T-03 前序已勾选 | evidence: Vue 7/7 + VM 5/5（attachments/002/t04-probe.log）；全程各任务证据 t00/t02/t03/t04-probe.log | 就绪记录：work-owned AC-01..05 全部以当前代码+新鲜执行通过（见勾选项映射）；开放 in-contract 缺口=无；跨仓观察项 F-2/F-6/F-7/F-8 与边界 B-1/B-2 已登记于 SD-01 §6（均不阻塞本计划验收语义）；统一回归门=verify_dual 双 profile 由 review/merge 所有（本计划新增探针为定向验收，双 profile 全量含 002 面待最终复审裁决是否扩册） | blockers: 无 | next_responsible_role: review（最终复审）

stage: review | review_scope: final | reviewer_identity/limitations: 同会话执行上下文（实现会话自审；按 004 先例记录限制——判定全部从冻结基线 460f26b 的新鲜执行与工件重建，不采信执行期摘要；无独立模型/会话可声称） | plan_id: BLOG-002 | plan_revision: 2 | outcome: pass | worktree_path: D:/autostack/auto-blog（main，本仓合同唯一检出） | branch: main | reviewed_commit: 460f26b（复审期间新增提交=验证配置/文档/回执，产品 .at 源零改动） | base_commit: 0c90951 | dependency_revisions: CLI da0558e7（SHA 复核一致）、tool 563afa4a、auto-lang 20b6737f7（交付面 dacd00184 后移动，钉定二进制不受影响）、auto-ui 916d919、auto-man e6cc06f、auto-down 快照 c3464d0 | spec_inputs: docs/specs/blog/editor-assets-preview.md（SD-01；复审期间 F-2 措辞按新鲜证据修正一次——先错误"推翻"后复核恢复原文并强化证据，见 findings） | acceptance_results: AC-01 pass（T01 vue 8/8+vm 7/7 新鲜复跑：中文标题/列表/引用/图片编辑+引擎渲染+降级；T03 预览渲染）；AC-02 pass（T01-05 降级保稿+切回可逆；空稿起稿规则；VM Core 框架诚实降级语义登记）；AC-03 pass（probe_t02_api 7/7 新鲜：双来源组合、source_refs 精确、原件 sha256 前后一致）；AC-04 pass（T04 vue 7/7+vm 5/5 新鲜：切换同 ID/rev、导入新 work 源稿不变）；AC-05 pass（T03 vue 8/8+vm 3/3 新鲜：asset-check 分类提示/离线预览/375px 窄屏 343px 全宽/script 负控） | pending_closeout_gates: 无（统一回归门本轮已由 review/merge 所有者执行：vue-rust 15/15 EXIT=0（vue-rust-20261030-152748）、native-vm-rust 22/22 EXIT=0（native-vm-rust-20261030-153523）；负控 vue expectation 注入 EXIT=1（153923）+ native port 注入 exit=1 ✓） | findings: R-1 探针缺陷（authoring_t01.cjs 过期选择器撞 T-02 新增导入 textarea 的严格模式——执行期 8/8 早于导入面板；复审修正探针，非产品缺陷，分类=验证资产漂移）；R-2 统一门契约跟进（004 场景占位符/抢写 payload/重开形态假设按 BLOG-002 合同更新，语义不变；verify_dual vue 腿 F-2 build+preview 适配+preview 独立端口——验证配置变更由门所有者执行）；R-3 复审过程记录（F-2 曾被错误"推翻"一次——仅校验导航壳的假阳性；定点复测确认 dev 模式路由页装载失败后恢复原文，最终 F-2 措辞与实测一致）；R-4 非阻断观察（tests/probe/autodown_cap/pac.at 引擎路径为本机绝对路径——探针专用，PROVENANCE/findings 已注明） | evidence: 复审新鲜执行=API 7/7 + vue(T01 8/8, T02 4/4, T03 8/8, T04 7/7) + vm(T01 7/7, T02 4/4, T03 3/3, T04 5/5) + 双 profile 统一门 + 双负控；报告与日志 docs/plans/attachments/（本地） | next: merge（归档/ledger/roadmap M2/推送/AutoOS pin）

stage: merge | plan_id: BLOG-002:r2 | outcome: pass | prepared: reviewed 460f26b（交付提交 bc42692=docs/验证配置-only 后裔——差量=复审 harness 契约跟进+探针修正+spec F-2 措辞+回执，产品 .at 源/依赖零改动，符合文档后裔规则） | landed: main 尖峰=交付提交（本仓合同 main 直开发，无独立分支；线性历史保持） | canonical_verified: docs/specs/blog/editor-assets-preview.md @ HEAD（SHA256 前 12 位 FAD62488553C；SD-01 全文=复审冻结增量+F-2 复核修正，行为与实测一致） | ledger: 按 PLAN-106 无 ledger/index 发布步骤（app 自动从 canonical 文档派生；未写 specs.json） | archived: docs/plans/archived/002-editor-assets-preview.md（status archived，5/5 任务全闭，completion_kind: delivered） | 总表: docs/roadmap-v0.6.md M2→delivered（2026-10-30） | AutoOS: apps/auto-blog gitlink→bc42692（交付提交；见本轮推送记录） | cleaned: 无 worktree（本仓合同 main 直开发）；plan-artifacts/plan-002 不存在（无中间物需回收）；探针进程/端口已全部回收 | 部署观察: gen/front/vue/dist 为按需再生观察项（复审期间已按当前源重建一次）；auto-blog 无独立 release 二进制产物（后端经 CLI 冷生成 dev 运行验收） | completion_kind: delivered | next: app 推送 origin + AutoOS 组合 pin 推送
