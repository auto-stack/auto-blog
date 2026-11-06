---
plan_id: PLAN-007
status: executing
feature_name: 作者页有限窗口滚动可达性
plan_revision: 1
current_step: 0
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
- [ ] T-01 (owner_stage=work; AC-01/02; src/front/app.at)：标准滚动视口、正式生成/实际原生和Vue验证；源与所测产物身份一致。
- [ ] T-02 (owner_stage=work; AC-01/02; SD-01)：关闭重开/下一次操作与窄屏检查，更新canonical Spec、README与真实回执。
- [ ] T-03 (owner_stage=review; AC-03)：按最终提交复审，缺项具名，不将queued或截图空壳算通过。
- [ ] T-04 (owner_stage=merge; AC-04)：app推送/OS pin消费、归档与恢复信息。

## 9. 复审记录
stage: new | plan_id: PLAN-007 | plan_revision: 1 | outcome: pass | next: work/T-01。范围与OS054授权一致；当前仅草案，尚无实现/验收通过。

## 10. 待澄清事项
无需新增用户决定。若标准scroll机制有实际框架缺陷，先记录具名前置及可复现条件，再决定同范围修复归属；不降低验收。