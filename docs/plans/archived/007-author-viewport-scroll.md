---
plan_id: PLAN-007
status: archived
feature_name: 作者页有限窗口滚动可达性
plan_revision: 1
current_step: 4
total_steps: 4
author: [codex]
created_at: 2026-11-06T02:00:00Z
updated_at: 2026-11-06T02:00:00Z
supersedes_spec_components: [docs/specs/blog/editor-assets-preview.md]
new_spec_components: []
touched_goals: [AutoOS-PLAN-054]
---
# PLAN-007：作者页有限窗口滚动可达性

## 0. 变更摘要
修复 AutoOS iced 作者页内容超过窗口时底部预览/保存按钮不可达；用既有 scroll 视图约束窗口并保留内容自然高度。业务事件、存储格式、路由目标保持现有合同。

## 1. 目标
1280×800 宿主中的作者窗口能滚动到全部编辑控件，预览后返回内容不丢；Vue 常规及375px窄屏仍可编辑、保存、预览。

## 2. 架构方案
在本 app 的根壳引入标准垂直滚动视口，内容列保留原导航和 outlet。先验证现有 scroll 在原生与 Vue 的生成/运行形态；若机制不可行，记录具体框架前置，不以程序直接改页面状态替代可达性。

## 3. 技术栈
纯 .at 前端；官方 auto build/run 生成链；不手写 Rust，不改后端。

## 4. 需求分析与背景调查
授权：用户要求解决所有问题并最终完成 OS054；本计划是其真实 Blog 作者编辑/预览验收的必要 app 修复，继承同一范围授权，无新增预算或自动代理上下文授权。
权威实现目录 D:/autostack/auto-blog 独立 clone/main，当前922d0b1；OS组合子模块只消费已提交交付。不创建 app worktree。当前无代码 WIP、无其他活动 Plan（001..006均 archived）。
依据 docs/specs/blog/editor-assets-preview.md §4、runtime-acceptance.md §3，src/front/app.at 根 min-h-screen col；author.at 内含320px正文、导入区和底部按钮。实际 OS054 native-blog-v8-wheel-r143.png：内容越过底部，滚轮未使底部按钮可见；数据与定时保存已另证。Vue浏览器有文档滚动，原生根列无标准滚动视口。UI060 的独立路由初始化/定时器修复是消费前置，不在本 app 重复实现。

## 5. 详细设计
保留导航与作者视图树，在根层使用既有 scroll；只调整明确的视口/内容高度约束。实施先验生成形态，再在真实桌面滚轮与控件操作确认。不得通过直接 PreviewOpen 注入或 API预写代替按钮可达性。
### 规范增量
| delta_id | add/modify/retire | target | before/after rule | rationale | acceptance IDs |
|---|---|---|---|---|---|
| SD-01 | modify | docs/specs/blog/editor-assets-preview.md | 明确有限原生窗口纵向滚动可达底部操作 | 落实既有编辑/预览合同 | AC-01/02 |

## 6. 测试设计
真实原生 OS入口：NewDraft→中文正文→静置保存→滚轮到预览→点击预览→返回→关闭/重开→选择同稿→再次编辑并保存。截图和独立磁盘读取绑定同work_id/revision。Vue常规及375px窄屏通过同源生成页面检查可滚动、按钮可达和预览返回。存储/安全全门已由001..006与054覆盖；本布局修复不新建复刻实现的单测。实施/内部检查同当前上下文，app复审须明确其证据边界，不伪称独立上下文；OS054最终独立复审仍必须完成，禁止自动创建代理/新聊天。

## 7. 验收标准
- AC-01 (owner_stage=work)：真实1280×800 iced作者页滚轮到预览与保存控件，点击预览/返回，中文数据与磁盘一致，重开后再存成功。
- AC-02 (owner_stage=work)：Vue常规及375px下相同操作可达、无布局遮挡，标题/正文不丢。
- AC-03 (owner_stage=review)：针对最终提交复核纯布局范围、Spec与上述实际证据，明确同上下文检查限制。
- AC-04 (owner_stage=merge)：推送app交付，干净无人写入的OS候选submodule消费固定SHA并复核；归档计划保留回执。

