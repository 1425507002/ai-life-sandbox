import type { GameState, ScriptPackage, SuggestedAction } from '../types'
import { ageActionsForState, isAgeAllowed } from './ageRules'

interface ActionCopy {
  title: string
  description: string
}

const FALLBACK_VARIANTS: ActionCopy[] = [
  { title: '先观察周围', description: '先不急着做决定，观察眼下环境里有没有值得注意的细节。' },
  { title: '先做一点准备', description: '先把这件事需要的准备做妥，再决定要不要继续深入。' },
  { title: '换条路径试试', description: '不重复刚才的做法，换一种更稳妥的方式接近这件事。' },
  { title: '从小处开始', description: '先完成一个较小的步骤，让这件事慢慢显出方向。' },
  { title: '留意一个细节', description: '把注意力放在容易被忽略的细节上，也许会得到新的线索。' },
  { title: '找人问问', description: '先和熟悉这里的人聊几句，再决定下一步怎么做。' },
]

const LOCAL_VARIANTS: Record<string, ActionCopy[]> = {
  'baby-care': [
    { title: '接受照料', description: '让照料者安排喂食、擦洗和安抚，先把身体照顾好。' },
    { title: '让熟悉的人抱一会儿', description: '在熟悉的声音和气味里安稳下来。' },
  ],
  'baby-observe': [
    { title: '观察熟悉的声音', description: '在安全的住处听一听、看一看，把一个细节留在记忆里。' },
    { title: '看窗边的光影', description: '从身边的小变化开始认识这个世界。' },
  ],
  'baby-rest': [
    { title: '安稳睡一觉', description: '在照料下休息，让身体和精力慢慢恢复。' },
    { title: '在温暖里休息', description: '把今天剩下的力气交给睡眠和照料。' },
  ],
  'child-play': [{ title: '在住处附近玩耍', description: '只在熟悉又安全的地方玩一会儿，记住附近的路。' }],
  'child-learn': [{ title: '学习基础知识', description: '跟着照料者认字、认路或认识生活中常见的东西。' }],
  'child-help': [{ title: '帮家里做一点小事', description: '完成自己拿得动、做得到的整理和递送。' }],
  'teen-study': [{ title: '整理学习方向', description: '花时间比较学习、手艺和未来工作需要的准备。' }],
  'teen-apprentice': [{ title: '打听学徒机会', description: '在生活圈附近询问是否有人愿意教你一门手艺。' }],
  'teen-explore': [{ title: '探索生活圈边缘', description: '只沿安全路线走一段，不进入当前年龄不适合的危险区域。' }],
  'elder-rest': [{ title: '放慢节奏休息', description: '照顾身体，把今天的安排调整得更从容。' }],
  'elder-teach': [{ title: '传授一段经验', description: '把自己熟悉的经验讲给愿意倾听的人。' }],
  'elder-walk': [{ title: '沿熟悉街道散步', description: '沿着熟悉的路线走一圈，看看环境有什么变化。' }],
  market: [
    { title: '去集市问问旧桥', description: '找熟悉的摊贩聊聊旧桥修缮，看看运输会不会受影响。' },
    { title: '在布商摊位看看', description: '从河谷布商那里听听路上的消息，再决定要不要买些材料。' },
    { title: '帮米拉送一趟货', description: '替米拉把面包送到南门，顺路观察镇上的人都在谈什么。' },
  ],
  smith: [
    { title: '去铁匠铺帮一会儿', description: '先从整理铆钉和清理炉灰开始，看看奥伦是否愿意教你。' },
    { title: '向奥伦打听短工', description: '带着木匠学徒的身份去问问，别急着承诺自己做不到的事。' },
    { title: '替铁匠铺送工具', description: '把修好的小工具送到南门工地，顺便认识正在修桥的人。' },
  ],
  tidy: [
    { title: '整理工具和窗边', description: '把常用工具放回顺手的位置，也看看窗边有没有遗漏的东西。' },
    { title: '检查窗闩和纸条', description: '重新检查昨晚修好的窗闩，确认那张无名纸条有没有留下线索。' },
    { title: '清点家里的余粮', description: '把燕麦、木料和零钱清点一遍，知道自己还能安稳生活多久。' },
  ],
  forest: [
    { title: '沿北坡边缘采药', description: '不深入雾林，只沿熟悉的边缘找几株常见药草。' },
    { title: '在雾林口找旧猎径', description: '从林口确认旧猎径是否还在，先记住路况再决定要不要深入。' },
    { title: '替塞拉辨认药草', description: '带着问题去找塞拉，请她教你分辨最近容易混淆的药草。' },
  ],
  dock: [
    { title: '去西堤问问乔恩', description: '去码头找乔恩聊聊短工，也留意那艘没有挂旗的旧货船。' },
    { title: '沿西堤看货船', description: '沿着湿石路走一圈，确认陌生货船今天有没有新的动静。' },
    { title: '替仓棚清点木箱', description: '找一份短时的搬运活，顺便看看仓库里最近进出哪些货物。' },
  ],
  rhea: [
    { title: '帮瑞娅整理缆绳', description: '留下来把船具归位，顺便问问她对外港货船的看法。' },
    { title: '关店前问船讯', description: '在关门前请瑞娅讲讲最近的船期，别错过她愿意分享的细节。' },
    { title: '替船具店记一笔账', description: '帮瑞娅核对一小段账目，看看陌生货船有没有留下异常订单。' },
  ],
  tavern: [
    { title: '去酒馆找熟人', description: '点一杯便宜的麦酒，看看有没有认识的水手愿意聊两句。' },
    { title: '在窗边听传闻', description: '坐在不显眼的位置，听听港口今晚正在流传什么消息。' },
    { title: '问问旧货船的来路', description: '用一杯麦酒换一个问题，试着确认陌生货船从哪里来。' },
  ],
  lighthouse: [
    { title: '绕灯塔后侧找钥匙', description: '趁天色还亮，沿灯塔背面的礁石边找找有没有遗落的钥匙。' },
    { title: '去礁石边辨认蓝绳', description: '带着耐心检查灯塔门边的痕迹，确认那截蓝绳是不是人为留下的。' },
    { title: '替艾尔娜送一盏灯油', description: '先帮管理员解决眼前的小事，再问问她最近有没有见过陌生船员。' },
  ],
}

