# AI Life Worlds · 人生世界

一个本地优先、可切换剧本的 AI 人生模拟器原型。

完整产品需求、阶段目标和验收标准见 [PRD.md](./PRD.md)。

第一阶段采用开放核心路线：通用 UI、剧本运行时、确定性规则、存档和 AI 适配接口开源；未来可在此基础上增加官方 AI 托管、云同步、剧本市场和高级创作工具。

## 当前已实现

- React + Vite + TypeScript 响应式 Web/PWA
- 桌面侧栏、移动端底部导航和同一套页面结构
- 原创剧本「晨雾镇：一段普通人生」与「灰潮港：潮汐之间」
- 剧本主题色、人物、地点、行动建议和开场状态可替换
- 自由输入行动，先经过确定性规则结算，再可选调用 OpenAI-compatible API 生成叙事
- 成功、部分完成、资源不足拒绝、未知行动等结果
- 时间、体力、钱币、地点、关系、事件履历和公共消息持续更新
- IndexedDB 本地存档；JSON 导出/导入
- `.aiworld.json` 剧本包导入入口
- PWA 静态壳与离线资源缓存
- 行动呈现模式：选择优先、丰富建议、自由行动；设置会保存并影响每回合行动入口
- 第二阶段本地行动生成：行动结算后刷新行动变体，排除最近行动；无 API 时仍可继续游玩

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

## 剧本包

剧本包是一个 JSON 对象，扩展名建议使用 `.aiworld.json`。顶层需要包含：

- `manifest`: `id`、`title`、`subtitle`、`version`、`author`、`description`、`capabilities`
- `theme`: `accent`、`accentSoft`、`accentWarm`、`ink`、`paper`、`surface`、`sky`
- `world`: `startingLocation`、`opening`、完整的 `seedState`

运行时会校验基本结构；规则层仍然负责事实和资源变化，AI 只负责解析辅助与叙事润色。

## 目录

```text
src/
  data/scripts.ts          内置剧本
  engine/actionEngine.ts   确定性行动结算
  engine/actionPlanner.ts  行动呈现模式与排序
  engine/suggestionEngine.ts 本地行动变体生成
  engine/aiProvider.ts     OpenAI-compatible 叙事适配
  storage.ts               IndexedDB 与导出下载
  store.ts                 游戏状态与剧本运行时
  App.tsx                  通用页面壳
  styles.css               原创纸张/手账视觉系统
design/                    视觉概念稿
```

## 路线

下一步优先补充：更严格的剧本 schema、角色创建、事件条件 DSL、规则 diff 展示、更多端到端测试，以及面向作者的剧本编辑器。第一阶段暂不做账号、多人、云同步、复杂战斗和既有 IP 内容。
