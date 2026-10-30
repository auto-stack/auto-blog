# durable-drafts — 个人作者模式与可靠草稿

状态：current-state（BLOG-001 实现，AC-01–AC-05；Phase 5 SD-05+SD-06）。日期：2026-10-29。
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
    current.txt              # 已提交 revision 号（提交指针=当前确认版本的权威引用）
    high-water.txt           # 持久高水位（已观察最高 revision；只增）
    meta.json                # 便捷副本（best-effort；兼容 Phase1）
    body.txt                 # 便捷副本（best-effort；兼容 Phase1）
    revisions/rev-<N>.json   # 不可变 meta 快照（先写并回读确认）
    revisions/rev-<N>.body   # 不可变 body 快照（先写并回读确认）
    revisions/rev-<N>.ok     # 提交清单 {"work_id","revision","body_len"}（body_len=fs.file_size 字节数）
```

提交顺序：`rev-N.json` → `rev-N.body` → `rev-N.ok` 清单 → `current.txt` → 便利副本 → 高水位（每步 write_confirmed；指针仅在完整确认后写）。

**读取协议（Phase 5 R-25）**：
1. 指针存在且可解析 → 指针即权威：目标 revision 内容校验（meta/body 存在、可解析、meta.work_id 与请求一致、meta.revision 与文件名一致）；若 `.ok` 存在，清单逐项与磁盘核对（work_id/revision/body_len==fs.file_size）。校验失败 → **返回空 Work（可见恢复异常）**，不静默降级到旧版或便利副本。校验通过即服务该版本，并把 `.ok` 升级为清单形态、推进高水位（旧格式自愈）。
2. 指针缺失/空/非法 → 扫描恢复：边界 = max(高水位, 最近见档+64) 动态扩展，**无固定版本上限**；有 `.ok` 且清单+内容双验的最高 revision 为确认版；撕裂候选（有文件无 `.ok`）不提升、也不阻断更高确认版；**整个 work 无任何 `.ok` 时视为 Phase 1–3 旧格式**，按内容校验取最高完整版并补写清单升级。
3. 无 revisions 时回退便捷 meta/body（Phase 1 兼容，须 work_id 一致）。

`rev-N.ok` 清单是提交完整性凭证：截断 body（长度不符）、错身份、错版本、损坏清单都使该 revision 不可作为确认版服务；纯文本 `.ok` 仅当内容等于该 revision 号时按旧格式接受。

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
3. **清单化提交**（R-21/25）：新 revision 写 `revisions/rev-N.{json,body}` 后写 `.ok` 持久清单（身份/版本/正文字节数，回读校验），最后写 `current.txt` 指针。指针是当前确认版本的权威引用：目标损坏/清单矛盾 → 可见异常（空 Work），不静默降级；恢复扫描用持久高水位 + 动态边界，无固定上限；撕裂候选不提升、不阻断更高确认版；全 work 无 `.ok` 按旧格式内容校验升级。
4. **禁用**：`fs.append_text`；`json.stringify`；`fs.read_dir` / `fs.join` / `fs.size` / `file.*` 裸前缀；逐字节 `slice(i,i+1)` 拼串（吞中文）。
5. **JSON 转义与校验**（R-04/15/27/28）：`json_escape` 用 replace；`json_unescape` 单遍状态机，**禁止占位符**；`\uXXXX` 解码——仅当前码点真实在 D800–DBFF 且紧随 `\uDC00–DFFF` 才成对消费 12 字符，其余逐个解码，孤立代理以 U+FFFD 替换（非代理区相邻 `\uXXXX` 不得吞字）。`json_field_str` 允许冒号前后空白。迁移前必须过完整 JSON 校验（迭代式：结构/逗号/冒号/转义含 `\b\f\uXXXX`/字面量/数字/嵌套；根数组元素必须是对象），且六个已知字段（slug/title/description/body/tagList/author）存在即必须为字符串——任何违规在任何副作用之前整批拒绝、零写入。
6. **长串返回**：禁止把含长 `body` 的 Work 嵌进另一结构体返回；直接返回 `Work`。
7. **结构体全量构造**：勿依赖字段赋值。
8. **条件 revision**：并发同旧 rev → `conflict=true`，两版可恢复（保留本机 / 加载对方）。
9. **迁移事务与身份**（R-05/14/22/26/29）：先写 `pending-migrate.json` journal，再 work files + index，最后 source-map 与 slug-map（write_confirmed）；任一映射失败不计成功并备份旧 map。重试在已有 revision 时仍须 `index_add` 确认后才写 map。组合迁移键默认字面量 `author::slug`，任一组件含 `::` 时切换长度编码（两态文本空间不相交，整键单射）；**映射查找一律用转义后键**（与写入形态一致；无引号键为恒等）；`map_put` 键已存在时原位替换、不存在才追加（无重复键）。旧 slug-map 身份沿用前必须经 source-map 归属检查（已被其他来源认领的 ID 不沿用）；所有成功路径（含幂等早返回）核对/修复 index、slug-map 与作品文件。
10. **前端缓冲与互斥**（R-02/06/11/12/19/20/23/24）：`save_in_flight` 互斥覆盖**保存+读回+最终切换全程**（不得在 save 回执后提前释放）；每个 await 前后核对 `edit_seq`——目标 create/open/reload 等待期发生编辑一律中止切换并保留本机缓冲；已确认保存必须把 `current` 推进到服务器确认版本（中止切换也不得留旧 rev 造成下次冲突）。普通/强制/切前保存共用同一全字段读回确认（work_id/revision/body/title/summary/tags），不符标 `readback_invalid` 且保留缓冲；初态 `has_current` 守卫；`try/catch` 捕获网络异常，禁止停在 saving 或标虚假 saved。
11. **唯一默认入口**（R-03/07）：`/` 唯一作者路由（勿同时注册 `/author`）；Demo 固定 `/demo`。
12. **完整性校验**（R-13/21/25）：revision meta+body 成对、身份/版本与请求一致、`.ok` 清单（若存在）与磁盘逐项相符，才算可服务；缺 body、截断 body、foreign work_id、损坏清单都不得当有效稿，指针目标受损时返回可见异常而非静默回退。

## 6. 迁移（旧 Article → Work）

- `migrate_article(slug, …)` 幂等：source-map（新键或旧格式键）命中即返回原 `work_id`，并核对/修复 index、slug-map 与作品文件；无 source-map 记录时沿用旧 slug-map 身份（经归属检查），不重复创建。
- **不删除**源 demo 文章；迁移失败保留原件。
- 批量 `migrate_articles_batch(items_json)`：完整 JSON 校验 + 字段类型校验全过才开始迁移；空/无 slug 跳过；幂等（含含引号 slug——键转义一致）。

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
| D-04 | ~~纯 rust 后端门禁未闭：a2r 生成物编译失败 59 errors~~ **已关闭（BLOG-004 T-02/T-05，2026-10-29）**：auto-lang/PLAN-885（交付 `dacd00184`）修复生成器/runtime 四组根因（time 路径/字符串借用/int 宽度签名/模块类型路径）后，纯 .at 冷生成→编译 exit 0，59 errors 归零 | 经版本绑定证据关闭：CLI 重建（`da0558e7`，链 auto-lang master 交付面）后正式入口 `auto service --server rust` 下 13/13 API 电池（创建/列表/打开/条件保存/陈旧 rev 冲突/迁移幂等/5 负例）+ `AUTO_BLOG_DATA` 隔离 + 重启持久化全绿（`verify_dual.py --profile vue-rust` 15/15，含 Vue 全交互） |
| D-05 | demo smoke 子集（T1–T6/T9–T10/T12–T14）红 | 与 r3 基线同类（seed/auth/detail 异步）；非 BLOG-001 AC |
| D-06 | ~~原生 `auto run -r vm` UI 窗口本环境不可交互驱动~~ **已关闭（BLOG-004 T-03/T-06，2026-10-30）**：链式修复 auto-ui/PLAN-003（原生控制夹具）→ BLOG-004 T-03（app.at 多 store 裸调用歧义限定，plan-446 A1）→ auto-ui/PLAN-015（VM 路由页动态加载静默失败，交付 `df39593`）后，原生窗口可完整驱动 | 经版本绑定证据关闭：`auto run -r vm --server rust` 真实窗口"博客"经 MCP 完成作者任务（创建/3s 自动保存/外部抢写冲突保稿/保留本机恢复）、正常 q 退出与强制杀树均回收、重开数据逐字节一致（`verify_dual.py --profile native-vm-rust` 22/22 EXIT=0，两次独立会话复现） |