## 8. 执行步骤
- [x] T-01 (owner_stage=work; AC-01/02; src/front/app.at)：标准滚动视口、正式生成/实际原生和Vue验证；源与所测产物身份一致。
- [x] T-02 (owner_stage=work; AC-01/02; SD-01)：关闭重开/下一次操作与窄屏检查，更新canonical Spec、README与真实回执。
- [x] T-03 (owner_stage=review; AC-03)：按最终提交复审，缺项具名，不将queued或截图空壳算通过。
- [x] T-04 (owner_stage=merge; AC-04)：app推送/OS pin消费、归档与恢复信息。

## 9. 复审记录
stage: new | plan_id: PLAN-007 | plan_revision: 1 | outcome: pass | next: work/T-01。范围与OS054授权一致；当前仅草案，尚无实现/验收通过。

## 10. 待澄清事项
无需新增用户决定。若标准scroll机制有实际框架缺陷，先记录具名前置及可复现条件，再决定同范围修复归属；不降低验收。
- stage: work | plan_id: PLAN-007 | plan_revision: 1 | round: 1 | outcome: standard scroll emitted and native binary built; live acceptance pending
  Authoritative independent clone/main767b1dae5ee565d085d5321ae47c5dbf3460bb70, pure .at shell viewport wrapper. Formal auto build -r rust uses explicit group Lang23f3a031/UI82b3f6df/Man03bb65ef and immutable toolv9 SHA38e85efde60169619ab86ab80227e1be9ddbfa95286845edf51f8b3c8ed42fd0. Initial clone-generated cold lock selected gpu-allocator0.27→windows0.57 while wgpu-hal27 requires interoperable windows0.58 interfaces;10external E0277/E0308, no app source compile fault. Global cargo update windows0.57→0.58 correctly refused because unrelated sysinfo0.33 requires<=0.57; no broad dependency upgrade was done.
  Inspected allocator's actual allowed range>=0.53,<=0.58 and the existing successful OS-generated lock. Adjusted only allocator's lock dependency to existing windows0.58, retaining sysinfo0.57 and all package versions/checksums. Generated Cargo.lock is build input, not app source/handwritten Rust. Cargo metadata --locked exit0; formal auto build -r rust retry exit0/Cargo3m04s, three-way receipt/published/Cargo SHA equal. Raw logs blog007-*r14*.log, identity blog007-native-identity-r145.json, frozen generated lock SHA6607c6710d1d4b34ee0199629c3b5b2f000cb406f9b3db1ef0cbd27333afa276 under plan054/t04. This repairs this consumer's selected lock; does not claim a general cold resolver policy fix. Native scroll/preview/reopen and Vue checks still pending; T01..04 unmarked.
  Desktop owner validation will use normal shell.apps.extra_dirs config with isolated extra ID blog007-author=D:/autostack/auto-blog in an owned test storage file, leaving OS pinned023-realworld untouched until app delivery. This is source selection, not business state injection; native storage remains existing isolated blog data. OS054 full fixed-pin task evidence is still a separate required consumer pass.

- stage: work | plan_id: PLAN-007 | plan_revision: 1 | round: 2 | outcome: AC02 web tasks passed; AC01 native viewport bridge pending
  Formal Vue build exit0/Vite14.78s. Real headless Playwright against dev3412 and production preview3413, each1280x800 then375x812: UI new draft, title/body input, idle autosave, real wheel to visible footer, Preview/return, reload same draft, engine shown then fallback edit/save/preview. Final dev workw-1793931838780-1/rev3, previeww-1793931846831-2/rev3; exact body SHA1e875413897e25ae160cbbd5401303f4f5f7d018b4fe88333b177560c61a175e; both pageerrors[]. Footer bounding boxes within viewport, real click accepted. Four screenshots visually inspected (Chinese preview/body/list preserved; normal view shows return control). Oracle D:/autostack/plan-artifacts/plan-054/t04/blog007-web-oracle-r148.json, test log blog007-web-test-r148.log, helper blog007-web-r148.py terminal0. AC02 verified, no native completion inferred.
  UI0606f00f375 fixed native paragraph local transform (real regression13passed). Owner007 native child rebuilt SDK6f, SHA c2b9ef9b30b32085fbf985b9368773fa0912bc1bd8b0b487ec6c003bac31260e. Actual wheel now moves text correctly, but child still lays out1280x800 despite decorated WM client being shorter; bottom footer remains unreachable at max scroll. Existing protocol Frame Resize is ignored in child and not sent by desktop broker. UI060 same-outcome repair now connects actual WM client dimensions; no app padding workaround/offscreen preview injection. Current host28824/wid2 retained during text fix; user manually restored, no Windows autoactivation. OS pin922d0b1 unchanged; source767b1da remains unpushed pending native AC01 and final review. T01..04 remain open.


