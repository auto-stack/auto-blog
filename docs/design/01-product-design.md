# Auto Blog：需求、架构与 UI/UX

状态：proposed；日期：2026-10-04。RealWorld与blog-viewer来源已经合并在auto-blog产品仓，当前主入口仍是RealWorld原型；此设计面向个人创作与可移植发布的首版。

## 1. 与 Jade 的分工

Jade存取、组织和理解知识；Blog面向读者组织作品、校对、预览、形成发布版本和输出。两者可复用AutoDown编辑器、资产和来源协议，无需为每个应用再写一套富文本引擎。

同一已有草稿在两应用打开，应是同entity_id/revision；多份笔记组成文章，则创建新work_id并保留source_refs，源笔记继续存在。共享对象服务尚未实现时，首版使用明确的导入副本/引用映射和后续迁移接口，不能冒称已共享双向编辑。

## 2. 基线审计与第一版范围

`src/back/db.at` 是内存用户/文章数据和demo session token；`pages/editor.at` 是标题、slug、简介、textarea、标签及Publish表单。`references/021-blog-viewer/` 保留另一来源UI。当前没有可依赖的持久化草稿/不可变发布版本；本轮不把现有demo账号系统发布成生产服务。

第一版无需登录就可在本地新建、保存、预览和导出作品；社区列表可继续作为demo模式，不阻塞作者工作。用户始终能精确编辑正文、核对引用；AI建议与人工稿清楚分开。

## 3. 需求矩阵

| ID | 优先级/阶段 | 定义 |
|---|---|---|
| B01 | P0/M1 | 稳定work_id、revision、持久草稿、自动保存和崩溃恢复，不以slug作数据主键 |
| B02 | P0/M2 | AutoDown编辑/Markdown兼容、标题/摘要/标签/封面/图片说明；无法启用富文本时可用纯文本 fallback |
| B03 | P0/M2 | 资料引用、来自Notes/Jade/Reader的导入或链接，保留原文版本/来源 |
| B04 | P0/M2 | 内容预览、桌面/窄屏、资源缺失/链接检查；预览不发往外网 |
| B05 | P0/M3 | 固定revision的发布快照、本地HTML/Markdown+资产导出、可回看版本 |
| B06 | P1 | 内容撤回/新版本、本地站点索引/RSS元数据；真实站点部署按target adapter另验 |
| B07 | P1/原型 | 大纲、润色、摘要与引用检查建议；原稿保留，逐项采纳，禁止编造引用 |
| B08 | P2/v0.7+ | 多人编辑、真实社区认证/审核/评论/反滥用、渠道自动发布、付费订阅/市场 |

OpenBusiness原则影响未来市场的公开成本与分配；首版不实现支付和广告系统。用户创作与内容可迁出优先，官方模板只是参考。

## 4. 数据与版本

Work：`work_id, kind(article), title, summary, body_format, body, tags[], cover_asset?, asset_refs[], source_refs[], revision, status(draft/ready), created_at, updated_at`。Publication：`publication_id, work_ref_with_revision, content_hash, target, artifact_refs[], created_at, state(exported/published/withdrawn)`。slug属于某个发布目标的可变路由，不能改变work_id。

Draft仓储使用条件revision写；冲突保留用户两版。Snapshot不可变，修改草稿不会改已导出的页面；下一次输出生成新publication_id。导出失败不能标published；本地成功只记exported，真实网络目标回执后才记published。撤回是新状态/动作，不删除历史证据。

原资产按hash管理，导出目录打包可用相对路径；受信任格式之外的HTML/脚本不执行。SourceRef包括原知识对象ID、revision、引用片段及可回访定位；合并资料时保留多源。资产删除与草稿/快照引用统一检查，避免改稿清理时把历史发布图删掉。

## 5. 模块设计

| 新模块建议 | 责任 |
|---|---|
| src/back/drafts.at | 草稿、revision、保存/恢复、旧文章迁移，不能依赖demo用户登录 |
| src/back/works.at | 作品元数据、资料来源与资产引用 |
| src/front/authoring.at | 写作/预览/资料边栏，接现有editor且保留旧demo路由 |
| src/integrations/autodown/ | 编辑器版本/能力adapter，复用已有AutoDown API；不复制引擎源码 |
| src/back/publications.at | 冻结revision、历史、导出回执和撤回状态 |
| src/back/exporters/ | Markdown+manifest、静态HTML+资产；渠道adapter另计划 |
| src/integrations/knowledge/ | Notes/Jade/Reader素材交接，显式导入/引用关系 |

AutoDown当前在Notes有vendor基线，Blog尚未注册它；新增依赖须独立pin并记录版本，不能假设已有。编辑器渲染能力按Vue/VM分别探针；业务能通过文本fallback先跑通，不改共享编辑器的隐藏v0.5工作。Markdown→HTML复用可用解析能力，不自写正则渲染器。

## 6. UI/UX

```text
作品：新建  | 草稿 / 已导出 / 历史      搜索

写作：文章标题        已保存             预览  导出
      原文编辑区                         资料/大纲（可收起）
      图片+说明、引用                   [来源笔记 rev / 摘录]

输出：选择已保存版本 → 桌面/窄屏预览 → 缺资源检查 → 生成本地包
```

默认进入最近草稿与新建，不先显示全球feed；旧社区demo通过独立入口访问。宽屏正文+可收资料栏，窄屏专注正文；预览是可返回的独立状态，不覆盖编辑内容。Ctrl+S立即保存，Ctrl+Enter首版仅进入预览/输出确认，不直接网络发布；IME合成阶段不触发快捷动作。

