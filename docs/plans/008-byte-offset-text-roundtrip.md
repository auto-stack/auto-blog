---
plan_id: BLOG-008
status: executing
feature_name: 当前SDK字节切片下的完整文本往返
author: [Codex]
created_at: 2026-11-06
updated_at: 2026-11-06
plan_revision: 1
current_step: 0
total_steps: 4
base_branch: main
base_commit: 3ead087723dff0ea36df4f9abb64a942a92beeb6
supersedes_spec_components: [docs/specs/blog/durable-drafts.md, docs/specs/blog/snapshots-export.md]
new_spec_components: []
touched_goals: []
---

# BLOG-008：当前SDK字节切片下的完整文本往返

## 0. 变更摘要

父auto-os/PLAN054最终SDK194实测作者保存/关闭/重开：磁盘title完整U054-Vue正式作者草稿54.25-r194，重新打开却得到U054-Vue正式作者草。只读原件完整；驱动在断言失败前没有继续保存截短值，不把该任务计为通过。根因作品元数据手写解析器以.length字符数限制现行find/slice字节偏移；当前SDK真实VM探针中文54.25的.len()=11、.length=7，用后者slice只得中文5。语言规范明确双计量，不能改语言或生成产物掩盖应用误用。

## 1. 目标与边界

中文/emoji及既有转义的标题/摘要/正文/元数据完整保存、重开、继续保存；相同字节索引类路径统一修复。稳定ID、revision、清单、迁移映射、发布签名与存储布局不变；不引入解析库或重写JSON协议。

## 2. 实施归属

唯一开发/复审目录D:/autostack/auto-blog，真实独立clone/main，用户应用规约优先；父组合只消费已审提交，不在apps编辑。进入时main3ead087干净，.next-id008；旁观旧Blog服务PID47236/17829及其C2映射程序不终止、不覆盖。正式clone构建使用父已存在独立Vue消费target c2e02416-vue-final-r187，隔离旧C2 exe。原src/pac及数据先核快照。无链接或重复开发树。

## 3. 依据与设计

已读durable-drafts/snapshots-export现行合同、works/drafts/api/publications/exporters实际文本路径及当前语言vm/overview的Str.len字节/.length字符区分。将与find/slice相配的字符串范围/游标长度改用.len()；逐函数审计，非盲目全局替换。保留迁移键长度前缀的旧字符计量，保留publications content_hash/probe_fold全部既有计量（发布签名不得漂移）；计量用于切片的路径统一字节。JSON首匹配、非法代理U+FFFD、迁移校验零副作用、恢复/条件写顺序保持。转义/解析算法不另行标准化。

### 规范增量

| delta_id | add/modify/retire | target | before/after rule | rationale | AC |
|---|---|---|---|---|---|
| SD01 | modify | docs/specs/blog/durable-drafts.md | 元数据解析/反转义/路径游标使用字节长度与find/slice一致；字符计量身份键保留 | 完整UTF8往返及旧数据兼容 | AC01/02 |
| SD02 | modify | docs/specs/blog/snapshots-export.md | 现有文本切片边界按字节；既有content_hash和probe_fold输出不变 | 不截掉中文尾部且不重签旧发布 | AC01/02 |

## 4. 验证合同

| case/AC | owner_stage | 输入/实际入口 | 关闭条件 |
|---|---|---|---|
| V01/AC01 | work | 永久提取真实生产文本函数或完整模块→SDK194真实VM与实际生成Rust | 修复前UTF8反例真实红；修复后ASCII、中文、emoji、转义/代理、prettyJSON和字段后整数、Unicode目录尾分隔符完整，预期独立手写 |
| V02/AC02 | work | 正式独立Rust后端编译/实际HTTP create-save-open及读取前后文件比对；字节游标类逐项审计 | 中文标题/正文/ID/revision/时间戳不丢；旧迁移键及签名字符计量未改；原件未被读取破坏 |
| V03/AC03 | merge | 父054 SDK194 Vue/iced作者业务任务，旧数据重开与下一次有效保存 | 可见完整字段、实际卸载、独立磁盘/版本一致；不得仅API测试冒充UI |
| V04/AC04 | review/merge | 独立复审、准确Spec、main发布、组合消费和归档清理 | pending逐项保留，不冒称完成 |

## 5. 步骤与发布顺序

- [ ] T00 owner_stage=work：冻结反例和全部同因字节游标/保留字符合同清单。
- [ ] T01 owner_stage=work：有界修复、永久反例/邻面、实际Rust编译/HTTP验证，提交工作完成。
- [ ] T02 owner_stage=review：同clone独立上下文复审源码/Spec/证据。
- [ ] T03 owner_stage=merge：通过独立源码/Spec及全部work后，先push具名已审源码阶段，父候选fetch/detach验证；随后父实际任务/规范/最终文档push/archive，源码等价Doc后继再更新父正式pin。阶段发布不代表最终交付通过；全部AC保留。

## 6. 记录

- stage:new | revision:r1 | outcome:pass→work | authorization:父054解决全部必要阻塞并完成原8app/双端的既有授权；属于原文本持久与重开合同修复，无新功能/预算/支持收窄。计划材料唯一具名父scope D:/autostack/plan-artifacts/plan-054/t07/blog-008，不另建撞号plan-008目录。SDK194 Langf032/UI1dba/Webc36/Man2a9/OSfa93；不改这些框架源码。

## 7. 待澄清

无新增用户语义决定。尚未实施/复审；原始Blog失败保留。父当前六项Vue任务成功不替Blog或最终Native任务。
