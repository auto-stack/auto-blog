# durable-drafts — 个人作者模式与可靠草稿

状态：current-state（BLOG-001 实现，AC-01–AC-05）。日期：2026-10-05。
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
  slug-map.json              # 旧 Article slug → work_id
  works/<work_id>/
    meta.json                # Work 序列化（不含 body）
    body.txt                 # 正文全文
    revisions/rev-<N>.json   # 保存时快照 meta
    revisions/rev-<N>.body   # 保存时快照 body
```

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

## 5. 可靠性规则（T-00 实证，必须遵守）

1. **双轨 fs 面**（Vue rust 后端 + VM）：只用 `fs.write_text` / `fs.read_text` / `fs.exists` / `fs.create_dir` / `fs.is_dir` / `fs.file_size`。
2. **写后 `fs.exists` 校验**：`write_text` 对失败路径可能返回 0（假成功）；UI 只有确认后才能显示「已保存」。
3. **禁用**：`fs.append_text`（VM `File.open failed`）；`json.stringify`（双轨不可用）；`fs.read_dir` / `fs.join` / `fs.size` / `file.*` 裸前缀（a2r 不映射）；逐字节 `slice(i,i+1)` 拼串（吞中文，用 `replace`）。
4. **长串返回**：禁止把含长 `body` 的 Work 嵌进另一结构体返回（VM 截断）；`create_draft`/`open_draft` 直接返回 `Work`。
5. **结构体全量构造**：勿依赖字段赋值（部分路径不稳定；沿 db.at 惯例）。
6. **崩溃恢复**：同步写 + exists 确认后进程退出/杀进程，数据在盘；重启读回一致。
7. **条件 revision**：并发双端同旧 rev 保存，后到者得 `conflict=true`，两版都在（服务端当前版在盘，本机版在编辑器），由用户选择 `保留本机` / `加载对方`。

## 6. 迁移（旧 Article → Work）

- `migrate_article(slug, …)` 幂等：`slug-map.json` 已有映射则返回原 `work_id`，不重复创建。
- **不删除**源 demo 文章；迁移失败保留原件。
- 批量 `migrate_articles_batch(items_json)`：解析对象数组，空/无 slug 跳过。

## 7. UI（`src/front/draft_store.at` + `pages/author.at`）

- 默认路由 `/` = 个人作者（「我的草稿」+「个人模式」徽标）；`/demo` = 社区 Global Feed（Demo 横幅）。**列表与数据隔离**。
- `save_state`：`dirty` / `saving` / `saved` / `error` / `conflict`；仅 `ok` 后置 `saved`。
- 冲突 UI：「保留本机版本」（ForceSave）/「加载对方版本」（重开）。
- 自动保存：`timer` 3s tick，`dirty` 时 SaveCurrent（条件 rev）。

## 8. 偏差与债务（BLOG-001 复审登记）

| ID | 内容 | 影响 |
|---|---|---|
| D-01 | `source_refs`/`asset_refs` 仅类型+序列化，无写入 API | 功能边界 B03；本 Spec 即边界说明 |
| D-02 | 测试目录用 `tests/probe/`（计划写 `tests/fixtures/drafts/`） | 等价隔离 fixture；后续统一可再迁 |
| D-03 | 为接线修改源 demo 文件（api/db/app/article_store/editor/home/login） | demo 路由与 seed 保留；`.me.token`→`session_token` 修 bug |
| D-04 | 纯 rust 后端（`auto run` 缺省）冷启动本机未完成实测 | companion 已过 a2r 转译；VM 轨全绿 |
