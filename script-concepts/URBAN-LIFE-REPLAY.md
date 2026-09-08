# 《霓虹城的人生》V7 规则回放样例

本文件不是运行时存档，而是将 `URBAN-LIFE-V6-FIXTURES.json` 的首轮协议展开成可供规则引擎和测试用例对照的可读回放。JSON 夹具是唯一权威输入；本文件中的快照只是同一输入的展示。所有叙事文本都可替换；action、parameter、状态边界、证据 ID 和回退入口不可由 AI 改写。

## 固定初始快照

```json
{
  "timeSlot": 0,
  "currentPlaceId": "old-bridge",
  "ageStage": "adult",
  "cash": 12,
  "health": 80,
  "energy": 70,
  "skillLevels": { "general": 0 },
  "housingStability": 35,
  "activeCommitmentType": null,
  "opportunityChainProgress": 0,
  "opportunityEvidenceIds": [],
  "trustByNpc": {},
  "commitmentLedger": [],
  "knownPlaceIds": ["old-bridge-square"],
  "metNpcIds": [],
  "openRequestId": null,
  "milestoneFlags": {},
  "recentActionIds": [],
  "memoryPacket": { "version": 1, "summary": "" }
}
```

## 三条正常路径

每条路径都按 1～10 顺序推进；`review-ledger`、`old-bridge-course` 是已登记的本地 action ID，`campus`、`community-circle` 是 `advance-chain` 的已登记参数。

| 步骤 | 稳定生活 | 建立专业 | 互助网络 |
| ---: | --- | --- | --- |
| 1 | `observe-neighborhood` | `observe-neighborhood` | `observe-neighborhood` |
| 2 | `meet-community-worker` | `meet-community-worker` | `meet-community-worker` |
| 3 | `choose-commitment:stable` | `choose-commitment:professional` | `choose-commitment:network` |
| 4 | `accept-opportunity`：现金 -5，居住稳定 +15 | `accept-opportunity`：现金 -3，通用技能 +1 | `accept-opportunity`：精力 -1，关系链 +1 |
| 5 | `fulfil-or-delay`：兑现，居住稳定 +10，生成 `request-lin-followup` | `fulfil-or-delay`：兑现，信任 +8，生成 `request-lin-followup` | `fulfil-or-delay`：兑现，信任 +8，生成 `request-lin-followup` |
| 6 | `recover-or-review`：状态正常，进入复盘分支 | `recover-or-review`：状态正常，进入复盘分支 | `recover-or-review`：状态正常，进入复盘分支 |
| 7 | `advance-chain:old-bridge-course` | `advance-chain:campus`：现金 -5 | `advance-chain:community-circle` |
| 8 | `deepen-path`：居住稳定 +10 | `deepen-path`：通用技能 +2 | `deepen-path`：信任 +3 |
| 9 | `answer-request:help`：信任 +12，精力 -8 | `answer-request:negotiate`：信任 +2，现金 -2 | `answer-request:help`：信任 +12，精力 -8 |
| 10 | `weekly-review` → `milestone.stable.v1` | `weekly-review` → `milestone.professional.v1` | `weekly-review` → `milestone.network.v1` |

预期终态证据：稳定路径 `housingStability=70`；专业路径 `skillLevels.general=3`；关系路径 `trustByNpc.npc-lin=63`。三条路径都必须保留 10 条 `recentActionIds`、一个 `milestoneFlags` 证据对象和下一周的 3 个候选入口。

## 两条条件失败路径

| 触发点 | 输入状态 | 拒绝码/结果 | 回退入口 | 不允许发生的事 |
| --- | --- | --- | --- | --- |
| 第 4 步现金不足 | `cash=2`，选择稳定承诺 | `ECON_INSUFFICIENT`；现金、承诺和时间不变 | `recover-or-review:cash` → `cash-recovery`（现金 +3）或 `commitment-reselect` | 不得出现负现金或 AI 擅自发钱 |
| 第 9 步请求撤回 | 已登记 `answer-request:*`，业务检查时 `openRequestId=null` | `REQUEST_CLOSED`；不推进时间、不扣资源，只写无损履历 | `review-ledger` → `weekly-review` | 不得虚构帮助、信任变化或陌生人物 |

## 离线模板夹具

每个步骤固定 3 个模板，共 30 个，具体夹具矩阵如下：

| 步骤 | 模板 ID | 需要的标记 | 状态预览 | 回退 |
| ---: | --- | --- | --- | --- |
| 1 | `urban.s01.a/b/c` | `old-bridge` | 写入 3 个地点 | `local-notice` |
| 2 | `urban.s02.a/b/c` | `community-center` | 激活 `npc-lin` | `observe-neighborhood` |
| 3 | `urban.s03.a/b/c` | `no-active-commitment` | 建立承诺 | `commitment-reselect` |
| 4 | `urban.s04.a/b/c` | `active-commitment` | 链进度/资源变化 | `recover-or-review` |
| 5 | `urban.s05.a/b/c` | `active-commitment` | 承诺状态/请求 ID | `review-ledger` |
| 6 | `urban.s06.a/b/c` | `always` | 恢复或复盘 | `recover-or-review` |
| 7 | `urban.s07.a/b/c` | `chain-progress>=1` | 地点/链证据 | `old-bridge-course` |
| 8 | `urban.s08.a/b/c` | `chain-progress>=1` | 技能/房屋/信任变化 | `recover-or-review` |
| 9 | `urban.s09.a/b/c` | `openRequestId` 或撤回校验 | 关系变化或无损失败 | `review-ledger` |
| 10 | `urban.s10.a/b/c` | `commitment-resolved` | 里程碑证据 | `commitment-reselect` |

每个模板必须包含，并且 `actionId`、`parameter`、`fallbackActionId` 必须能在 JSON `actionRegistry` 中解析：

```text
id
actionId
parameter
allowedAgeStages
requiredFlags
narrative
stateDiffPreview
fallbackActionId
version
```

选择键为 `ruleId + recentActionIds + timeSlot`。模板重复时选择下一个变体；三种变体全部使用过时仍使用同一规则结果的简短模板，不生成新事实。AI 超时、额度不足、非 JSON 或校验失败时只替换 `narrative`，保留 `actionId`、规则状态、证据 ID 和回退入口。

## 验收记录格式

运行时验收需要逐步保存：`step`、`actionId`、`templateId`、`beforeHash`、`afterHash`、`stateDiff`、`rejectionCode`、`nextActionIds`。三条正常路径和两条失败路径都通过后，才允许把 urban 标记为首发候选；本文件本身不等同于测试已通过。
