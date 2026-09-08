# 《霓虹城的人生》

## 基础信息

- **剧本 ID**：`urban-life`
- **类型**：现代都市人生 / 社会关系 / 职业成长
- **时代**：近未来十年内的当代大城市
- **内容重点**：学习、工作、租住、家庭、友情、恋爱、职业转型和城市生活压力
- **基调**：真实、克制、有希望，但不回避经济压力和关系变化
- **核心问题**：一个普通人如何在一座机会很多、成本也很高的城市里建立自己的生活

## 世界观

临江市是一座沿江发展的现代都市，拥有老城区、大学城、金融新区、工业带和近郊卫星城。城市没有固定主线，机会来自招聘、课程、熟人介绍、公共事件和日常选择。

这里的“超凡”不是真正的魔法，而是信息差、技能积累、社会信用和人与人之间的信任。玩家的选择会影响可获得的工作、居住条件、关系网络和生活节奏。

## 起始地区

1. **旧桥里**：租金较低，生活设施齐全，邻里关系密集。
2. **青禾大学城**：教育资源丰富，学生、教师和创业者较多。
3. **南岸新城**：工作机会集中，但通勤和生活成本较高。
4. **北郊新站**：城市边缘，房租较低，适合重新开始或发展小生意。

## 可选身份与职业方向

- 初始身份：本地居民、外地求职者、大学生、转行者、自由职业者、家庭照料者
- 早期职业：店员、行政助理、维修学徒、外卖骑手、实习生、社区工作人员、内容编辑
- 中后期方向：专业技术、教育培训、小店经营、企业管理、公共服务、创意工作

职业不是固定剧情路线。玩家可以通过学习、工作经历、推荐和经济投入逐步解锁新的职业方向。

## 核心人物

- **林晚晴**：旧桥里社区工作者，熟悉社区资源，重视守信。
- **周砚**：共享工作空间管理员，认识许多创业者和自由职业者。
- **许澄**：青禾大学城的课程顾问，擅长把人介绍给合适的学习机会。
- **韩渡**：南岸新城的招聘顾问，效率很高，但不轻易替人担保。
- **沈阿姨**：旧桥里房东，观察细致，愿意帮助认真生活的人。
- **顾野**：北郊新站的小店老板，提供零散工作，也可能成为合作伙伴。

## 核心系统

- 时间：工作日、周末、通勤和休息会影响可执行行动。
- 资源：现金、健康、精力、技能和居住稳定度；机会链进度和 NPC 信任由规则层派生。
- 关系：家人、同事、邻居、朋友和合作伙伴分别发展。
- 城市信息：招聘、课程、租房、公共服务和社区消息逐步解锁。
- 生活压力：收入、房租、身体状态和关系维护需要平衡。

## 目标玩家与核心承诺

- **目标玩家**：喜欢文字人生模拟、职业成长、关系经营和低压力长期养成的移动端与桌面玩家。
- **核心承诺**：玩家不是被推着完成主线，而是在有限时间、收入和精力中，逐渐把普通生活过成自己的样子。

## V3 改本重点：城市机会链与承诺账本

本版的核心机制不是泛化的“都市生活”，而是**城市会记住你兑现过什么承诺，并把新的机会沿着可信关系递给你**。玩家的每次重要行动都归入三条机会链：稳定、能力、关系；同时形成一份可追踪的承诺账本。

- 首轮只开放旧桥里和青禾大学城，前 10 次行动只围绕一个短期目标：在不透支健康的情况下稳定住处并获得下一份可靠机会。
- 每次关键行动只产生一条清晰的机会变化：兑现承诺提升推荐权重，拖延承诺增加关系成本，拒绝机会保留资源但关闭一条短期路径。规则引擎计算结果，AI 只负责呈现人物语气和具体场景。
- 首轮只激活 3 名已遇人物；其他人物必须经过介绍、共同事件或公开场所实际相遇后才进入关系模块。
- 长期目标分为“稳定生活、建立专业、形成互助网络”三种结局倾向，不要求玩家追求单一财富数值。
- 中期才开放南岸新城和北郊新站；地图扩张必须由搬家、工作推荐或公共事件触发，AI 不得任意增加城区。

V3 解决上一轮“题材熟悉、行动像工作—学习—社交排列”的问题：玩家经营的是一张会反馈的城市信用网络，而不是单纯刷数值。首发仍限制为两区、三链、三人和 10 次行动，保证可以做垂直测试。

## V4 合格版首发协议：十次行动可复现切片

