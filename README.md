# auto-blog

博客与文章社区，使用 AutoLang / AutoUI 开发的独立应用。

## 当前状态（2026-10-05）

- **个人作者模式（BLOG-001）**：`/` 为「我的草稿」——未登录可创作、自动保存、崩溃恢复、条件 revision 冲突保护。
- **社区 Demo**：`/demo` 为 RealWorld 演示 feed（种子数据/账号仅演示用）。
- 规范见 [docs/specs/blog/durable-drafts.md](docs/specs/blog/durable-drafts.md)。
- 计划与复审证据见 [docs/plans/001-durable-drafts.md](docs/plans/001-durable-drafts.md)（Phase 2 修复中）。

## 运行

安装对应版本的 `auto` CLI 后，从本仓根执行：

```sh
# 推荐：VM 后端（真实文件持久化）
AUTO_BLOG_DATA=./.tmp/blog-data auto run --server vm
# 或 Vue 前端 + VM
auto run --server vm
```

前端端口：`17826`。后端端口：`17827`。

数据目录：`AUTO_BLOG_DATA` 环境变量；缺省 `~/.auto-blog/data`。

共享 StyleKit 已固定在 `vendor/stylekit`。

## 测试

```sh
cd tests && npm i
RW_URL=http://localhost:17826 npm test
# API probe
pwsh -NoProfile -File tests/probe/drafts_api_probe.ps1
pwsh -NoProfile -File tests/probe/review_001_api.ps1 -DataRoot .tmp/review-001
node tests/probe/review_001_store.cjs
```

## 来源与组合

来源提交、路径与文件 hash 见 `SOURCE-IMPORT.json`。首次导入提交保留在 `source-sync` 分支。

AutoOS 通过 [`apps/023-realworld`](https://github.com/auto-stack/auto-os/tree/v0.6-dev/apps/023-realworld) submodule 固定本仓版本。

## 产品规划（2026-10-04）

[需求与设计、首版 roadmap、业界调研及前三个实施计划](docs/README.md)。

