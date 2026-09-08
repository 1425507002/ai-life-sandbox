# AI Life Sandbox · 项目交接状态

> 状态日期：2026-09-08（Asia/Shanghai）
> 目的：明日继续开发时，以本文件恢复上下文，不依赖聊天记录。

## 当前结论

- 项目：`ai-life-sandbox`
- 位置：`C:\Users\li\Documents\ChatGPT\配置环境\ai-life-sandbox`
- 远程仓库：`https://github.com/1425507002/ai-life-sandbox.git`
- 分支：`main`
- 上一次已推送提交：`b3bef22 docs: refine preset scripts and scoring rubric`
- 本轮文档/夹具修改尚未提交、尚未推送。
- 四个预设剧本的独立评分已完成：最高为《霓虹城的人生》`85.5` 分，达到用户要求的 `85-90` 合格线；概念闸门通过。
- 该分数只代表概念与规格评审，不代表运行时、浏览器或真实 AI API 已通过。

## 本轮已完成

1. 依据独立评分反复修订剧本概念稿，评分过程为：urban `77.3 → 83.7 → 85.5`。
2. 《霓虹城的人生》新增唯一 JSON 规则夹具：
   - `script-concepts/URBAN-LIFE-V6-FIXTURES.json`
   - 文件名沿用 V6，但内部 `schemaVersion` 已为 `urban-life.v7`。
   - 15 个 action、30 个唯一模板、adult/child 年龄白名单、参数注册、失败语义、条件 schema、三条 pathSpec。
3. 新增可读回放说明：`script-concepts/URBAN-LIFE-REPLAY.md`。
4. `urban-life.md` 不再维护第二份不完整初始快照，已引用 JSON 夹具作为唯一权威状态输入。
5. 修复并明确：
   - 模板 `parameter` 必填且与 action registry 闭合。
   - 地图/地点参数与职业路径绑定。
   - `ECON_INSUFFICIENT`、`REQUEST_CLOSED` 失败时不扣资源、不推进时间，只写审计。
   - 稳定/专业/关系三条首轮路径的状态差异可纸面复算。
   - child 白名单包含 `weekly-review` 和 `local-notice`，不包含成人行动。
6. 独立评审智能体已完成并关闭，没有遗留临时智能体。

## 已验证内容

最近一次本地夹具检查通过：

- JSON 可解析，`schemaVersion=urban-life.v7`。
- 15 个 action、30 个模板、30 个唯一模板 ID。
- 模板必填字段完整。
- 所有模板 `actionId`、`parameter`、`fallbackActionId` 可解析。
- 年龄白名单覆盖 action registry，无缺项。
- `URBAN-LIFE-REPLAY.md` 中的初始状态与 JSON `initialState` 深度一致。
- `git diff --check` 通过（只有 Windows 换行提示，无内容错误）。

## 当前未完成

- 本轮修改尚未形成 Git 提交。
- 本轮修改尚未推送 GitHub。
- 尚未重新运行项目现有的 `pnpm test` 与 `pnpm build` 作为收尾验证。
- 尚未把 JSON 夹具接入真实运行时规则引擎。
- 尚未做浏览器端三条正常路径、两条失败路径、无 API 十步回放。
- 尚未做真实模型 API、上下文压缩、长上下文压力和 UI 回归测试。
- 其他三个剧本仍是概念稿，尚未转成各自的 JSON 夹具；这是后续实施内容，不影响本轮 urban 概念闸门通过。

## 明日推荐顺序

1. 读取本文件和 `script-concepts/SCRIPT-RANKING.md`，确认工作区未被其它修改覆盖。
2. 运行 JSON/回放一致性检查与 `git diff --check`。
3. 在项目根目录运行：
   - `pnpm test`
   - `pnpm build`
4. 检查 `git diff`，确认只包含本轮预期的剧本文档、评分、回放和 JSON 夹具。
5. 提交一个独立里程碑提交，例如：`docs: pass preset script concept gate`。
6. 按项目 Git 规则推送 `main`，然后用 `git status`、`git log` 和 `git ls-remote` 核验远程已更新。
7. 下一阶段再开始把 urban 夹具接入运行时，并用浏览器做真实回放；不要把本轮纸面评分当作运行时通过。

## 重要边界

- 不要用 `git reset --hard`、强制推送或删除远程分支。
- 不要把 API Key 写入仓库、日志、交接文件或聊天。
- 保留用户已有未提交修改；修改前先检查 `git status`。
- 代码/功能变更和文档/规则里程碑分别形成清晰提交，提交前必须做匹配的测试或验证。