首发验证默认采用“成年转行者、旧桥里出生、无 API 也可完成”的基线；其他年龄阶段使用同一状态协议，但替换为年龄白名单行动。婴儿/儿童阶段不得出现工作、租房、独立签约等行动。

| 次数 | 允许入口 | 前置与成本 | 规则结算/解锁 | AI 只生成 |
| ---: | --- | --- | --- | --- |
| 1 | 观察生活圈 | 当前地点；消耗 1 时段 | 记录 3 个已知地点，不新增人物 | 街区细节与公共消息 |
| 2 | 认识社区工作者 | 地点已知；消耗 1 精力 | `npc-lin` 进入已遇关系，建立第一条可选承诺 | 初次对话语气 |
| 3 | 选择一条承诺 | 现金/健康达到最低条件 | 写入承诺账本：稳定、能力或关系之一 | 承诺的具体措辞 |
| 4 | 接受小机会 | 对应机会链已开启；消耗 1 时段 | 现金、技能或信任发生确定变化 | 工作/课程/互助场景 |
| 5 | 兑现或延期 | 存在未完成承诺；消耗 1 时段 | 兑现提高推荐权重，延期增加关系成本 | NPC 的反应与短叙事 |
| 6 | 恢复状态 | 精力或健康低于安全线；消耗 1 时段 | 恢复精力/健康，不增加机会进度 | 休息、饮食或家庭片段 |
| 7 | 进入第二地点 | 青禾大学城需由课程/推荐解锁；消耗现金与时间 | 新地点进入已知地图，未遇人物保持隐藏 | 通勤和地点氛围 |
| 8 | 学习或工作深化 | 对应链进度达到 1；消耗 1 时段 | 技能或现金增加，失败保留可恢复路径 | 课堂、工作反馈 |
| 9 | 处理关系选择 | 已遇 NPC；存在承诺或请求 | 三选一：帮助、协商、拒绝；写入关系事件 | 对话分支文案 |
| 10 | 周期复盘 | 完成至少 1 条承诺或经历一次可解释失败 | 生成稳定生活/建立专业/互助网络之一的里程碑；开放下一周目标 | 复盘总结与下一周提示 |

### V4 最小状态字典

| 字段 | 类型 | 权威来源 | AI 可读 | AI 可写 |
| --- | --- | --- | --- | --- |
| `cash`、`health`、`energy` | 数值 | 规则引擎 | 是 | 否 |
| `skills` | 有上限的技能对象 | 规则引擎 | 是 | 否 |
| `housingStability` | 0～100 数值 | 规则引擎 | 是 | 否 |
| `trustByNpc` | NPC ID → 信任值 | 规则引擎 | 是 | 否 |
| `commitmentLedger` | 承诺 ID、类型、期限、状态、成本、来源 | 规则引擎 | 是 | 否 |
| `metNpcIds`、`knownPlaceIds` | 白名单 ID 数组 | 规则引擎 | 是 | 否 |
| `opportunityChainProgress` | 三条机会链的派生进度 | 规则引擎 | 是 | 否 |
| `recentHistory`、`memoryPacket` | 有上限履历/摘要 | 规则引擎 | 是 | 否 |

AI 请求只能返回叙事、对话和已登记候选行动；`cash`、健康、信任、承诺状态、人物相遇和地图解锁只能由规则层依据 `actionId` 结算。

### V4 长期里程碑与离线协议

- **稳定生活**：`housingStability >= 60` 且完成 2 条稳定类承诺；玩家可见证据为稳定住处和下一周固定行动入口。
- **建立专业**：任一技能达到 3 且完成 2 条能力类承诺；玩家可见证据为新的已登记职业入口。
- **形成互助网络**：3 名已遇人物中至少 2 人信任达到阈值，且完成 1 条关系类承诺；玩家可见证据为可互相转介的 NPC 入口。
- 无 API 时每种行动类型至少准备 3 个本地变体，合计覆盖 10 次行动；变体使用 `ruleId + recentActionIds` 去重，失败后仍提供下一条可行入口。
- AI 超时只跳过叙事，保留规则结算、状态 diff、承诺状态和解锁提示；不得因为模型失败阻塞人生推进。

### V4 治理与发布检查

- 年龄、地点、职业和 NPC 必须有白名单 ID；未相遇人物不进入关系模块。
- 失业、贫困、健康、家庭冲突和恋爱内容分级；AI 不生成诊断、法律结论或强迫性关系结果。
- 每个城市地点、职业、人物和事件都要有来源 ID、解锁条件、生成次数上限和审计记录。
- 发布前必须完成重复文本检测、敏感内容抽检、无 API 十次行动回归和三种承诺路径的状态快照对比。

