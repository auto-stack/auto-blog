# snapshots-export — 固定版本与本地发布包

状态：current-state（BLOG-003 实现，T-00..T-04；2026-10-31）。来源计划：[docs/plans/003-snapshots-export.md](../plans/003-snapshots-export.md)。

## 1. 职责与边界

- **B05 覆盖**：不可变发布快照（冻结 revision 引用，不复制正文）；本地 Markdown 发布包（正文+manifest+b64 资产，自包含离线）；导出状态机（仅本地 exported，不伪装外部 published）。
- **B06 覆盖**：发布历史（列表/打开/比较/再次输出/撤回）；草稿改动不影响旧快照（AC-02，读 `works/<id>/revisions/rev-N` 非 current）。
- **不在本模块**：真实网络发布（target 仅为提案——`published` 状态不可达，网络发布需独立 target 计划+回执/认证/重试+用户显式操作）；HTML 引擎采集原语（**F-12 跨仓提案**，见 §7；本模块已交付其入库合同）。

## 2. API 合同（api.at → db → 模块）

| API | 语义 |
|---|---|
| `POST /api/works/:work_id/publish` `create_publication(work_id, expected_rev)` | 冻结当前/指定 revision 为 Publication（state=snapshotted）；条件 revision 写，冲突/不存在无半成品 |
| `GET /api/works/:work_id/publications` | 该 work 的历史列表（index 顺序） |
| `GET /api/publications/:pub_id` | 打开 Publication 元数据（含 export_refs） |
| `POST /api/publications/:pub_id/withdraw` | 撤回（终态语义新状态，不删历史） |
| `POST /api/publications/:pub_id/export` `export_publication(pub_id, format)` | 生成本地 Markdown 包；format 仅 `markdown`（html → bad_format；HTML 走 /html 端点） |
| `GET /api/publications/:pub_id/content` | 快照冻结正文（只读；不存在返回 ""） |
| `POST /api/publications/:pub_id/asset` `{asset_id}` | 快照引用资产读取 → `{"b64","mime","sha256"}`；仅服务 artifact_refs 中引号等值登记过的 id（含越界守卫）；未引用/缺失 `b64=""`。注意：str 返回端点的 HTTP body 为 JSON 字符串，信封需二次解析 |
| `GET /api/works/:work_id/content-hash` | 当前草稿内容签名（历史比较基准；不存在 ""） |
| `POST /api/publications/:pub_id/html` `{html}` | 采集 HTML 入库（见 §4）；仅接收已落地包的附加工件 |
| `POST /api/drafts/:work_id/asset-b64` `{b64, sha256, mime, caption, expected_rev}` | D1 ingest：写 `assets/<id>.b64` + AssetRef（sha256/size 实值）+ 正文相对路径图片行；条件 revision 写；负例 `bad_b64`/`bad_sha256`(≠64)/`conflict`/`not_found` |

Publication 模型：`{publication_id, work_id, work_revision, title, content_hash, target:"local", state, created_at, artifact_refs, export_refs}`。`artifact_refs`=快照时刻 work 资产 JSON Lines 冻结副本；`export_refs`=已落地导出工件记录 JSON Lines（`{"format","package","content_hash"[,"exported_at"]}`；markdown 条目带时间戳、html 条目无时间戳=重复采集幂等去重；旧 meta 缺键读回 ""，向后兼容）。

## 3. 存储布局（`AUTO_BLOG_DATA` 数据根下）

```
publications/index.json            # pub_id 数组（清单化提交，禁逐字节扫描）
publications/<pid>/meta.json       # Publication 元数据（write_confirmed 回读）
assets/<asset_id>.b64              # base64 纯文本资产（全 ASCII，零 F-8 暴露）
exports/<pid>/article.md           # 冻结正文（external 引用改写 "]()"）
exports/<pid>/manifest.json        # manifest_version/format/来源/版本/hash/资产清单/decode 说明
exports/<pid>/assets/<id>.b64      # 包内资产副本（相对路径引用）
exports/<pid>/.ok                  # 提交清单（最后写=提交点）
exports/<pid>/index.html           # （可选）采集 HTML 附加工件（F-12 原语落地后由 vue 轨产出）
```

- `content_hash` = `sig-<h>-<len>`：**非加密内容签名**（len + 8 个固定探针出现计数折叠；确定性、双轨同语义、F-8 免疫）。**不承诺抗碰撞**：字节长与标点轮廓相同的中文改稿可同签名——AC-02 不变性断言可靠，UI「与当前一致/已分叉」提示仅供参考。
- AssetRef `size` 语义（b64 条目）= b64 文本字节长（服务端可证）；`sha256`=客户端对解码字节的摘要声明（传输信任，导出电池以解码复算闭环）。
- manifest `assets[].status`：`packaged`（b64 副本入包）/ `remote`（`://` 引用，保留原文不打包，断网断图）/ `external`（本机路径等形态，不打包、正文改写 `]()`，manifest 如实登记）/ `missing_ref`（空引用）。

## 4. 提交纪律与状态机