- stage: work | plan_id: PLAN-007 | plan_revision: 1 | round: 3 | outcome: pass | status: execution_done | next: review
  AC01 actual native author task passed on UI SDK/hostc0359fabe519dcc8d27ff45be07e596f8e3a362d. Official host build exit0/24.32s, child build exit0/33.44s; published/receipt/Cargo artifact AF84579576944A2821978638EBC3AE80468A7EEB01D41BA2B8FD53A274A09DDB, generator v9/tool2023faf8 (unchanged generator source dfa61f39). New host24164 visible; actual scroll at sidebar whitespace320,650 reaches footer. Visible Preview click977,655→preview and Return965,692→edit. No direct nested Preview message or backend prewrite. Exact existing workw-1793927770702-1 selected from populated list, title/body edited with actual pointer/key events. CharTyped newline characters are filtered by iced; initial helper correctly failed exact-body assertion (native-edit-r149). Replayed with real Enter key events13 between lines; exact multiline Chinese/decimal body persisted revision10 and previewed. This is input-fixture correction, not permission to flatten expected content.
  Normal close wid1 made verified live child24400 exit0; normal reopen wid2/child18652 restored same work/title/multiline body. Next edit title U054-原生重开继续保存-r149 and appended 重开后的下一次编辑。; idle save revision13, visible Save click advanced14. Disk meta/current/revisions/rev14.body all agree, body SHAa1b551d23ce69d4c95804dea5c6b5928c94923828a4c3917ae055bba8a8e8315. Final oracle D:/autostack/plan-artifacts/plan-054/t04/blog007-native-final-oracle-r149.json SHA8bc814192945887e603569a36582b43becd14bf29798968644cb2b5f2f2c6073. Visually inspected actual footer screenshot blog007-native-reopen-next-save-r149.png SHA f397a3ba42e4e844b1546f6933354604f9e49747c202ef09722796542730d404 and next preview f62e48828944388bdeb7c91978ad3375d2f04f4860983c678c2d7456b3f243ca. Return/preview source scope unchanged.
  AC02 dev/production and375px evidence from round2 remains source-identical; four images inspected. T01/T02 complete, canonical Spec/README prepared. No backend, editor engine, API, dependency-version or product-scope source changes; only root scroll wrapper. Source commit767b1da plus canonical docs commit to follow. Independent clone retained, no app worktree. Owner extra-ID test is not OS054 fixed-pin final consumer; pin remains922d0b1 until reviewed delivery. Same-context app review limitation expressly retained; independent parent054 review and T05..09 still required.

  Round3 evidence correction during artifact reconstruction: first close24400 WaitForExit returned true but its serialized exit code is null, so the earlier exit0 wording is withdrawn; it was observed terminated after actual Close, not a captured code0. Replayed normal Close on verified live reopened18652 with process handle acquired before requesting close; WaitForExit true/ExitCode0, receipt blog007-native-close2-r149.json. Reopened again as wid3; data remains revision14. This closes the exit-code oracle gap without changing source or weakening close/reopen acceptance. Initial review helper correctly rejected null; corrected it to require actual second receipt0. Implementation863e9a4 unchanged; documentation correction is the only new baseline delta. This is not an additional failed final review; no verdict had yet been issued.


