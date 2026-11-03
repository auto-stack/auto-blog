# 主题采纳合同（theme-adoption）

> 来源：auto-os/PLAN-056（2026-11-04 work 候选；本仓候选 `43ef2a9`）。
> 宿主主合同：auto-os `docs/specs/shell/host-theme-policy-and-delivery.md`；
> 本批登记页：auto-os `docs/specs/apps/product-theme-batch-056.md`。

## 消费形态

- **固定快照**：`vendor/themes` = UI 管理渠道发布的官方主题包快照
  （`themes` 0.2.0，内容 digest
  `9fa07742dc68aa5377ae06cb2d966386002063f184c515b6c5dddf8a6bef838e`，
  per-file sha256 与源包校验同律）。快照不可二次编辑、非第二权威源；
  升级 = UI 发新快照替换 + 本仓重验。
- **pac 声明**：`dep themes { path: "vendor/themes" }`；`theme` 键保持
  缺省 = **follow 宿主**（宿主策略完整快照 > 本 design 默认 > legacy 回退；
  本仓历史即无显式 theme 键）。
- **源内导入**：`use themes.themes: Auto`——缺此行包主题不入收集链，
  design/follow 候选按 C-11 未注册整帧拒绝（031 合同）。
- **design 默认**：静态 light（路由壳无 dark_mode 位，状态在各 store 页面；
  原 token 类 + font-serif 默认语义不变）；`dark_mode` 语义沿 458 机制
  （family 链激活时由已提交策略派生 mode 驱动）。

## 豁免与不变量

- brand-green 按钮配对字（`bg-brand-green … text-white`，本 demo 自定义语义色）整体豁免（源注 ×5 系 author.at 口径；实际 10 处分布 5 页面文件——2026-11-04 复审 R3 更正）；
  真实作者/草稿/编辑器业务与 auth/article/draft store 链原样。
- 原完整适用门在采纳前后保持：`tests/dual/verify_dual.py --profile vue-rust`
  与 `--profile native-vm-rust`（os-056 冻结工具链，AUTO_EXE=组树
  `auto.exe 5858593b…`、native 轨 AUTO_UI_TOOL_BIN=组树 `3493e746…`）：
  **采纳前后逐场景失败集完全一致**（vue-rust 8/14+6 失败同集；native-vm
  9/14+5 失败同集；A/B 以 `git checkout 84a5514 -- pac.at src/front/app.at`
  取基线，同轮工具链复跑）——失败均为 blog 基线既存（works 生成码
  `works.rs:150` CJK 切片 panic 级联 + 已保存标记断言），属 blog 产品线
  既有面（blog-005 在途域），非本包回归；主题相关的 8+9 个通过场景
  （含真实渲染/导航/登录/草稿流）证明采纳面健康。

## 验证与测试设施

- 套件自含端口/数据隔离；运行需 `AUTO_EXE`/`AUTO_UI_TOOL_BIN`/根 env 显式
  （harness 读取 `AUTO_EXE` 与 `AUTO_UI_TOOL_BIN`，native 轨缺后者即
  KeyError）。
- BLOG-005 的 `vue-dev-rust` profile（dev 入口独立验收）不属本包门；其
  auto-ui emission 前置与本接入正交（本接入不改 vite/engine 面）。