自动保存状态 visible：dirty/saving/saved/error/conflict。标题允许暂空，导出前要求正式标题并校验目标slug；引用/图片未就绪需指出具体项。撤销AI建议能恢复原稿；检查引用展示原资料与差异，不凭模型自信自动补链接。附件替代文字、键盘焦点、全文选取和暗浅色基础覆盖。

## 7. 发布正确性与质量

首版验收一篇含中文、标题/列表/引用、两张图的文章：关进程恢复草稿→预览→固定rev导出→换目录离线打开→再改稿导出v2→v1不变。导出所有资产hash核对，manifest带来源/格式/版本；一个包中不存在跨目录越界引用。本文不是允许agent替用户发布文章的授权，实际外部发布仍由用户指令/明确发布动作驱动。

预览/导出格式能力逐项公开，HTML与Markdown有差异时给提示而不默默丢结构。目标保存p95≤200ms（不含大资产复制），100篇文章列表查询p95≤100ms；报告参考机与数据。暂未做云部署不影响首版本地可用；生产社区是另一条含认证/内容治理的后续路线。


## 跨应用契约 v1（设计提案）

这些字段是本轮四个应用共同采用的草案，尚未成为 AutoOS 已实现的系统 API。首版用版本化 JSON 和应用内适配器实现；不得等待 HIR、Atom/Batom v2、AutoC 或完整知识系统才能运行。

| 对象 | 必需字段 | 规则 |
|---|---|---|
| EntityRef | namespace、entity_id、revision、kind | 应用生成稳定字符串 ID；改标题、路径或展示名不改 ID；跨仓引用带 namespace |
| AssetRef | asset_id、sha256、mime、size、storage_ref、original_name | 文件拷入受管理目录后才确认接收；storage_ref 是逻辑定位符，不是另一机器的绝对路径 |
| SourceRef | producer、original_uri、captured_at、locator、source_revision | 缺失字段显式 null；网页 URL、书内位置、截图区域分类型表示；保留原文 |
| CaptureEnvelope | schema_version=1、request_id、producer、text、asset_refs、source_refs、created_at | 一个请求的重试复用 request_id；同内容的新意图允许新请求；不以正文 hash 合并不同笔记 |
| CaptureReceipt | request_id、entity_ref、durable_at、status | 持久化正文及必需附件后才返回 committed；失败可重试，重复请求返回原收据 |

`request_id` 的幂等记录与实体创建在同一事务边界内提交。接收者不能只相信来自外部的 hash 或 MIME，须校验实际文件。建议附件交换采用显式授权的暂存目录加 manifest；只接受目录内的普通文件，不追随链接，不接受任意本机路径。

未决定的系统 transport 由 adapter 隔离：首个可验收版本支持导入/导出 envelope 文件或当前运行时已有的本地调用能力；本轮不擅自登记新的全局 URI scheme。未来 Launcher、AutoScape、AutoLens、copy-paste bin 使用相同语义，并以能力协商声明可用格式。

知识对象可以被多个应用访问，存储所有权不等于 Jade 的 UI 所有权。尚无共享知识服务时，Notes 持久化到可导出的本地 Inbox；提供外部引用与显式迁移收据。该阶段不声称已实现 Jade 双向共享编辑。共享服务就绪后，同一对象通过 revision 条件写入，冲突返回两版供选择，不用静默覆盖解决。


## 系统通信与 DevTools 的追加方向（2026-10-04）

用户确认应用通信/AutoAI和系统级DevTools是v0.6重点。本文的envelope、业务对象和provider是领域契约；注册/发现、会话、授权、错误、trace、stream与task复用公共系统层，应用不各自实现一套底层协议。

公共方案见[AutoOS通信RFC](https://github.com/auto-stack/auto-os/blob/v0.6-dev/docs/design/strategy/auto-app-communication-v0.6.md)与[系统DevTools RFC](https://github.com/auto-stack/auto-os/blob/v0.6-dev/docs/design/strategy/system-devtools-v0.6.md)。两份RFC尚未冻结；当前app计划仍可先完成独立本地数据与fixture闭环，之后把现有adapter接入公共服务，不以尚未实现的broker作为开始保存真实数据的前置。

应用提供业务Service及能力描述，UI/backend adapter提供观察树和允许动作；系统组件提供Inspector、Agent SDK与diff。复用现有AutoUI能力并显式声明Vue/VM/Rust的差异，不要求本app自行嵌入另一套DevTools面板。AI优先调业务能力，体验验证才走UI动作。

## 工程边界与实施约束

当前基线是 2026-10-04 的独立仓库导入版本；主力机器的 v0.5 尚有未公开工作。新增产品模块优先放新路径，用 adapter 接入既有页面；保留 SOURCE-IMPORT.json、source-sync 分支及教学来源。恢复 v0.5 后从 source-sync 基线做三方差异导入，不直接覆盖产品目录。

本次只是研究与设计，文档中“支持”“应当”均为目标；实现状态以计划验收证据为准。应用后端保持纯 Auto `.at`；不编辑 a2r 生成的 Rust。若现有运行时缺少必要平台能力，先输出最小能力探针和单独的跨仓提案，不把大规模框架改动塞进应用计划。

平台基线：Windows/Linux 桌面及 Web 先完成可用闭环；Harmony 是 v0.6 demo 与适配探针范围。窄屏设计纳入本轮，不能据此宣称已交付手机原生版。Android、iOS/macOS 及完整移动平台产品支持没有在本轮被追加为 v0.6 必达项。

AI 派生内容须标记来源、模型/处理器版本和生成时间；原文、原资产、人工更正均可追溯。未配置 AI 或断网时，核心本地流程仍能完成。任务可取消，可见错误，可重新执行。个人内容传给远程服务由用户选择；默认不自动上传整库。


## 配套文档

[调研依据](../research/20261004-benchmarks.md) · [首版路线](../roadmap-v0.6.md) · [执行入口](../README.md)