- **`.ok` 提交点**（001 R-25 同源；a2r 无可靠 rename/remove_dir）：包文件写齐→逐文件回读校验→`.ok` 最后写。无 `.ok`=未提交（中断形态，重试允许覆写补齐）；`.ok` 在且 content_hash 不同=已存在不同版本→`exists_conflict` 拒绝覆盖（AC-03）；同版本重导出=幂等（零包写入，补记录/补状态）。
- **状态机**：`snapshotted → exported`（仅包完整落地+record_export 后）；`snapshotted|exported → withdrawn`；`published` 不可达（AC-05）；exported 重导出幂等不改状态；withdrawn 拒绝导出与 HTML 入库。
- **HTML 入库合同**：仅收已落地包（`.ok` 在、state=exported）的附加工件；写后回读校验；`.ok`/manifest 不动（markdown 基包提交点保持）；拒绝空 html（`bad_html`）与数据根/file:// 绝对路径（`abs_path_rejected`）；未导出包 `not_exported`。
- **错误码**：`not_found`/`conflict`/`meta_write_failed`/`index_write_failed`（快照）；`bad_format`/`withdrawn_not_exportable`/`illegal_state`/`frozen_rev_unavailable`/`frozen_hash_mismatch`/`missing_asset`/`staging_write_failed`/`commit_failed`/`exists_conflict`/`record_failed`/`state_failed`（导出与入库）。所有失败路径零状态迁移（AC-03）。

## 5. UI（`src/front/pages/author.at` 发布与导出区，内联）

- 发布历史行：rev / 状态徽标 / 签名对照（与当前一致·已分叉）/ pub_id·签名 / 导出包 / 打开快照。
- 快照只读面板：冻结正文+签名+「草稿改动不影响旧快照」；写作面隐藏（002 预览同款可返回独立状态；标签/封面/保存行按原设计常显）。
- 操作状态机在 DraftStore（`pubs/pub_error/pub_busy/snap_*`）：发布前 dirty 显式保存（`save_before_publish`）；`LoadPubs` 内嵌于 OpenDraft/NewDraft/SaveCurrent/KeepTheirs 成功路径（页面级调用与 OpenDraft 竞态=T-03 实证修复）；导出/发布独立轻锁 `pub_busy`（不阻塞编辑互斥）。
- HTML 导出按钮未接：采集原语 F-12 缺位（§7）；界面静态说明「HTML 导出待引擎采集原语（F-12 跨仓提案），后端入库面已就绪」= AC-04 差异能力说明。VM 轨同构（同视图树；无 DOM → HTML 边界相同）。

## 6. base64-at-rest 资产管道（T-00 决策 D1）

- ingest：前端 File→base64+crypto.subtle sha256 → `POST asset-b64` → `file.write_text(assets/<id>.b64)`（write_confirmed 回读）。
- 依据：VM 独立脚本 []int→stdlib shim 断裂（F-9）；str→[]int 无 .at 原语；base64/hex 为 #[vm] str 面。零新运行时面、零跨仓依赖。
- 保真：b64 无损 + sha256 存证 + manifest.decode 迁出说明（`certutil -decode` / `base64 -d`）。AC-01 换目录断网闭环实测：包拷贝到数据目录外、原数据目录改名移走后逐文件校验通过，资产解码 sha256 与原件一致（`tests/probe/export_offline_t04.py` 5/5）。

## 7. 已知边界与偏差

| ID | 内容 | 影响 |
|---|---|---|
| F-9 | VM 独立脚本 []int→stdlib shim 断裂（Invalid list ID） | 纯 VM 脚本二进制调用不可用；产品运行时（--server rust）不受影响；D1 不依赖 |
| F-12 | vue 轨引擎 DOM 采集无 in-app 原语（auto-ui dom 命名空间无 innerHTML/outerHTML 读取；引擎无 SSR API；生成模板无注入口） | HTML 离线页未交付；入库合同已就绪并经 fixture 实测；提案=auto-ui `dom.outer_html(sel)` 最小面；计划 §10 载完整提案与证据 |
| F-10/F-11 | a2r 名字解析两类断裂（内建实参含本地 2 参调用 / 用户函数字段访问实参） | 本模块代码纪律：路径经 helper 局部化、字段先提升局部再传（跨仓提案素材） |
| SIG | content_hash 非加密、可碰撞（见 §3） | 比较提示仅供参考；不用于防篡改承诺 |
| B64 | b64 内容按传输信任（不校验字符集）；size=b64 字节长 | 解码复算由导出电池承担；体积 +33% 文档化 |
| A2R | CLI service 启动不检测 .at→.rs 陈旧 | 改 .at 后须删 `rust-workspace/auto-blog-back/src/*.rs` 强制重生成 |
| F-13 | auto-ui 生成器按**纯名字**在使用点分类变量：store 模型字段与 handler 局部变量同名时，局部使用点被发成 `<name>.value`（运行时=undefined，JSON.stringify 静默丢字段→后端 422；vue-tsc 以 TS2551 形式可检） | T-03 曾因模型字段 `snap_body/snap_rev` 撞 R-24 局部名触发（004 统一门 `vue-ui.author_task` 逮住）；已修复=模型字段改名 `frozen_view_*` 与局部 `snap_*` 彻底分离；命名纪律入 SD-01：**store 模型字段禁与 handler 局部同名**；生成器按名分类属跨仓提案素材 |

验收证据（命令/退出码）见计划 §9 与任务行；电池：`probe_export_md.py`（16/16）、`export_offline_t04.py`（5/5）、`pub_history_t03.cjs`（vue UI 8/8）、回归 `probe_pub_api.py`（7/7）、`probe_t02_api.py`（7/7）、统一门 `verify_dual.py` 双 profile。
