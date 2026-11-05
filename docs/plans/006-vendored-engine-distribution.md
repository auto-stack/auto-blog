---
plan_id: PLAN-006
status: execution_done
feature_name: 固定文档引擎发行包随 Git 交付
author: [Codex]
created_at: 2026-11-06
updated_at: 2026-11-06
plan_revision: 1
current_step: 2
total_steps: 3
supersedes_spec_components: []
new_spec_components: []
touched_goals: []
---

# PLAN-006：固定文档引擎发行包随 Git 交付

## 0. 变更摘要

OS054干净组合的Blog Vue编译报TS2307（@autodown/engine类型不存在），vendor说明承诺的dist未入Git。修复交付遗漏，不换文档引擎版本。

## 1. 目标

固定Git提交的干净消费方含文档引擎声明、JS与CSS，作者页不依赖开发机残留发行文件。

## 2. 架构方案

在.gitignore仅豁免vendor/auto-down/autodown/packages/engine/dist，登记现有固定发行包。独立clone D:/autostack/auto-blog main实施/顺序复审，遵守AutoOS AGENTS §2.1。OS子模块不编辑app源码。

## 3. 技术栈

固定AutoDown npm发行资源、Git、Vue/Vite与TypeScript。

## 4. 需求分析与背景调查

用户授权本轮修复阻塞并完成[auto-os PLAN-054](D:/autostack/auto-os/docs/plans/054-basic-apps-unified-assembly.md)，本项为其实际干净消费中发现的最小打包修复。基线832b71f、main clean。PROVENANCE.md声明c3464d0固定快照包含src+dist+package.json且无需消费方再编译，但git ls-files仅180个文件，无dist；git check-ignore指向.gitignore:25。开发clone有154个被忽略dist文件。

154个现有发行文件逐项SHA与本轮在OS054 scratch中正式构建的Notes同源engine产物完全相同（pnpm --filter @autodown/engine build exit0，生成器纯度/无Tiptap/editor-gen检查均通过）。双方.dist-stamp同为f46a2f188e86faab893e9b600519656487b270cdfc33a3120e3c9cfa5d980552；对账证据归OS054 t04/blog-dist-vs-built-notes-r132.json。不改src、package.json或pin，拒绝用另一版本包覆盖。

## 5. 详细设计

只添加该固定发行目录的ignore例外及154个对应文件。普通gen/dist/node_modules仍忽略。原作者/草稿/只读渲染语义不变。

### 规范增量

| delta_id | add/modify/retire | target | before/after rule | rationale | acceptance IDs |
|---|---|---|---|---|---|
| SD-01 | none | vendor/auto-down/PROVENANCE.md | 原已要求固定发行包含dist，规则不变 | 补足已声明的产品依赖，无新能力 | AC-01/02 |

## 6. 测试设计

V-01：保留OS054原干净snapshot的TS2307失败；git archive新提交到仓库外scratch，证明154文件确实来自Git后，正式auto build -r vue须exit0且TypeScript可解析engine。V-02：OS054真实Blog作者页/草稿任务继续验收，未操作不得签通过。当前上下文实现/内部检查；最终冻结同clone顺序复审，不自动启动其他会话。

## 7. 验收标准

- AC-01（work）：发行154文件全部被Git追踪；与可复现构建产物SHA一致；干净archive正式Vue构建通过。
- AC-02（work）：pin/engine源码不变，OS054真实作者编辑与草稿保存恢复通过。
- AC-03（review）：冻结提交复审前两项和SD-01无影响说明，内部检查不是最终review。
- AC-04（merge）：push、归档及OS054 gitlink更新真实完成，保留其他WIP。

## 8. 执行步骤

- [x] T-01（work，AC-01）：ignore例外+登记固定dist，干净archive对账和正式构建。c7cc132中154文件已追踪，git archive包含全部154文件；干净archive正式auto build -r vue exit0，Vite10.41s。
- [x] T-02（work，依赖T-01，AC-02）：OS054八app Vue桌面3410挂载真实作者页，创建中文草稿/自动保存→正式引擎h1 contenteditable键入→离线预览→任务栏关窗重开→选同草稿恢复→改标题再自动保存，rev1→5。独立磁盘meta/body/current与rev5提交文件一致，五个revision均有ok提交标记，正文含engine-edit、23.75与列表。实现冻结c7cc132，进入execution_done，T-03未执行。
- [ ] T-03（review/merge，依赖T-02，AC-03/04）：同clone冻结复审、push、组合pin与归档。

## 9. 复审记录

- drafting：已定位忽略规则，154发行文件与正式新构建逐项一致。next=work/T-01，尚未签任何AC。
- work/T-01：c7cc132只补忽略例外与154固定发行文件（无engine源码/package/pin变化）。git archive到D:/autostack/plan-artifacts/plan-006/auto-blog/clean-source后正式auto build -r vue成功，TypeScript解析/作者页生产打包均通过，修复原TS2307。日志clean-vue-build.log SHA256 bf1c494fda5ed5e926e8602bdd09813a62ae5c07b3a1a42b22e88e98cd5afa52。编译工具auto-ui644d8366/auto-lang23f3a031a；只在scratch安装PM依赖/物化普通deps。T-02真实作者/草稿消费仍待验，未push、未更新OS gitlink、未签review。

## 10. 待澄清事项

无新增产品或依赖版本决策。工作与最终验收待执行。

- work handoff / 2026-11-06：AC-01/02 complete，r1 / implementation c7cc132，SDK644d8366+23f3a031a。Vue真实作者路由位于OS054桌面内，非社区Demo，不借单独外窗替代；后端Rust17827/PID22608。草稿w-1793914931734-1最终rev5，title=U054-真实作者页草稿-重开再存；body精确为带engine-edit标题、中文小数23.75和两项列表的Markdown。body SHA bb05a80aab21ce2534bd3c6ad590927f42dc81aae0a1902ca789ee8ac106f70c；meta SHA62267677dfafd16a9194621c6b88249798d9dc574eaa0d274285ad92047831d3。t04/blog-independent-oracle-r134.json记录5个提交标记/current与rev5 meta/body相等；重开再存预览截图t04/screenshots/vue-blog-reopened-r134.jpg SHA918ced0ed61a94d2bf29ef4e0490b0cfd7c16b88fed067499a9b22d0a528dec1。早期以可变heading文本定位逐字输入时工具中途失配，改用已观察的稳定data-block-id完成输入；不是产品失败或绕过DOM写状态。next=review final，同clone main，暂停实现写入；未push/未改OS pin/未归档。