- stage: review | review_scope: final | reviewer_identity/limitations: Codex implementation context, artifact reconstruction; explicitly not independent | plan_id: PLAN-007 | plan_revision: 1 | outcome: pass | worktree_path: D:/autostack/auto-blog (authorized independent app clone) | branch: main | reviewed_commit: d16401c48d2f6253df40087ddc1fda125fe56158 | base_commit: 922d0b1255ba8e49da065f2b8ed55de0e121a5f1 | dependency_revisions: UIc0359fabe519dcc8d27ff45be07e596f8e3a362d/Lang23f3a031/Man03bb65ef | next: merge
  Reconstructed from committed diff, actual generation input hashes13/13, three-way artifactAF845795, web dev/production oracle and visible screenshots, actual native multiline preview/return/reopen/nextsave oracle8bc81419, corrected second close receiptExitCode0. Head/implementation clean. AC01 pass: real finite native scroll and visible controls, retained CJK/multiline data, close/reopen and nextsave14; existing NewDraft creation/store semantics unchanged from parent actual r143 creation evidence, current007 layout paths separately exercised. AC02 pass: official Vue build + live dev/preview normal375 tasks, no page errors, visible footer boxes/clicks and reload data. AC03 pass: source diff only app root standard scroll/removal of content min-height, all backend/store/editor assets unchanged; SD01 canonical Spec reviewed SHA773becf204174eed2af70dec07228bafb8c6980e7be82d508c883cab295a3f41. Existing broader001..006 security/storage behavior evidence not rerun for shell layout; no new storage/security promise.
  Documentation-only correction d16401c fixes inaccurate first close exit0 wording; actual second close0 now available. No open code/acceptance findings. Native screenshot has existing raw Markdown fallback message, covered existing preview contract; not a claim of rich Markdown support expansion. AC04/T04 pending merge-owned: push, clean OS candidate consumption, archive/version-control receipts and artifact hold. Original app source and generated layouts unchanged since verified build; no redundant full app/API regression required for docs descendant. Parent054 final independent review remains required and is not discharged by this app verdict.


- stage: merge | plan_id: PLAN-007 | plan_revision: 1 | outcome: pass | completion_kind: delivered | reviewed_commit: d16401c48d2f6253df40087ddc1fda125fe56158 | delivery_commit: e9216a2dff2808cdb40193aab35001be17ae7189 | archive: docs/plans/archived/007-author-viewport-scroll.md
  prepared/landed: app workflow expressly requires independent clone/main; no temporary app branch/worktree. All implementation/spec changes already committed linearly on main; fetch confirmed origin/main ancestor, push origin main succeeded922d0b1→e9216a2. No force push, default history rewrite or submodule development. Review-record-only descendant e9216a2 has identical implementation/dependencies/spec to reviewed d16401c.
  canonical_verified: docs/specs/blog/editor-assets-preview.md SHA773becf204174eed2af70dec07228bafb8c6980e7be82d508c883cab295a3f41 on main and clean OS candidate composition match; src/front/app.at SHAd8b5cdb70535cb9e34f88322a9040f71143caade150cec34df23d3ca6836d83f. Candidate D:/autostack/.wt/os-054/auto-os/apps/auto-blog was clean/unwritten, fetched actual product remote and detached e9216a2; source/back/spec diff empty and hashes equal. AC04 app-to-composition source delivery verified; parent054 actual fixed-pin consumer task/gate remains distinct, pending its own build. Archive bookkeeping descendant will be pushed and composition pin advanced before parent candidate commit.
  archived/cleaned: all4tasks complete, final same-context review limitation explicit; archive path/version-control and links checked at commit. Independent app clone intentionally retained under user app workflow, no app worktree/branch exists to remove; no wt-guard/removal claim. No separate plan007 scratch scope exists: this repair evidence is in active parent054/t04 and has been folded above; parent in-flight scope must not be deleted here. Named hold OS054-BLOG007-CONSUMER ownerauto-os/PLAN054 retains owner-generated rust-workspace/gen and active test services until fixed-pin consumer/full gate+independent final review, folding, normal service stop and no-follow cleanup. Registry holds refreshed; no cache-deletion bypass.
  artifact observation: official Vue dist built/source tested dev+preview; native debug binaryAF845795 and host2c21ca06 tested, three-way publish equality; no app release-profile binary built or production deployment claimed. Native framework prerequisites UI060c0359fab and Lang94923f3a031 are still pending their separate final review/landing under parent054, not falsely reported upstream-delivered. Parent054 and whole Goal remain active.

  Actual archive gate on025efd46080b75d6cc1c3a4c01ee74a3003247d3: archived file tracked at expected path, active path absent, status archived/count4/4 and four checked task rows agree, README archive link resolves, Git tree clean, origin/main==HEAD. Git-show canonical Spec SHA773becf204174eed2af70dec07228bafb8c6980e7be82d508c883cab295a3f41 equals reviewed source, not just working copy. All gates pass; this appended actual-state receipt is documentation-only. Named hold recorded in retention registry; no app worktree/scratch deletion pending, independent clone retained. Follow-on OS parent pin receipt identifies the final archive descendant; no source/dependency change from reviewed delivery.
