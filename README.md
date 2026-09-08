# AI Life Worlds · 人生世界

一个本地优先、可切换剧本的 AI 人生模拟器原型。

完整产品需求、阶段目标和验收标准见 [PRD.md](./PRD.md)。

第一阶段采用开放核心路线：通用 UI、剧本运行时、确定性规则、存档和 AI 适配接口开源；未来可在此基础上增加官方 AI 托管、云同步、AI 剧本生成服务和剧本市场。

## 当前已实现

- React + Vite + TypeScript 响应式 Web/PWA
- 桌面侧栏、移动端底部导航和同一套页面结构
- 原创世界《西方世界的人生》的两个地区样例：晨雾镇与灰潮港（同一剧本内的出生地/地图）
- 剧本主题色、人物、地点、行动建议和开场状态可替换
- 同一套主体 UI 支持 3～4 个可切换的玩家视觉主题，主题不改变规则和存档
- 自由输入行动，先经过确定性规则结算，再可选调用 OpenAI-compatible API 生成叙事
- 成功、部分完成、资源不足拒绝、未知行动等结果
- 时间、体力、钱币、地点、关系、事件履历和公共消息持续更新
- IndexedDB 本地存档；JSON 导出/导入
- `.aiworld.json` 剧本包导入入口；剧本内容以框架和 schema 为核心，可由 API AI 填充并经过校验
- PWA 静态壳与离线资源缓存
- 行动呈现模式：选择优先、丰富建议、自由行动；设置会保存并影响每回合行动入口
- 第二阶段本地行动生成：行动结算后刷新行动变体，排除最近行动；无 API 时仍可继续游玩
- 第二阶段规则扩展：剧本/候选 schema 校验、条件 DSL、延迟事件、NPC schedule 和状态 diff
- AI 候选适配：AI 只能提交经过校验的行动候选，不能直接修改游戏事实
- 桌面与移动端 Playwright 烟雾测试；生产构建生成 PWA 离线静态壳

## 启动

```bash
pnpm install
pnpm dev
```

生产构建与预览：

```bash
pnpm build
pnpm preview
```

测试：

```bash
pnpm test
```

如果在 Windows 中文路径下运行本项目，当前 esbuild 版本可能无法解析 pnpm 的依赖链接。生产构建正常；本地测试可临时将项目映射到盘符后执行：

```powershell
subst X: "C:\path\to\ai-life-sandbox"
Set-Location X:\
pnpm test
```

## AI 配置

打开「设置」，填入 OpenAI-compatible Endpoint、Model 和 API Key。留空时仍然可以使用本地确定性模拟，不需要任何外部服务。

原型直接从浏览器调用配置的 endpoint，真实部署时应改为服务端网关，并加入额度、缓存、模型分级和密钥隔离。

## 剧本包与 AI 生成

剧本包是一个 JSON 对象，扩展名建议使用 `.aiworld.json`。顶层需要包含：

- `manifest`: `id`、`title`、`subtitle`、`version`、`author`、`description`、`capabilities`
- `theme`: `accent`、`accentSoft`、`accentWarm`、`ink`、`paper`、`surface`、`sky`
- `world`: `startingLocation`、`opening`、完整的 `seedState`

运行时会校验基本结构。项目不计划制作重型手工剧本编辑器，而是提供剧本字段框架、规则边界、生成协议、预览和校验入口；具体世界内容可以交给用户配置的 API AI 生成。AI 生成结果必须先通过 schema、ID 白名单、年龄/地图约束和内容长度校验，再作为版本化剧本包加载。规则层仍然负责事实和资源变化，AI 不能直接写入 `GameState`。

## 目录

```text
src/
  data/scripts.ts          内置剧本
  engine/actionEngine.ts   确定性行动结算
  engine/actionPlanner.ts  行动呈现模式与排序
  engine/suggestionEngine.ts 本地行动变体生成
  engine/scriptSchema.ts   剧本包、候选与运行时校验
  engine/aiProvider.ts     OpenAI-compatible 叙事和候选适配
  storage.ts               IndexedDB、导出下载与载荷校验
  store.ts                 游戏状态与剧本运行时
  App.tsx                  通用页面壳
  styles.css               原创纸张/手账视觉系统
design/                    视觉概念稿
script-concepts/           四个预设剧本概念稿；只有达到 85 分且 verified 的剧本进入内置运行时
```

## 路线

阶段 3 已完成：剧本世界、内部地图、多条人生存档、回档和四套 UI 主题均已接入。阶段 4 的长期记忆压缩、事件序号回放、上下文压力测试和 AI 增强超时降级也已完成当前原型范围。阶段 5 已完成首个 AI 剧本分阶段生成与确定性规则切片；阶段 6 已完成只加载 ≥85 分 verified 剧本的剧本库、加载入口、AI 草稿预览和确认加载 UI；阶段 7 正在进行最终本地回归、构建和浏览器验收。当前仍是本地优先原型：暂不做账号、多人、云同步、复杂战斗和既有 IP 内容；跨设备使用请通过 JSON 导出/导入。
