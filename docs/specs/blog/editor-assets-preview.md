# editor-assets-preview — 编辑器复用、资料与预览

状态：current-state（BLOG-002 实现，T-00..T-04；2026-10-30）。来源计划：[docs/plans/002-editor-assets-preview.md](../plans/002-editor-assets-preview.md)。

## 1. 职责与边界

- **B02 覆盖**：标题/摘要/标签/封面编辑；Markdown 编辑（AutoDown 引擎）与纯文本降级；`body_format` 持久化（text/markdown）。
- **B03 覆盖**：图片资产（AssetRef 条目 + 正文 `![caption](ref)` 行）；Notes/Reader envelope 显式导入组合（SourceRef 保留 producer/locator/source_revision；copy/reference 区分）。
- **B04 覆盖**：本地预览（可返回独立状态）、缺资源分类提示、预览不执行文章脚本、窄屏响应式。
- **不在本模块**：导出/发布（B05/BLOG-003）、共享知识服务双向同步（显式导入副本为终态语义）、引擎空文档占位（跨仓提案，见计划 F-7）。

## 2. 合同扩展（drafts API）

| API | 语义 |
|---|---|
| `POST /api/drafts` `create_draft(title, body, format) Work` | format 仅接受 `text`/`markdown`，非法值归一 `text` |
| `PUT /api/drafts/:work_id` `save_draft(…, cover, format, expected_rev)` | 全字段条件写；format 空或非法值**保留当前值**（不静默改格式） |
| `POST /api/drafts/:work_id/asset-ref` `add_asset_ref(work_id, storage_ref, caption, mode, expected_rev)` | 追加图片资产 + 正文 `![caption](ref)` 行；条件 revision 写；负例 `empty_ref`/`bad_mode`/`conflict` |
| `POST /api/drafts/import-compose` `compose_from_sources(items) Work` | 多来源 envelope 组合**新作品**；producer/body 必填；`mode` 缺省 `copy`（并入正文），`reference` 只登记不并入；count==0 拒绝零写入；原 envelope/笔记零接触（sha256 实证） |
| `GET /api/drafts/:work_id/asset-check` `asset_check_report(work_id) str` | 预览资产分类报告（只读）：远程（断网断图）/ 本地（浏览器预览不可解析，导出打包）/ 缺失（空引用） |

- 旧 revision meta 缺 `body_format` → 读回归一 `text`；迁移路径（migrate）恒 `text`。
- 兼容注：BLOG-004 API battery（verify_dual.py、drafts_api_probe.ps1）payload 已随新参数更新（cover/format 字段），断言语义不变。

## 3. refs 存储形态（重要）

`Work.asset_refs` / `Work.source_refs` = **JSON Lines**：每行一个 JSON 对象；`""` 或 `"[]"` 视为空。
- 追加 = 纯字符串拼接（零索引）。禁止对含中文内容的字段做 `.len()`/`.slice()` 尾部索引或逐字节扫描——运行时 `.len()` 与 `.slice()` 单位在多字节下错位（计划发现 F-8，001 规则 4 的运行时根因）。
- 对象条目：AssetRef `{asset_id, kind:"image", storage_ref, caption, mime, sha256:null, size:null, mode:"copy"|"reference"}`（sha256/size 远程引用显式 null）；SourceRef `{producer, original_uri|null, captured_at, locator|null, source_revision, mode, title|null}`。

## 4. UI（`src/front/pages/author.at`，写作面**内联**）

- **空稿起稿规则**：markdown 稿打开时正文为空（`body_was_empty`=采纳时刻快照，不随打字翻转）→ 先 textarea 起稿（提示「正文非空后可切引擎」）；正文非空后「切引擎」点亮；有内容稿重开默认引擎。依据：引擎空文档 0 块不可输入（F-7）。`text` 稿恒 textarea。
- **格式/引擎切换**：FormatEdit（markdown↔text，不改正文，随保存落盘）；引擎/降级显式切换保留正文。
- **预览**：可返回独立状态（预览/返回编辑）；渲染经 `autodown` 组件（vue=StreamingRenderer，VM=原生块渲染）；横幅「本地预览（离线可用）· 未识别语法按原文显示」；asset-check 报告可见。`<script>` 等按原文显示，不执行（负控实测）。
- **窄屏**：主行响应式 `flex-col md:flex-row`（375px 纵排：草稿列表全宽在上、编辑区全宽 343px；资产行 flex-wrap）；VM 轨 class 惰性（桌面窗口布局不变）。
- **保存纪律（001 承续）**：cover/format 并入全字段快照 + 读回确认（R-24 扩展）；资产追加/导入与保存共用 `save_in_flight` 互斥；导入在 dirty 时显式 `save_before_import` 拒绝。

## 5. 引擎依赖（vendor）

- `vendor/auto-down/autodown/packages/engine` = @autodown/engine 固定副本（pin c3464d0，src+dist；PROVENANCE.md 记录来源与更新规则）；pac.at `npm_deps: file:../../../vendor/...`。
- Vue 轨构建：**vite build + preview**（见计划 F-2：dev 模式对 linked engine 的传递 CJS 依赖互操作断裂，属 auto-ui 代码生成器跨仓提案）。
- VM 轨：CLI default features 含 autodown（Plan 040 裁定），框架内渲染，无 app 侧依赖。

## 6. 已知边界与偏差

| ID | 内容 | 影响 |
|---|---|---|
| F-2 | vue dev 模式 linked engine 传递 CJS 互操作断裂 | 产品 vue 验收走 build+preview；修复属 auto-ui 代码生成器（跨仓提案） |
| F-6 | VM 轨 `use <module>: <Widget>` 子件实例化静默失败 | 写作面内联于 author.at；跨仓提案另行登记 |
| F-7 | 引擎空文档 0 块不可输入 | 空稿起稿规则（应用层）；引擎空态占位属跨仓提案 |
| F-8 | `.len()`/.slice()` 单位多字节错位 | JSON Lines + find 基规避；json_array_valid（migrate）中文敏感保持 001 原状登记 |
| B-1 | VM「窄屏」等价物=桌面窗口缩放；MCP 驱动不支持窗口 resize | 窄屏以 vue 375px 实测 + VM 响应式 class 惰性覆盖 |
| B-2 | 图片 sha256/size 对远程引用不可得 | 显式 null（契约允许）；本地打包与 hash 校验属 BLOG-003 导出面 |