## V6 合格候选：规则回放与离线可达性

V5 将承诺账本从文案概念改为可回放协议。下面的表是 V4 表的规范化版本；每一行都必须由本地规则引擎执行，即使 AI 不可用也不能阻塞。

| 步骤 | 允许入口 | 前置条件 | 成本 | 规则结果 | AI 槽位 / 失败回退 |
| ---: | --- | --- | --- | --- | --- |
| 1 | `observe-neighborhood` | `currentPlaceId=old-bridge` | `time+1` | 写入 3 个已知地点 | 街区描述；失败回退 `local-notice` |
| 2 | `meet-community-worker` | 已知 `community-center` 且 `metNpcIds` 不含 `npc-lin` | `energy-1` | 激活 `npc-lin`，初始信任 `40`，创建 `commitment-intro` | 初遇对话；失败回退观察公告 |
| 3 | `choose-commitment` | `commitmentLedger` 无 active 项 | `time+1` | 建立 `stable/professional/network` 之一，期限为第 6 步前 | 承诺措辞；失败回退 `rest` |
| 4 | `accept-opportunity` | 有 active 承诺且 `health>=20` | 稳定 `cash-5,energy-1`；能力 `cash-3,energy-1`；关系 `energy-1` | 稳定 `housingStability+15`；能力 `skillLevels.general+1`；关系 `opportunityChainProgress.network+1`；均写入来源 ID | 机会场景；不足时转 `recover-or-review`，不扣资源 |
| 5 | `fulfil-or-delay` | 有 active 承诺 | `time+1` | 兑现：普通 `trust+8`、稳定另加 `housingStability+10`、写入 `openRequestId`；延期：`trust-3`、期限顺延 1、同样写入回访请求 | NPC 反应；失败回退承诺状态说明 |
| 6 | `recover-or-review` | 无条件可选；按最低资源进入对应分支 | 低状态 `time+1`；现金不足另 `energy-1` | 低健康/精力：`energy+20,health+5`；`cash<5`：执行 `cash-recovery`，`cash+3`；状态正常：只推进时段并显示复盘 | 休息/微型机会/复盘；永不失败 |
| 7 | `advance-chain` | `professional` 链≥1 且 `cash>=5`，或 `stable/network` 链≥1 | 专业：`cash-5,time+1`；其他：`time+1` | 专业加入 `campus`；其他保持旧桥里并增加链证据 | 通勤/社区场景；条件不足使用 `old-bridge-course` |
| 8 | `deepen-path` | 已有 `campus` 或稳定/关系链进度≥1 | `time+1,energy-1` | 能力：`skillLevels.general+2` 或 `cash+8`；稳定：`housingStability+10`；关系：`trust+3`，二选一 | 工作/课程反馈；失败回退 `recover-or-review` |
| 9 | `answer-request` | `openRequestId` 存在且至少已遇 1 人 | `time+1` | 帮助：`trust+12,energy-8`；协商：`trust+2,cash-2`；拒绝：保留资源但关闭当前短期机会 | 对话分支；请求缺失时回退 `review-ledger` |
| 10 | `weekly-review` | 已完成/延期/拒绝至少 1 条承诺 | `time+1` | 写入一个里程碑快照，生成下一周 3 个入口 | 复盘文本；失败仍生成本地复盘 |

### V6 权威状态字典

首轮只允许以下字段参与规则读写；任何未列字段都属于首轮禁用字段。

| 字段 | 类型/边界 | 权威写入者 | AI 权限 | 首轮用途 |
| --- | --- | --- | --- | --- |
| `timeSlot` | `0..10` | 规则 | 只读 | 行动顺序 |
| `currentPlaceId` | 白名单 ID | 规则 | 只读 | 地点约束 |
| `ageStage` | 年龄枚举 | 规则 | 只读 | 年龄行动 |
| `cash/health/energy` | `cash>=0`，其余 `0..100` | 规则 | 只读 | 成本与恢复 |
| `skillLevels` | 已登记技能 `0..3` | 规则 | 只读 | 第 8 步成长 |
| `housingStability` | `0..100` | 规则 | 只读 | 稳定里程碑 |
| `trustByNpc` | 已遇 NPC ID → `-20..100` | 规则 | 只读 | 关系里程碑 |
| `commitmentLedger` | `{id,type,status,deadline,cost,sourceActionId}`，`status=active/fulfilled/delayed/declined` | 规则 | 只读 | 三条机会链 |
| `opportunityChainProgress` | 三链各 `0..3` 的派生值 | 规则 | 只读 | 解锁条件 |
| `knownPlaceIds/metNpcIds` | 白名单 ID 数组 | 规则 | 只读 | 地图/人物可见性 |
| `milestoneFlags` | 三种里程碑布尔/证据 ID | 规则 | 只读 | 长期目标 |
| `recentActionIds` | 最近 8 个规则行动 | 规则 | 只读 | 去重与回退 |
| `openRequestId` | 已登记请求 ID 或 `null` | 规则 | 只读 | 第 9 步入口 |
| `candidateActionIds` | 当前白名单候选 ID 数组 | 规则 | 只读 | AI 候选校验 |
| `memoryPacket` | 固定事实/待办/最近履历摘要，有长度上限 | 规则 | 只读 | AI 上下文 |

