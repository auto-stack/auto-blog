# durable-drafts — 个人作者模式与可靠草稿

状态：current-state（BLOG-001 实现，AC-01–AC-05；Phase 3 SD-03）。日期：2026-10-06。
来源计划：[docs/plans/001-durable-drafts.md](../../plans/001-durable-drafts.md)。

## 1. 职责与边界

- **B01 覆盖**：稳定 `work_id`、revision、持久草稿、自动保存、崩溃恢复；**slug 不作主键**。
- **不依赖 demo 登录**：个人创作/保存/列表不经过 RealWorld 账号。
- **不在本模块**：富文本（B02）、资料引用功能（B03，字段仅占位）、预览导出（B04/B05）、发布网络调用（禁止）。
- **数据目录**：`AUTO_BLOG_DATA` 环境变量覆盖；缺省 `USERPROFILE/.auto-blog/data`（或 `HOME/.auto-blog/data`）。测试必须用隔离目录，不接触用户真实数据。

## 2. 数据模型（`src/back/works.at`）

| 字段 | 说明 |
|---|---|
| `work_id` | 稳定 ID，`w-<ms>-<seq>`；改 title/slug **不改 ID** |
| `kind` | 恒 `"article"`（首版） |
| `title` / `summary` / `tags` | 文本；tags 逗号分隔 |
| `body_format` | 恒 `"text"`（首版纯文本） |
| `body` | 正文全文；与 meta 分文件存放 |
| `cover_asset` / `asset_refs` / `source_refs` | **类型占位**（JSON 串，默认 `"[]"`）；读写接口留 B03，本版无业务写入 |
| `revision` | 从 1 起，每次成功保存 +1 |
| `status` | `"draft"` / `"ready"`（首版只用 draft） |
| `created_at` / `updated_at` | epoch 秒 |

## 3. 存储布局（`src/back/drafts.at`）

```text
<data_root>/
  index.json                 # work_id 字符串数组（不用 fs.read_dir，a2r 不映射）
  slug-map.json              # 旧 Article slug → work_id（write_confirmed）
  slug-map.json.bak-<ms>     # map 写失败前的备份
  pending-migrate.json       # 迁移 journal：slug→work_id，半成品可重试复用
  works/<work_id>/
    current.txt              # 已提交 revision 号（提交指针）
    meta.json                # 便捷副本（best-effort；兼容 Phase1）
    body.txt                 # 便捷副本（best-effort；兼容 Phase1）
    revisions/rev-<N>.json   # 不可变 meta 快照（先写并回读确认）
    revisions/rev-<N>.body   # 不可变 body 快照（先写并回读确认）
```

提交顺序：`rev-N.json` → `rev-N.body` → `current.txt`（每步 write_confirmed）。

**读取顺序（Phase 3 R-13）**：
1. 读 `current.txt` 指针 → 加载对应 revision（meta+body **成对**才算完整）。
2. 指针缺失/为空/损坏 → 扫描最高**完整** revision。
3. 指针指向的 revision **不完整**（缺 body）→ **拒绝**（返回 `work_id==""`），不静默降回便利副本或旧 revision。
4. 无任何 revision 时才回退便捷 meta/body（Phase 1 兼容）。

`revisions/rev-N.{json,body}` 成对存在才算完整 revision；缺文件不得当空正文有效稿。

## 4. 接口契约

| API | 语义 |
|---|---|
| `POST /api/drafts` `create_draft(title, body) Work` | 新建；返回 work_id/rev=1 |
| `GET /api/drafts` `list_drafts() []Work` | 列表；**body 为空**（不含正文） |
| `GET /api/drafts/:work_id` `open_draft(work_id) Work` | 打开；找不到返回 `work_id==""` |
| `PUT /api/drafts/:work_id` `save_draft(…, expected_rev) SaveResult` | 条件写；`expected_rev=0` 强制，`>0` 不匹配则 conflict |
| `POST /api/drafts/migrate` `migrate_drafts(items) int` | 批量迁移；幂等；返回条数 |
| `GET /api/drafts/migration/status` | slug_map + data_root + index 摘要 |

`SaveResult`：`ok, work_id, revision, conflict, error`。冲突时 **不覆盖**，`conflict=true` 且带服务端当前 `revision`。

## 5. 可靠性规则（T-00/Phase 2/3 实证，必须遵守）

