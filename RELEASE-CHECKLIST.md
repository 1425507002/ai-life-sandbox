# AI Life Worlds 发布前检查清单

> 审计日期：2026-09-06  
> 审计范围：A-F 原型实施后的当前 `main` 工作树

## 结论

当前版本适合作为本地优先的公开原型继续封闭测试，不等同于可直接托管运营的生产版本。核心规则、存档、PWA 静态壳和可选 AI 增强已经具备可回归证据；真实在线模型仍需要用户自行配置 API Key，生产环境不能让浏览器长期持有服务商密钥。

## 自动化验证

| 检查项 | 命令/范围 | 结果 |
|---|---|---|
| 单元测试 | `pnpm test` | 93 passed，1 个压力测试按环境变量跳过 |
| 记忆专项压力 | `RUN_MEMORY_STRESS=1 AI_CONTEXT_TOKENS=128000 pnpm exec vitest run --config vitest.config.mjs src/engine/memory.stress.test.ts` | 1 passed；历史量为配置窗口的 3.1 倍以上 |
| 记忆回归压力 | `RUN_MEMORY_STRESS=1 AI_CONTEXT_TOKENS=16000 pnpm exec vitest run --config vitest.config.mjs src/engine/memory.test.ts src/engine/memory.stress.test.ts` | 11 passed |
| 生产构建 | `pnpm build` | 通过，TypeScript/Vite/PWA 产物生成 |
| 浏览器验收 | `pnpm test:e2e` | 9 passed，9 skipped；桌面核心流程和移动核心布局均执行并通过，另 9 个桌面/移动互斥用例按项目条件跳过 |
| 生产依赖审计 | `pnpm audit --prod --json` | 0 info/low/moderate/high/critical |
| 差异格式 | `git diff --check` | 通过；仅有 Windows LF/CRLF 提示 |

压力测试会故意构造超过配置窗口 3.1 倍的历史，验证发送给 AI 的 `MemoryPacket` 仍保持有界；接入具体模型后，应将 `AI_CONTEXT_TOKENS` 换成该模型的官方窗口重新执行。

## 安全、隐私与许可证

- 代码许可证：仓库包含 Apache-2.0 `LICENSE`。
- 当前 API Key 只用于本地设置和请求头，不写入仓库；跟踪文件未发现常见私钥/令牌模式。
- 当前原型直接从浏览器请求配置的 endpoint。公开部署前必须改为服务端 AI 网关、密钥隔离、额度控制、日志脱敏和删除/导出策略。
- 不把用户存档、行动输入、模型响应或 API Key 上传到第三方分析服务；后续埋点必须取得明确同意并提供关闭入口。
- 首发剧本为原创内容；社区剧本、图片、字体和音频必须在进入发行包前单独核验许可证和署名要求。

## 跨端与 PWA 边界

- React + Vite + TypeScript 共用桌面与手机布局。
- 生产构建会生成 manifest、service worker 和静态预缓存资源。
- 无 API 时可使用本地确定性规则继续游戏。
- 当前没有账号、云同步或多人能力；跨设备迁移使用 JSON 导出/导入，不能宣传为自动同步。
- Capacitor/Tauri、应用商店签名、推送和后台同步不属于本次发布范围。

## Git 与回滚

本轮独立变更均已形成提交并推送到：

`https://github.com/1425507002/ai-life-sandbox.git`

- A：`54d9492 docs: record latest open-source audit`
- B：`7f32acd fix: keep AI action choices unique`
- C：`9f0e47e feat: add monotonic event replay ledger`
- D：`2f09fd9 feat: harden bounded memory compression`
- E：`895df49 feat: make AI enhancement timeouts observable`
- F：本次发布检查文档提交后，以远程 `main` 与本地 `HEAD` 一致为通过条件。

回滚优先使用 `git show`、分支或 `git revert`；未经明确授权不得强制推送、删除远程分支或使用破坏性重置。

## 发布前仍需人工确认

- 使用真实模型和用户自己的 Key 做一次端到端连接测试，确认 endpoint、模型名、额度和服务商返回格式。
- 进行不同浏览器、窄手机和真实网络环境的人工体验测试。
- 在公开发布前完成第三方依赖、剧本素材、隐私政策、数据删除和 API 网关审查。
- 进入商业化前再评估托管 AI、云同步、剧本市场和作者工具，不把当前原型的本地 Key 模式当作商业生产架构。