AI 只能返回 `narrative`、`dialogue` 和当前 `candidateActionIds` 中的 `candidateActionId`；返回未知 ID、数值、地点、人物、承诺状态、枚举越界或非法证据时统一拒绝，错误码为 `AI_UNKNOWN_ID`、`AI_STATE_WRITE`、`AI_ENUM_INVALID`、`AI_EVIDENCE_UNKNOWN`、`AI_AGE_BLOCKED`、`AI_PLACE_BLOCKED`。

### V6 里程碑状态机与重开差异

每条人生在 `start` 进入 `commitment_open`；第 5 步后进入 `commitment_resolved`（兑现、延期或拒绝三态之一）；第 10 步进入 `weekly_milestone`。状态转移固定为：

| 当前状态 | 触发 action/条件 | 输出证据 | 下一状态 | 失败替代 |
| --- | --- | --- | --- | --- |
| `commitment_open` | `fulfil-or-delay` | `commitment.fulfilled/delayed/declined` | `commitment_resolved` | `commitment_reselect` |
| `commitment_resolved` | 稳定承诺 fulfilled 且 `housingStability>=60` | `milestone.stable.v1` | `stable_life` | `stable-recovery-offer` |
| `commitment_resolved` | 能力承诺 fulfilled 且 `skillLevels.general>=3` | `milestone.professional.v1` | `professional_path` | `professional-recovery-offer` |
| `commitment_resolved` | 关系承诺 fulfilled 且 `trustByNpc[npc-lin]>=60` | `milestone.network.v1` | `mutual_network` | `network-recovery-offer` |
| `commitment_resolved` | 以上条件均未满足，第 10 步 | `milestone.weekly.review` | `weekly_milestone` | `commitment_reselect` |

任一里程碑失败都不结束人生：补救承诺有固定 ID、`deadline=nextWeek`、最多重试 2 次；超过次数后保留履历并开放另一条链。这样“失败替代”也是可回放状态，而不是一句叙事。

重开时，玩家可以改变年龄阶段、出生地、身份和第一条承诺；因此第 3～10 步的可达入口、初始成本和可见人物会真实不同，而不是只重置数字。

### V6 离线矩阵与商业扩展边界

- 步骤 1～10 各准备 3 个本地行动/叙事变体，共 30 个最小模板；使用 `ruleId + recentActionIds + timeSlot` 去重。
- 每个步骤有一个永不失败的回退入口：观察、休息、复盘或重新选择承诺；因此成年基线在无 API 下必定完成十步。
- AI 超时、额度不足或格式错误只替换为本地模板，保留同一个 `actionId`、状态 diff、里程碑证据和下一步入口。
- 后续内容包只允许增加已登记的地区、职业、NPC 和承诺类型，不能扩展首轮权威字段；付费内容不得锁定基础人生进度。
- 发布前必须自动回放三条承诺路径、两种条件失败路径和无 API 全十步路径，并保存状态快照、拒绝码和模板版本。

### V7 确定性回放样例

本剧本不再在正文复制初始快照。唯一权威输入是 [`URBAN-LIFE-V6-FIXTURES.json`](./URBAN-LIFE-V6-FIXTURES.json) 的 `initialState`、`actionRegistry`、`ageProfiles` 和 `templates`；[`URBAN-LIFE-REPLAY.md`](./URBAN-LIFE-REPLAY.md) 只负责把同一夹具展开成可读的回放说明。三条首轮路径使用同一套规则，只替换第 3 步的承诺类型：