function copyFor(action: SuggestedAction, variantIndex: number): ActionCopy {
  const variants = LOCAL_VARIANTS[action.ruleId ?? action.id] ?? FALLBACK_VARIANTS.map((variant) => ({
    title: `${action.title} · ${variant.title}`,
    description: `${variant.description} 原本的方向是：${action.description}`,
  }))
  return variants[variantIndex % variants.length]
}

export function generateSuggestedActions(state: GameState, script: ScriptPackage): SuggestedAction[] {
  const mapSeed = script.maps?.find((map) => map.id === state.world.mapId)?.seedState
  const sourceState = mapSeed ?? script.world.seedState
  const ageActions = ageActionsForState(script, state)
  const source = [...new Map([...ageActions, ...sourceState.suggestedActions].map((action) => [action.ruleId ?? action.id, action])).values()]
    .filter((action) => {
      const rule = script.rules?.[action.ruleId ?? action.id]
      return isAgeAllowed(rule, state, script) && (!rule?.allowedMapIds?.length || !state.world.mapId || rule.allowedMapIds.includes(state.world.mapId))
    })
  if (!source.length) return []
  const latestAction = state.history.find((event) => event.ruleId || (event.actionId && !event.actionId.startsWith('freeform:')))
  const latestRuleId = latestAction?.ruleId ?? latestAction?.actionId
  const recentTitles = new Set(state.history.slice(0, 12).map((event) => event.title.trim()).filter(Boolean))
  const generatedTitles = new Set<string>()
  const generated = source.map((action, index) => {
    const ruleId = action.ruleId ?? action.id
    let variantIndex = Math.max(0, state.turn - 1 + index)
    let copy = copyFor({ ...action, ruleId }, variantIndex)
    while ((recentTitles.has(copy.title) || generatedTitles.has(copy.title)) && variantIndex < state.turn + 24) {
      variantIndex += 1
      copy = copyFor({ ...action, ruleId }, variantIndex)
    }
    generatedTitles.add(copy.title)
    return { ...action, id: `${script.manifest.id}:${ruleId}:${variantIndex}`, ruleId, title: copy.title, description: copy.description }
  })
  const fresh = generated.filter((action) => action.ruleId !== latestRuleId && !recentTitles.has(action.title))
  if (fresh.length >= Math.min(3, generated.length)) return fresh
  const fallback = generated.filter((action) => action.ruleId !== latestRuleId)
  return fallback.length ? fallback : generated
}
