import type { ActionResult, GameState, RuleCondition, ScriptPackage, StateDiff, SuggestedAction } from '../types'
import { generateSuggestedActions } from './suggestionEngine'

const pad = (value: number) => value.toString().padStart(2, '0')

function advanceTime(state: GameState, minutes: number) {
  const [period, clock] = state.world.time.split(' · ')
  const [hours, mins] = clock.split(':').map(Number)
  const total = hours * 60 + mins + minutes
  const dayOffset = Math.floor(total / (24 * 60))
  const nextHours = Math.floor((total % (24 * 60)) / 60)
  const nextMinutes = total % 60
  const nextPeriod = nextHours < 6 ? '深夜' : nextHours < 11 ? '清晨' : nextHours < 14 ? '午后' : nextHours < 18 ? '傍晚' : '夜晚'
  return { day: state.world.day + dayOffset, time: `${nextPeriod} · ${pad(nextHours)}:${pad(nextMinutes)}`, previousPeriod: period }
}

function cloneState(state: GameState): GameState {
  return structuredClone(state)
}

function readPath(state: GameState, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined
    return (value as Record<string, unknown>)[key]
  }, state)
}

function conditionPasses(state: GameState, condition: RuleCondition) {
  const actual = readPath(state, condition.path)
  switch (condition.operator) {
    case 'min': return typeof actual === 'number' && typeof condition.value === 'number' && actual >= condition.value
    case 'max': return typeof actual === 'number' && typeof condition.value === 'number' && actual <= condition.value
    case 'equals': return actual === condition.value
    case 'includes': return Array.isArray(actual) && actual.includes(condition.value)
    case 'not-includes': return Array.isArray(actual) && !actual.includes(condition.value)
    default: return false
  }
}

function stateDiff(before: GameState, after: GameState): StateDiff[] {
  const diffs: StateDiff[] = []
  const values: Array<[string, string, string | number, string | number]> = [
    ['player.health', '状态', before.player.health, after.player.health],
    ['player.stamina', '精力', before.player.stamina, after.player.stamina],
    ['player.money', '铜币', before.player.money, after.player.money],
    ['player.reputation', '声望', before.player.reputation, after.player.reputation],
    ['world.time', '时间', before.world.time, after.world.time],
    ['world.location', '地点', before.world.location, after.world.location],
  ]
  values.forEach(([key, label, from, to]) => { if (from !== to) diffs.push({ key, label, before: from, after: to }) })
  before.npcs.forEach((npc) => {
    const nextNpc = after.npcs.find((item) => item.id === npc.id)
    if (nextNpc && npc.relationship !== nextNpc.relationship) diffs.push({ key: `npcs.${npc.id}.relationship`, label: `${npc.name}关系`, before: npc.relationship, after: nextNpc.relationship })
  })
  return diffs
}

function scheduleRuleEvent(next: GameState, script: ScriptPackage, ruleId: string) {
  const templateId = script.rules?.[ruleId]?.delayedEventId
  const template = templateId ? script.events?.find((event) => event.id === templateId) : undefined
  if (!template) return
  const scheduled = next.scheduledEvents ?? []
  if (scheduled.some((event) => event.id === template.id)) return
  next.scheduledEvents = [...scheduled, { ...template, dueTurn: next.turn + template.dueTurn }]
}

function processDueEvents(next: GameState) {
  const due = (next.scheduledEvents ?? []).filter((event) => event.dueTurn <= next.turn)
  next.scheduledEvents = (next.scheduledEvents ?? []).filter((event) => event.dueTurn > next.turn)
  due.forEach((event) => {
    if (event.fact) next.knownFacts = [...new Set([...next.knownFacts, event.fact])]
    if (event.npcId && event.relationshipDelta) {
      const npc = next.npcs.find((item) => item.id === event.npcId)
      if (npc) { npc.relationship += event.relationshipDelta; npc.lastInteraction = event.title }
    }
    next.world.narrative.unshift(event.body)
    next.world.currentFocus = event.title
    next.history.unshift({ id: `event-${next.turn}-${event.id}`, date: `第 ${next.world.day} 日 · ${next.world.time}`, title: event.title, body: event.body, outcome: 'success', tags: [...event.tags, '延迟事件'] })
  })
}