| 路径 | 第 3 步 | 第 4～10 步 actionId | 第 10 步证据 |
| --- | --- | --- | --- |
| 稳定 | `commitment:stable` | `accept-opportunity → fulfil-or-delay → recover-or-review → advance-chain:old-bridge-course → deepen-path → answer-request → weekly-review` | `housingStability>=60` 或 `stable-recovery-offer` |
| 能力 | `commitment:professional` | `accept-opportunity → fulfil-or-delay → recover-or-review → advance-chain:campus → deepen-path → answer-request → weekly-review` | `skillLevels.general>=3` 或 `professional-recovery-offer` |
| 关系 | `commitment:network` | `accept-opportunity → fulfil-or-delay → recover-or-review → advance-chain:community-circle → deepen-path → answer-request → weekly-review` | `trustByNpc[npc-lin]>=60` 或 `network-recovery-offer` |

两个条件失败回放固定为：

- 第 4 步现金不足：返回 `ECON_INSUFFICIENT`，不写资源，进入 `recover-or-review:cash` → `cash-recovery`（`time+1,energy-1,cash+3`）；若仍不足则执行 `commitment-reselect`，关闭旧承诺并重新选择不需要现金的关系承诺。
- 第 9 步请求被撤回：玩家提交的 `answer-request:*` 先通过 action ID 校验，再由业务层发现 `openRequestId=null`，返回 `REQUEST_CLOSED`，状态不变并写入无损履历，进入 `review-ledger` → 第 10 步；这不是前置缺失，而是可测试的业务失败。

离线模板 ID 固定为 `urban.s01.a/b/c` 至 `urban.s10.a/b/c`，每个模板包含 `id、actionId、parameter、allowedAgeStages、requiredFlags、narrative、stateDiffPreview、fallbackActionId、version`；`actionId`、`parameter`、回退 ID 和 required flags 必须能在同一 JSON 夹具的注册表中解析。运行前必须由 schema 校验，回放日志记录 `step、actionId、parameter、templateId、beforeHash、afterHash、nextActionIds`。

## 首轮可玩循环与状态引用

V7 JSON 夹具和“规则回放与离线可达性”表共同构成本剧本首轮的唯一规范；本节不再另定义一套行动和字段。运行时只读取夹具中的权威状态字典，叙事上下文由以下有界数据组成：当前 `timeSlot`、`currentPlaceId`、`ageStage`、上述权威状态的只读快照、最近 8 个 `recentActionIds`、最多 8 条履历和 `memoryPacket`。

AI 槽位仅包括短对话、招聘/课程/互助文案、地点氛围和复盘文本；AI 不能新增城市制度、城区、职业资格、资源数值、人物相遇、承诺状态或里程碑证据。

## V6 玩家可见反馈契约

首轮 UI 必须固定展示四个反馈面板，而不是把核心机制藏在履历文本里：

1. **承诺账本卡**：显示当前承诺类型、状态、期限、已付成本和下一步入口。
2. **机会链卡**：显示稳定/能力/关系三条链的当前进度，以及本次行动影响哪一条。
3. **状态差异卡**：显示 `before → after` 的现金、健康、精力、信任、地图和里程碑变化。
4. **恢复/回退卡**：任何拒绝码都必须同时给出原因、保持不变的字段和至少一个可执行回退 action。

完成第 5 步后，玩家必须能在页面中看到 `fulfilled/delayed/declined` 之一和 `openRequestId` 对应的入口；完成第 10 步后，必须能看到 `milestone.*.v1` 证据和下一周候选。主题切换只改变视觉，不隐藏这些语义。

## 留存与重玩钩子

出生/开始年龄、起始地区、家庭条件、职业路线、关系选择和城市迁移组合形成不同人生；同一角色也会因经济周期、课程机会和关系事件产生不同结果。

## 风险与原型验证问题

- **风险**：现代生活文本容易同质化，职业与关系事件可能重复，现实议题需要内容分级。
- **控制**：按地区、年龄和职业限制生成池；事件设置冷却与去重键；敏感内容走分级和拒绝规则。
- **验证**：玩家是否在首轮完成至少 5 次不同类型行动？是否愿意为了另一种职业/出生地重开？

## AI 生成边界

AI 可以生成临江市内部的日常事件、对话、招聘信息、课程介绍和人物互动，但不能把城市变成修仙、魔法或末日世界，不能凭空增加新的城区制度或直接改变收入、健康、信用等状态。所有职业、地点和关系变化必须映射到已有规则。

## 第一批内容槽位

- 每个地区 3 个可探索地点
- 每个核心人物 2 个关系阶段
- 每个年龄阶段 3 个生活行动
- 低频事件：搬家、面试、邻里求助、突发加班、课程机会、家庭消息
- 开场变量：从婴儿、学生、求职者或转行成年人开始
