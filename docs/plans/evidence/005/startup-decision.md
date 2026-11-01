# BLOG-005 T-00 决策稿：普通 dev 启动与 F-2 责任收口

状态：T-00 交付（2026-11-01）。本文为可复用决策记录；原始日志/探针脚本留存
`D:/autostack/plan-artifacts/plan-005/t00/`（本地不入库）。所有结论均来自当日
新鲜执行，不采信历史摘要。

## 1. 版本冻结（2026-11-01 实测 pin）

| 组件 | 值 | 与计划 §4 表对照 |
|---|---|---|
| `auto.exe` CLI SHA256 | `390e664ead5fc7559085693f0b2256566eb06b9f6369ac295e4953850c7d2e90` | 漂移（004 基线 `da0558e7…`）——本计划以本 hash 为冻结基线 |
| `auto-ui-tool.exe` SHA256 | `4d2198b8bceba015c9f46157691fac2380cce720d0a5914fdec03c1cb39db47d` | 漂移（004 基线 `563afa4a…`）——同上 |
| auto-blog HEAD | `805e05f`（r1 计划基点 `cd9b5d5` 之后） | — |
| auto-man HEAD（来源，仅溯源） | `1eeac780` | exe↔源绑定无法直接复核（闭包 exe），记录为溯源注意项 |
| auto-ui HEAD（来源，仅溯源；worktree 带 plan-023 WIP） | `aa47313` | `run_vue.rs`=`0c325ac1…`、`run_vm.rs`=`e058a3e8…` 与计划表**逐字节一致**；`auto-ui-tools/src/vue.rs`（现行 vite 配置发射源）=`5a9a79cb…` 新增冻结 |
| auto-lang HEAD | `add1df088` | — |
| auto-down HEAD / vendor 引擎 | `7c4d5cbb` / vendor pin c3464d0（未动） | vendor 零改动 |
| pac.at / author.at / verify_dual.py | 与计划 §4 表**逐字节一致** | 无源漂移 |
| node / pnpm / vite | v25.2.1 / 11.6.0 / 5.4.21 | — |

发现路径：CLI=`auto-man/target/debug/auto.exe`；tool 发现顺序沿用 runtime-acceptance §2
（`auto-man/target/debug/auto-ui-tool.exe` 优先）。vue dev 启动链：`auto run` Step1..6
（源检查→API client→组件物化→**pnpm install**→public 资产→`npm run dev`=`vite`），
Rust 后端子进程由 run_vue 托管（debug profile，冷构建 1m29s；vite ready 612ms）。
**vite dev 默认绑定 `localhost`（本机 ::1）**——就绪探测必须用 `localhost` 而非 `127.0.0.1`
（T-00 首轮 420s 超时即此因，已修正）。

## 2. F-2 实证状态与根因（当前工具链仍复现）

官方入口 `auto run --server rust -F 17926 -B 17927` + 同稿探针（API 种子非空
markdown 稿 → 浏览器打开 → 真实编辑器 DOM 断言 → 输入逐字 API/磁盘回读）：

- **FAIL（复现）**：导航壳正常（`我的草稿` 可见），点开稿件后 outlet 空
  （`mounted=empty-outlet`，ID 不可见），编辑/回读全败。
- 控制台错误（本轮精确签名）：
  `SyntaxError: The requested module '/node_modules/.pnpm/dayjs@1.11.23/.../dayjs.min.js?v=…' does not provide an export named 'default'`
- build+preview 对照（同一探针、同稿）：**PASS**，引擎真实挂载+逐字回读（rollup
  commonjs 互操作正常）——004/002 记录的假绿分叉形态当日仍成立。

根因链（比 002 记录更进一步，全部有当日证据）：

1. 引擎 package.json exports 带 `"development"` 条件 → dev 解析到 **src 链**
   （`./src/index.ts`），build 解析到预构建 `dist`（chunked ESM）。
2. 引擎 src 链经 SFC 组件（`EngineEditor.vue` 等）import mermaid/lowlight/katex；
   SFC 无法被 optimizeDeps 的 esbuild 编译 → 引擎包虽被预构建，**SFC 及其裸导入
   在 serve 时原始伺服**。
3. mermaid(→dayjs CJS)、lowlight(→highlight.js CJS)、katex(CJS) 都是**引擎的传递
   依赖**，pac.at/根 package.json 未声明 → vite 解析不到（`Failed to resolve
   dependency: mermaid, present in 'optimizeDeps.include'` 实测日志）→ 原始伺服
   CJS → 浏览器 ESM 上下文 `default export` 断裂 → 路由组件求值失败 → outlet 空。
   优化产物 `@autodown_engine.js` 中 mermaid 外置 5 处（实测 grep）。