function advanceNpcSchedules(next: GameState) {
  if (!next.npcs.length) return
  const npc = next.npcs[next.turn % next.npcs.length]
  if (!npc.schedule?.length) return
  const status = npc.schedule[(next.turn + 1) % npc.schedule.length]
  npc.status = status
  if (next.turn % 2 === 0) {
    const note = `${npc.name}：${status}`
    next.world.publicNews = [note, ...next.world.publicNews.filter((item) => item !== note)].slice(0, 4)
    next.history.unshift({ id: `npc-${next.turn}-${npc.id}`, date: `第 ${next.world.day} 日 · ${next.world.time}`, title: `${npc.name}也在行动`, body: note, outcome: 'success', tags: ['NPC自主', npc.role] })
  }
}

function findAction(state: GameState, input: string): SuggestedAction | string | undefined {
  const normalized = input.toLowerCase()
  const exact = state.suggestedActions.find((action) => action.title.toLowerCase() === normalized)
  if (exact) return exact
  const keywords: Record<string, string[]> = {
    market: ['集市', '市场', '早市', '布料'],
    smith: ['铁匠', '奥伦', '打铁', '短工'],
    tidy: ['整理', '房间', '打扫', '收拾'],
    forest: ['雾林', '采药', '北坡', '草药'],
    dock: ['码头', '西堤', '搬运', '货船'],
    rhea: ['瑞娅', '船具', '关店'],
    tavern: ['酒馆', '喝酒', '传闻', '消息'],
    lighthouse: ['灯塔', '钥匙', '艾尔娜'],
  }
  const match = Object.entries(keywords).find(([, terms]) => terms.some((term) => normalized.includes(term)))
  return state.suggestedActions.find((action) => (action.ruleId ?? action.id) === match?.[0]) ?? match?.[0]
}

function genericOutcome(state: GameState, input: string, script: ScriptPackage): ActionResult {
  const next = cloneState(state)
  next.turn += 1
  const advanced = advanceTime(next, 25)
  next.world.day = advanced.day
  next.world.time = advanced.time
  next.player.stamina = Math.max(0, next.player.stamina - 3)
  next.world.narrative = [`你决定先观察一下周围，再处理“${input}”这件事。`, '这不是一个能立刻得到答案的行动，但你记下了几个值得继续确认的细节。']
  next.world.currentFocus = `继续确认：${input}`
  next.history.unshift({ id: `e-${next.turn}-freeform`, actionId: `freeform:${input.toLowerCase()}`, date: `第 ${next.world.day} 日 · ${next.world.time}`, title: '留下一个未完成的念头', body: `你尝试了“${input}”，目前还没有足够信息得出明确结论。`, outcome: 'unknown', tags: ['自由行动', '待确认'], stateDiff: stateDiff(state, next) })
  advanceNpcSchedules(next)
  processDueEvents(next)
  next.suggestedActions = generateSuggestedActions(next, script)
  return { outcome: 'unknown', title: '事情还没有定论', narrative: next.world.narrative, feedback: '这个行动可以开始，但现在更像是一个需要继续观察的方向。', timeLabel: '约 25 分钟', deltas: ['精力 -3', '新增一个待确认事项'], stateDiff: stateDiff(state, next), state: next }
}