1. **双轨 fs 面**（Vue rust 后端 + VM）：只用 `fs.write_text` / `fs.read_text` / `fs.exists` / `fs.create_dir` / `fs.is_dir` / `fs.file_size`。
2. **写后全文回读**（R-01）：`write_confirmed` = write + exists + `read_text == content`。`write_text` 返回码/exists 不足——锁文件会假成功。
3. **版本指针提交**：新 revision 写入不可变 `revisions/rev-N.{json,body}` 并回读确认，再写 `current.txt` 指针。失败/半写保留上一确认版本；启动只读完整 revision。
4. **禁用**：`fs.append_text`；`json.stringify`；`fs.read_dir` / `fs.join` / `fs.size` / `file.*` 裸前缀；逐字节 `slice(i,i+1)` 拼串（吞中文）。
5. **JSON 转义**（R-04/15）：`json_escape` 用 replace；`json_unescape` 单遍状态机（find+区间 slice），**禁止占位符**（`_BS_` 等会与正文冲突）；支持 `\uXXXX` 与代理对（`json.parse` 解码）。`json_field_str` 允许冒号**前后**空白（pretty JSON）。
6. **长串返回**：禁止把含长 `body` 的 Work 嵌进另一结构体返回；直接返回 `Work`。
7. **结构体全量构造**：勿依赖字段赋值。
8. **条件 revision**：并发同旧 rev → `conflict=true`，两版可恢复（保留本机 / 加载对方）。
9. **迁移事务**（R-05/14）：先写 `pending-migrate.json` journal（可重试复用同 ID），再 work files，最后 `slug-map.json`（write_confirmed）。映射未确认不计成功；失败备份旧 map。括号扫描必须跳过字符串。**重试在已有 revision 时仍须 `index_add` 确认后才写 map**（index 缺失不得计成功）。
10. **前端缓冲**（R-02/06/11/12）：保存串行化 + `edit_seq` 快照；回执仅当序号未变才清 dirty；**新建/打开/切稿/同 ID 重开前**保存未存缓冲，失败/冲突则**中止动作**并保留本机版；读回须校验 work_id+revision，空/错稿标 `readback_invalid`/`open_failed` 并保留编辑缓冲；`try/catch` 捕获网络异常，禁止停在 saving 或标虚假 saved；`has_current` 守卫空 Work（codegen 初值为 null）。
11. **唯一默认入口**（R-03/07）：`/` 唯一作者路由（勿同时注册 `/author`）；Demo 固定 `/demo`。
12. **完整性校验**（R-13）：revision meta+body 成对才算完整；缺 body 不得当空正文有效稿；指针损坏按 §3 顺序恢复，不静默降回便利副本。

## 6. 迁移（旧 Article → Work）

- `migrate_article(slug, …)` 幂等：`slug-map.json` 已有映射则返回原 `work_id`，不重复创建。
- **不删除**源 demo 文章；迁移失败保留原件。
- 批量 `migrate_articles_batch(items_json)`：解析对象数组，空/无 slug 跳过。

## 7. UI（`src/front/draft_store.at` + `pages/author.at`）

- 默认路由 `/` = 个人作者（「我的草稿」+「个人模式」徽标）；`/demo` = 社区 Global Feed（Demo 横幅）。**列表与数据隔离**。
- `save_state`：`dirty` / `saving` / `saved` / `error` / `conflict`；仅读回校验通过后置 `saved`。
- 冲突 UI：「保留本机版本」（ForceSave）/「加载对方版本」（重开）。
- 自动保存：`timer` 3s tick，`dirty` 时 SaveCurrent（条件 rev）。
- **缓冲保护**（R-11/12）：NewDraft / OpenDraft（含同 ID 重开）在 dirty 时先保存；保存失败/冲突即中止并保留 `editing_*`；SaveCurrent/ForceSave 读回校验 `work_id`+`revision`，不合格标 `readback_invalid` 且不覆盖本机缓冲。

## 8. 偏差与债务（BLOG-001 复审登记）

| ID | 内容 | 影响 |
|---|---|---|
| D-01 | `source_refs`/`asset_refs` 仅类型+序列化，无写入 API | 功能边界 B03；本 Spec 即边界说明 |
| D-02 | 测试目录用 `tests/probe/`（计划写 `tests/fixtures/drafts/`） | 等价隔离 fixture；后续统一可再迁 |
| D-03 | 为接线修改源 demo 文件（api/db/app/article_store/editor/home/login） | demo 路由与 seed 保留；`.me.token`→`session_token` 修 bug |
| D-04 | 纯 rust 后端（`auto run` 缺省）冷启动本机未完成实测 | companion 已过 a2r 转译；VM 轨全绿 |
| D-05 | demo smoke 子集（T1–T6/T9–T10/T12–T14）红 | 与 r3 基线同类（seed/auth/detail 异步）；非 BLOG-001 AC |
| D-06 | 原生 `auto run -r vm` UI 窗口本环境不可交互驱动 | 后端 HTTP 22 routes 已启动验证 |
