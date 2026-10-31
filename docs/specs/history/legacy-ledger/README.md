# 旧 Spec 账本迁移对账

<!-- PLAN-107 migration reconciliation -->

## PLAN-107：auto-blog-root

旧源：`auto-blog/.autoos/specs.json`。

原字节 SHA256：`c8373155bdeac61a65804915e452ffc262e3e09af6fee12c23246505cebcf98a`；本批 10 条 + 1 envelope，全部原记录可从 AutoDown Markdown JSON 围栏回读。原 JSON 不改写、不删除。

提交归属：auto-musk PLAN-107；执行基线 `04cf7b3a81766e54379adb8fe2ab51118d2617b7`。最终迁移提交和默认分支落地映射记录在该计划 §9；本报告与保全文档由同一仓库迁移提交管理。

本批核对每条记录的来源、归属、当前/历史边界及保全内容；现有 canonical 文档优先，历史执行数字不重新认证，也不将旧状态改成 approved。无正文占位和外部历史收据有显式处理结果。

- [auto-blog-root section 0：1 条](plan-107-auto-blog-root-section-0.md)
- [auto-blog-root section 1：1 条](plan-107-auto-blog-root-section-1.md)
- [auto-blog-root section 2：2 条](plan-107-auto-blog-root-section-2.md)
- [auto-blog-root section 3：2 条](plan-107-auto-blog-root-section-3.md)
- [auto-blog-root section 4：2 条](plan-107-auto-blog-root-section-4.md)
- [auto-blog-root section 5：2 条](plan-107-auto-blog-root-section-5.md)

### 子模块去重

- `D:\autostack\auto-os\apps\auto-blog\.autoos\specs.json`：原字节 SHA256 `83962267700e82085381409b19a8776f99eb079044f36e60f95e96f5309f4a95`；解析值与本项目根账本相等，仅登记 alias，不重复导入、不改 gitlink。

子模块组合检出仍使用原 pin；此处独立仓的文档迁移不代表组合发行已经更新。

### 恢复与回滚

未合入时使用同一 manifest 的 rollback，仅删除迁移自有且 after hash 未变的导入文件；修改过的文件明确拒绝。报告、规范提炼和规则变更在完整 Git 写集合中审阅。合入后从专用回滚工作树对本批提交作新的 `git revert`，无关后续修改保留，重叠修改先解决冲突；不 reset 默认分支。批次状态按项目记录，局部失败不伪称跨仓原子成功。

原字节备份/journal/逐文件指纹在本地批次目录，遵守当前证据保留规则；长期回滚依据各仓 Git 提交、本文及原值保全文档，不能仅依赖临时附件。