export function resolveAction(state: GameState, input: string, script: ScriptPackage): ActionResult {
  const cleanInput = input.trim()
  if (!cleanInput) return { outcome: 'refused', title: '还没有行动', narrative: ['先写下你想做的事，世界才知道该如何回应。'], feedback: '请输入一个具体行动。', timeLabel: '未推进时间', deltas: [], state }

  const match = findAction(state, cleanInput)
  if (typeof match !== 'object' || !match) return genericOutcome(state, cleanInput, script)

  const next = cloneState(state)
  const actionRule = match.ruleId ?? match.id
  const rule = script.rules?.[actionRule]
  if (rule?.allowedLocations?.length && !rule.allowedLocations.some((location) => next.world.location.includes(location))) return { outcome: 'refused', title: '现在不在合适的地方', narrative: [`你看了看周围，这里不是“${match.title}”适合发生的地方。`], feedback: rule.blockedMessage ?? '先移动到合适的地点，再尝试这个行动。', timeLabel: '未推进时间', deltas: ['地点条件不满足'], state }
  const failedCondition = rule?.conditions?.find((condition) => !conditionPasses(next, condition))
  if (failedCondition) return { outcome: 'refused', title: '条件还不满足', narrative: [failedCondition.message ?? `你还缺少完成“${match.title}”的必要条件。`], feedback: rule?.blockedMessage ?? '行动没有执行，世界状态保持不变。', timeLabel: '未推进时间', deltas: ['前置条件不满足'], state }
  if (match.moneyCost > next.player.money) return { outcome: 'refused', title: '钱不够', narrative: [`你检查了一下口袋，只有 ${next.player.money} 枚铜币。`, `“${match.title}”至少需要 ${match.moneyCost} 枚铜币，今天还不能这样做。`], feedback: '当前资金不足，行动没有执行。', timeLabel: '未推进时间', deltas: [`需要 ${match.moneyCost} 枚铜币`, `当前只有 ${next.player.money} 枚`], state }
  if (match.staminaCost > next.player.stamina) return { outcome: 'refused', title: '精力不够', narrative: ['你刚站起身就感到身体还没有恢复。', `这件事需要大约 ${match.staminaCost} 点精力，而你现在只有 ${next.player.stamina} 点。`], feedback: '先休息或换一个轻松的行动会更稳妥。', timeLabel: '未推进时间', deltas: [`需要精力 ${match.staminaCost}`, `当前精力 ${next.player.stamina}`], state }

  next.turn += 1
  next.player.money -= match.moneyCost
  next.player.stamina = Math.max(0, next.player.stamina - match.staminaCost)
  const advanced = advanceTime(next, match.timeCost)
  next.world.day = advanced.day
  next.world.time = advanced.time
  const deltas = [`时间 +${match.timeCost} 分钟`, `精力 -${match.staminaCost}`]
  let outcome: ActionResult['outcome'] = 'success'
  let title = match.title
  let narrative: string[] = []

  if (actionRule === 'market') {
    next.player.reputation += 1
    next.world.location = '晨雾镇 · 晨雾集市'
    next.world.currentFocus = '集市里有人在谈论旧桥的修缮'
    narrative = ['集市比你想象中热闹。河谷来的布商正在和本地裁缝讨价还价，米拉在摊位后朝你抬了抬下巴。', '你没有急着买东西，而是在人群边缘站了一会儿。旧桥损坏的消息已经传开，几个人正在讨论南门的运货会不会受影响。']
    next.knownFacts = [...new Set([...next.knownFacts, '集市的人已经在讨论旧桥对运输的影响'])]
    deltas.push('声望 +1', '获得情报：旧桥影响运输')
  } else if (actionRule === 'smith') {
    const npc = next.npcs.find((item) => item.id === 'oren')
    if (npc) { npc.relationship += 4; npc.lastInteraction = '今天上午请你帮忙整理了一批铆钉'; npc.status = '正在等你明天来试工' }
    next.player.reputation += 2
    next.world.location = '晨雾镇 · 奥伦铁匠铺'
    next.world.currentFocus = '明天清晨去铁匠铺试工'
    narrative = ['铁匠铺里比街上暖得多。奥伦没有立刻答应你，只是把一盒混在一起的铆钉推到桌边。', '你花了一会儿把不同规格分开。他最后点了点头，说如果明天清晨你还愿意来，可以先试半天工。工资不高，但至少是一个开始。']
    next.knownFacts = [...new Set([...next.knownFacts, '奥伦愿意让你明天清晨试工'])]
    deltas.push('奥伦好感 +4', '声望 +2', '新增安排：明日清晨试工')
  } else if (actionRule === 'tidy') {
    next.player.health = Math.min(100, next.player.health + 2)
    next.world.location = '晨雾镇 · 住处'
    next.world.currentFocus = '房间变得更适合休息和工作'
    narrative = ['你把窗边的衣物叠好，又把木屑扫到门外。旧木工刀在整理后终于重新出现在桌面上。', '房间没有因此变得宽敞，但每样东西都更容易找到。你发现窗闩旁夹着一张没有署名的小纸条。']
    next.knownFacts = [...new Set([...next.knownFacts, '窗闩旁有一张没有署名的纸条'])]
    next.inventory.push('没有署名的纸条')
    deltas.push('状态恢复 +2', '获得物品：没有署名的纸条')
  } else if (actionRule === 'forest') {
    outcome = 'partial'
    next.player.health = Math.max(0, next.player.health - 3)
    next.world.location = '北境边缘 · 北坡雾林'
    next.world.currentFocus = '带回少量药草，手臂有轻微擦伤'
    narrative = ['北坡的雾比镇里浓得多。你沿着旧猎径找到了几株常见药草，却没有继续往更深处走。', '回程时手臂被一根枯枝划了一下。雾林今天不欢迎冒险，但你至少没有空手回来。']
    next.inventory.push('常见药草 ×2')
    deltas.push('获得物品：常见药草 ×2', '状态 -3', '风险兑现：轻微擦伤')
  } else if (actionRule === 'dock') {
    next.world.location = '灰潮港 · 西堤码头'
    next.world.currentFocus = '西堤有人愿意在明早给你一份短工'
    narrative = ['西堤的湿石路还没干。乔恩一边把麻袋拖进仓棚，一边用眼神示意你别靠近那艘没有旗子的旧货船。', '他没有解释太多，只说明早有一批木箱需要搬运。如果你愿意早到，可以替一个临时缺席的人顶上。']
    deltas.push('获得机会：明早西堤短工')
  } else if (actionRule === 'rhea') {
    const npc = next.npcs.find((item) => item.id === 'rhea')
    if (npc) { npc.relationship += 3; npc.lastInteraction = '今天傍晚一起关店'; }
    next.world.location = '灰潮港 · 船具店'
    next.world.currentFocus = '瑞娅愿意告诉你一些外港的消息'
    narrative = ['你留下来帮瑞娅把缆绳挂回墙上。她没有问你为什么留下，只把最重的一捆留给自己。', '关门时，她说那艘旧货船不像普通商船，船上的人似乎不想让码头工看清他们的货。']
    deltas.push('瑞娅好感 +3', '获得传闻：旧货船不寻常')
  } else if (actionRule === 'tavern') {
    next.world.location = '灰潮港 · 潮声酒馆'
    next.world.currentFocus = '酒馆里有人在谈论旧货船'
    narrative = ['潮声酒馆里挤满了晚班前来歇脚的人。你点了一杯麦酒，没有坐到最热闹的桌边。', '靠窗的水手提到，旧货船在外港绕了两圈，像是在等一个不该迟到的人。']
    deltas.push('花费 5 枚铜币', '获得传闻：旧货船在等待某人')
  } else if (actionRule === 'lighthouse') {
    outcome = 'partial'
    next.player.health = Math.max(0, next.player.health - 2)
    next.world.location = '灰潮港 · 旧灯塔'
    next.world.currentFocus = '找到灯塔钥匙的线索'
    narrative = ['你在天色彻底暗下去前赶到旧灯塔。礁石路比记忆中更滑，灯塔门前没有人。', '你没有找到钥匙，却在门缝下看见了一截被海水泡白的蓝绳。艾尔娜或许知道它意味着什么。']
    next.inventory.push('被海水泡白的蓝绳')
    deltas.push('获得物品：被海水泡白的蓝绳', '状态 -2')
  }

  next.world.narrative = narrative
  scheduleRuleEvent(next, script, actionRule)
  advanceNpcSchedules(next)
  processDueEvents(next)
  next.history.unshift({ id: `e-${next.turn}-${match.id}`, actionId: match.id, ruleId: actionRule, date: `第 ${next.world.day} 日 · ${next.world.time}`, title, body: next.world.narrative.join(' '), outcome, tags: [match.location, match.risk === '中' ? '风险' : '日常'], stateDiff: stateDiff(state, next) })
  next.suggestedActions = generateSuggestedActions(next, script)
  return { outcome, title, narrative: next.world.narrative, feedback: outcome === 'partial' ? '行动完成了一部分，也留下了新的代价或线索。' : '行动已经结算，世界留下了新的变化。', timeLabel: `约 ${match.timeCost} 分钟`, deltas, stateDiff: stateDiff(state, next), state: next }
}

export function buildInitialState(script: ScriptPackage): GameState {
  const next = cloneState(script.world.seedState)
  next.world.narrative = [...script.world.opening]
  next.suggestedActions = generateSuggestedActions(next, script)
  return next
}