## 3. 责任区分（控制变量矩阵，同仓同稿同探针）

| 轮 | 根 package.json 声明 | vite config `optimizeDeps.include` | dev 结果 |
|---|---|---|---|
| baseline（官方入口复核+组合复核） | engine | 无 | **FAIL**（dayjs raw） |
| cand1 | engine | `['mermaid','dayjs']` | FAIL——两包根不可解析，被跳过（日志为证） |
| cand2 | +mermaid | 无 | FAIL——声明不足以被发现（链接包导入不进 scanner） |
| cand3 | +mermaid | `['mermaid']` | FAIL——dayjs 已消，暴露 lowlight→highlight.js raw |
| cand4 | +mermaid | `['mermaid','lowlight','katex']` | FAIL——lowlight/katex 根不可解析被跳过（日志为证） |
| **cand5** | **+mermaid,+lowlight,+katex** | **三者 include** | **PASS**——引擎挂载+渲染+逐字回读+已保存横幅+零控制台错误 |
| preview 对照 | engine | 无 | PASS（同稿同探针） |

结论：**应用代码无辜**——同一 app 代码仅改变依赖声明+预构建配置即翻绿；责任边界=
「链接引擎链的 CJS 传递依赖在 vite dev 下的可解析性+预构建」。计划 §5-1 的"最小
普通项目"对照由该矩阵替代：控制变量直接作用在真实 app 上，区分力更强（记录为对
设计项的等价实现）。原生/VM 轨不经过 vite，不受 F-2 影响（004 交付事实维持）。

## 4. 修复方案（两半边，均已实证）

**app 侧半边（本仓交付，已落）**：`pac.at` `npm_deps` 显式声明
`"mermaid": "^11.17.2"`、`"lowlight": "^3.3.0"`、`"katex": "^0.16.0"`（版本对齐当日
安装树）。官方管线验证：`auto run` Step4 `pnpm install` 将三者写入根 package.json
并安装（regen-run.log）。hast-util-to-html 为纯 ESM，原始伺服无害，不声明。

**auto-ui owner 前置半边（最小、已验证的发射增量）**：
`auto-ui-tools/src/vue.rs::generate_vite_config()` 的静态模板需增发：

```ts
optimizeDeps: { include: ['<pac.at npm_deps 的全部键>'] }
```

最小实现=把 `parse_npm_deps` 结果的键列表注入该模板（`include` 多余无害）。cand5
即该增量的逐字验证。**不手改 gen、不改 vendor、不改引擎实现**——gen 内的手补配置
会被 run_vue 启动自愈刷新覆盖（本轮实测确认），不可作为交付。

## 5. 冷准备/超时预算决策（T-01 输入）

- 就绪判据：front=vite 日志 `Local:` URL 可 GET 200（用 `localhost`）；back=独立
  `GET /api/drafts` 200。**vite 就绪≠后端就绪**，两判据分开。
- 预算：有界可配置，非固定秒数。首轮实测（热缓存）：后端冷构建 1m29s + pnpm
  install 0.6-3.8s + vite ready 0.6s；**总预算取 420s（B-01 冷缓存轮再实测收紧）**，
  探针首修后单轮 dev≈2.1min（含后端构建）。
- 失败必须显式：早退 rc、日志尾部、端口占用判别（本次已实现 dev_run/cand_run
  骨架，T-01 固化为文档化步骤+门）。

## 6. 环境发现（登记，不阻塞本计划验收面）

| ID | 发现 | 影响/归属 |
|---|---|---|
| E-1 | `auto service --server rust` 走 release 构建，本轮在 sccache 包装下多 crate exit 1（sccache server 本体健康：8990 rust hits）；`auto run` 的 debug 路径正常 | verify_dual/统一门 owner 的环境观察；文档化 dev 入口（`auto run`）不受影响 |
| E-2 | dev/preview 均存在启动期 `pageerror: Cannot read properties of null (reading 'token')`（auth store 读空用户态），非路由阻断，两轨一致 | 预存噪音；不属 F-2；后续计划可另立清理项 |
| E-3 | 磁盘三通道中正文在 `works/<id>/body.txt`（`current.txt`=revision 计数），探针已对齐 | 修正 T-00 探针 oracle 口径 |

## 7. 对计划任务的落点

- T-02「修 dev 依赖/author 动态挂载接缝」：app 半边已交付（pac.at 声明）；**配置
  发射半边=auto-ui owner 前置**（§4），在 owner 交付前 dev 门保持红，验收按真实
  状态记录，不以 build+preview 冒充 dev。
- 跨仓写入范围未扩大：auto-ui 仅只读探查（其 worktree 带 plan-023 WIP，未触碰）。
