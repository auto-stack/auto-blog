# vendor/auto-down — @autodown/engine 固定副本

- 来源: https://github.com/auto-stack/auto-down.git
- pin: master c3464d0（2026-10-30；其后提交不存在，快照即 pin）
- 范围: 仅 `autodown/packages/engine` 消费面（src + dist + package.json；不含 node_modules/rust/scripts/auto 与上游内部文档）
- dist: 源检出预构建产物（与本 pin src 对应；消费方无需再构建）
- 消费: pac.at `npm_deps: {"@autodown/engine": "file:../../../vendor/auto-down/autodown/packages/engine"}`
  （生成器写入 gen/front/vue/package.json；app 侧 `pnpm install` 经离线/在线均可解析）
- 更新规则: 换 pin 须整目录替换并同步本文件 + 计划记录；不手改包内文件
- 上游同源: auto-notes vendor/auto-down 子模块 pin c39ac7f9（本 pin 的前 2 个提交，
  差异=fmt 格式化 + package files 字段；引擎 API 面一致，T-00 探针 vue/vm 双轨实证）
