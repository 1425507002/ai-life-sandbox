import type { MapDefinition, MapDiscoveryPolicy, ScriptPackage, SuggestedAction } from '../types'

const discoveryPolicy: MapDiscoveryPolicy = {
  initialKnownLocation: 'startingLocation',
  allowedSources: ['birth', 'exploration', 'npc', 'rumor', 'event'],
  maxNewLocationsPerAction: 1,
  requireExplicitDiscovery: true,
  aiMustNotCreateLocation: true,
}

const actions = {
  observe: { id: 'urban-observe', ruleId: 'urban-observe', title: '观察旧桥街区', description: '从眼前熟悉的街道开始，记住公共空间、公告和可以求助的人。', location: '旧桥街区', timeCost: 30, moneyCost: 0, staminaCost: 2, risk: '低', tone: 'sage' as const },
  notice: { id: 'urban-notice', ruleId: 'urban-notice', title: '看看社区公告', description: '先确认今天有没有适合当前年龄和状态的消息，不急着答应任何事情。', location: '旧桥街区', timeCost: 15, moneyCost: 0, staminaCost: 1, risk: '几乎没有', tone: 'sky' as const },
  meet: { id: 'urban-meet', ruleId: 'urban-meet', title: '去社区中心认识林晚晴', description: '在已经知道社区中心之后，和负责社区事务的人第一次正式打照面。', location: '社区中心', timeCost: 35, moneyCost: 0, staminaCost: 3, risk: '低', tone: 'gold' as const },
  choose: { id: 'urban-choose', ruleId: 'urban-choose', title: '选择本周投入方向', description: '在稳定生活、能力成长和经营关系之间，选择这一阶段更愿意投入的方向。', location: '旧桥街区', timeCost: 20, moneyCost: 0, staminaCost: 1, risk: '低', tone: 'coral' as const },
  opportunity: { id: 'urban-opportunity', ruleId: 'urban-opportunity', title: '接下一件小机会', description: '接受一件与当前方向相关的小事，先让生活发生可追踪的变化。', location: '旧桥街区', timeCost: 60, moneyCost: 2, staminaCost: 6, risk: '中', tone: 'gold' as const },
  recover: { id: 'urban-recover', ruleId: 'urban-recover', title: '恢复状态并整理账本', description: '暂时不追赶机会，先把身体、精力和手头资源重新整理清楚。', location: '旧桥街区', timeCost: 45, moneyCost: 0, staminaCost: 0, risk: '几乎没有', tone: 'sky' as const },
  explore: { id: 'urban-explore', ruleId: 'urban-explore', title: '沿街区边缘探索', description: '在安全范围内确认一条新路线，逐步认识这座城市，而不是瞬间看完整张地图。', location: '未知方向', timeCost: 55, moneyCost: 0, staminaCost: 5, risk: '中', tone: 'coral' as const },
  study: { id: 'urban-study', ruleId: 'urban-study', title: '去青禾大学城旁听', description: '沿着已经获得的机会，尝试接触新的学习环境和能力路径。', location: '青禾大学城', timeCost: 90, moneyCost: 5, staminaCost: 8, risk: '中', tone: 'gold' as const },
  review: { id: 'urban-review', ruleId: 'urban-review', title: '做一次每周复盘', description: '回看最近的承诺、支出、关系和方向，决定下一阶段是否要调整。', location: '旧桥街区', timeCost: 25, moneyCost: 0, staminaCost: 1, risk: '低', tone: 'sage' as const },
}

const baseLocations = [
  { id: 'urban-home', name: '旧桥居所', kind: '生活', description: '一间不宽敞但暂时稳定的住处，窗外能看到旧桥街区的早班人流。', distance: '当前位置', available: true, discovered: true, discoverySource: 'birth' as const, discoveredAtTurn: 0 },
  { id: 'urban-square', name: '旧桥广场', kind: '公共空间', description: '社区公告、临时集市和邻里消息会在这里交汇。', distance: '步行 8 分钟', available: true, discovered: false },
  { id: 'urban-center', name: '社区中心', kind: '公共服务', description: '提供社区活动和生活信息的地方，目前还只是听说过的名字。', distance: '步行 18 分钟', available: true, discovered: false },
  { id: 'urban-market', name: '市场巷', kind: '贸易', description: '价格、工作和短期机会变化最快的一条街。', distance: '步行 24 分钟', available: true, discovered: false },
  { id: 'urban-campus', name: '青禾大学城', kind: '学习', description: '需要沿着机会链继续前进后才能进入的学习区域。', distance: '公共交通 40 分钟', available: true, discovered: false },
]

const baseNpcs = [
  { id: 'npc-lin', name: '林晚晴', role: '社区工作者', avatar: '林', summary: '负责旧桥片区的社区事务，擅长把模糊的困难拆成可以处理的小步骤。', relationship: 0, lastInteraction: '尚未相遇', status: '正在整理社区公告', met: false, schedule: ['正在整理社区公告', '走访旧桥街区', '在社区中心接待居民'] },
]

const seedActions: SuggestedAction[] = [actions.observe, actions.notice, actions.meet, actions.explore, actions.recover]

const seedState = {
  player: { name: '未命名人生', age: 18, ageStage: 'adult' as const, role: '旧桥居民', profession: '自由工作者', mood: '刚刚开始', health: 80, maxHealth: 100, stamina: 70, maxStamina: 100, money: 12, reputation: 0, traits: [] },
  world: { day: 1, time: '清晨 · 07:00', season: '初秋', weather: '晴间多云', location: '霓虹城 · 旧桥居所', region: '霓虹城旧桥片区', atmosphere: '潮湿 · 人声渐起', headline: '旧桥片区的社区公告栏今天贴出了一张新通知。', narrative: [], currentFocus: '先认识眼前的生活圈', publicNews: ['旧桥片区正在征集社区互助意见'], mapId: 'old-bridge' },
  npcs: baseNpcs,
  locations: baseLocations,
  suggestedActions: seedActions,
  history: [],
  inventory: ['旧手机', '一串钥匙'],
  knownFacts: ['你目前只熟悉旧桥居所'],
  scheduledEvents: [],
  memory: { summary: '', compressedThroughTurn: 0, compressedThroughSequence: 0, compressedEventIds: [], pinnedFacts: [], openThreads: [] },
  nextEventSequence: 1,
  turn: 0,
}

const map: MapDefinition = {
  id: 'old-bridge',
  title: '旧桥片区',
  subtitle: '现代都市 · 普通人的生活圈',
  description: '一座现代城市里不显眼却真实存在的社区。机会不会自动来到你面前，需要从可观察、可承担的小事开始。',
  region: '霓虹城旧桥片区',
  kind: '都市社区',
  startingLocation: '霓虹城 · 旧桥居所',
  opening: ['清晨的公交声沿着旧桥传来。', '你在旧桥居所醒来，手机上没有必须立刻回复的消息。', '今天没有人替你安排人生，但街区里已经有一些小事正在等待被注意。'],
  ageStageOpenings: {
    baby: ['城市的声音隔着窗帘传来，你先在熟悉的住处接受照料。', '此刻世界还很小，最清楚的是照料者的脚步、灯光和近处的声音。', '今天只需要被照顾、观察和休息，不会凭空出现成人工作。'],
    child: ['旧桥片区的早晨从公交声和邻居的脚步开始。', '你还不能独自处理大人的事务，但可以在安全范围内玩耍、学习和观察。', '今天的世界只从眼前的居所和附近街道开始。'],
    teen: ['旧桥片区正在醒来，你开始认真想自己将来想走哪条路。', '大学城、工作和关系都还在远处，今天先从学习和询问开始。'],
    elder: ['城市的早晨比从前更吵了一些，但你仍认得旧桥片区的节奏。', '今天可以慢一点，把经验、健康和仍然愿意做的事安排好。'],
  },
  availableRoles: ['旧桥居民', '社区志愿者', '外来租客'],
  availableProfessions: ['自由工作者', '社区助理', '待定'],
  discoveryPolicy,
  seedState,
}

export const neonCity: ScriptPackage = {
  manifest: {
    id: 'urban-life',
    title: '霓虹城的人生',
    subtitle: '现代都市 · 现实因果人生沙盒',
    version: '1.0',
    author: 'AI Life Worlds',
    description: '在一座现代城市里，从一个真实可见的生活圈开始，经营稳定、能力与关系，而不是等待一条预先写好的主线。',
    capabilities: ['现代生活', '社区关系', '职业成长', '经济约束', '长期因果'],
    score: 85.5,
    category: '现代都市人生',
    readiness: 'verified',
  },
  theme: { accent: '#315d62', accentSoft: '#e3efed', accentWarm: '#d78e6c', ink: '#233e43', paper: '#f4f1e9', surface: '#fffdf8', sky: '#dcebed' },
  characterCreation: {
    enabled: true,
    roles: ['旧桥居民', '社区志愿者', '外来租客'],
    professions: ['自由工作者', '社区助理', '待定'],
    traits: ['做事稳妥', '愿意倾听', '擅长观察', '不轻易承诺', '想改变现状'],
    ageStages: [
      { id: 'baby', label: '婴儿期', minAge: 0, maxAge: 3, description: '从照料、声音和安全感开始认识城市。' },
      { id: 'child', label: '童年期', minAge: 4, maxAge: 11, description: '在熟悉的生活圈里玩耍、学习和帮忙。' },
      { id: 'teen', label: '少年期', minAge: 12, maxAge: 17, description: '开始学习、询问职业方向和建立自己的判断。' },
      { id: 'adult', label: '成年期', minAge: 18, maxAge: 59, description: '处理工作、住房、关系和城市机会。' },
      { id: 'elder', label: '老年期', minAge: 60, maxAge: 120, description: '在健康、经验和仍想做的事之间安排生活。' },
    ],
    ageStageProfiles: {
      baby: { roles: ['被照料的孩子'], professions: ['尚未拥有职业'], startingHealth: 30, maxHealth: 30, startingStamina: 25, maxStamina: 25, startingMoney: 0, startingReputation: 0, startingInventory: [], startingMood: '需要照料' },
      child: { roles: ['片区里的孩子'], professions: ['学生'], startingHealth: 65, maxHealth: 65, startingStamina: 45, maxStamina: 45, startingMoney: 2, startingReputation: 0, startingInventory: [], startingMood: '正在认识世界' },
      teen: { roles: ['少年居民'], professions: ['学生', '学徒候选'], startingHealth: 85, maxHealth: 85, startingStamina: 65, maxStamina: 65, startingMoney: 8, startingReputation: 0, startingInventory: ['旧耳机'], startingMood: '正在寻找方向' },
      elder: { roles: ['社区长者'], professions: ['自由顾问'], startingHealth: 78, maxHealth: 78, startingStamina: 50, maxStamina: 50, startingMoney: 30, startingReputation: 0, startingInventory: ['旧相册'], startingMood: '沉静' },
    },
  },
  ageStageActions: {
    baby: [
      { id: 'urban-baby-care', ruleId: 'baby-care', title: '接受照料', description: '让照料者安排喂食、擦洗和安抚。', location: '旧桥居所', timeCost: 40, moneyCost: 0, staminaCost: 1, risk: '几乎没有', tone: 'sky' },
      { id: 'urban-baby-observe', ruleId: 'baby-observe', title: '观察熟悉的声音', description: '从屋里的声音和光影开始认识这个世界。', location: '旧桥居所', timeCost: 25, moneyCost: 0, staminaCost: 1, risk: '几乎没有', tone: 'sage' },
      { id: 'urban-baby-rest', ruleId: 'baby-rest', title: '安稳睡一觉', description: '在安全的住处休息，让身体慢慢成长。', location: '旧桥居所', timeCost: 90, moneyCost: 0, staminaCost: 0, risk: '几乎没有', tone: 'gold' },
    ],
    child: [
      { id: 'urban-child-play', ruleId: 'child-play', title: '在住处附近玩耍', description: '只在熟悉又安全的地方玩一会儿。', location: '旧桥居所', timeCost: 60, moneyCost: 0, staminaCost: 3, risk: '低', tone: 'sage' },
      { id: 'urban-child-learn', ruleId: 'child-learn', title: '学习基础知识', description: '跟着照料者认识文字、路线和生活中的常见事物。', location: '旧桥居所', timeCost: 50, moneyCost: 0, staminaCost: 2, risk: '几乎没有', tone: 'sky' },
      { id: 'urban-child-help', ruleId: 'child-help', title: '帮家里做一点小事', description: '完成自己拿得动、做得到的整理和递送。', location: '旧桥居所', timeCost: 40, moneyCost: 0, staminaCost: 4, risk: '低', tone: 'gold' },
    ],
    teen: [
      { id: 'urban-teen-study', ruleId: 'teen-study', title: '整理学习方向', description: '比较学习、手艺和未来工作需要的准备。', location: '旧桥片区', timeCost: 80, moneyCost: 0, staminaCost: 4, risk: '低', tone: 'sky' },
      { id: 'urban-teen-apprentice', ruleId: 'teen-apprentice', title: '打听学徒机会', description: '在附近询问是否有人愿意教你一门实用的技能。', location: '旧桥片区', timeCost: 70, moneyCost: 0, staminaCost: 6, risk: '中', tone: 'gold' },
      { id: 'urban-teen-explore', ruleId: 'teen-explore', title: '探索生活圈边缘', description: '只沿安全路线走一段，确认边界和回程路线。', location: '未知方向', timeCost: 60, moneyCost: 0, staminaCost: 8, risk: '中', tone: 'coral' },
    ],
    adult: [actions.observe, actions.notice, actions.meet, actions.choose, actions.opportunity, actions.recover, actions.explore, actions.study, actions.review],
    elder: [
      { id: 'urban-elder-rest', ruleId: 'elder-rest', title: '放慢节奏休息', description: '照顾身体，把今天的安排调整得更从容。', location: '旧桥居所', timeCost: 60, moneyCost: 0, staminaCost: 0, risk: '几乎没有', tone: 'sky' },
      { id: 'urban-elder-teach', ruleId: 'elder-teach', title: '传授一段经验', description: '把熟悉的经验讲给愿意倾听的人。', location: '旧桥片区', timeCost: 45, moneyCost: 0, staminaCost: 2, risk: '低', tone: 'gold' },
      { id: 'urban-elder-walk', ruleId: 'elder-walk', title: '沿熟悉街道散步', description: '沿着熟悉路线走一圈，看看环境有什么变化。', location: '旧桥片区', timeCost: 50, moneyCost: 0, staminaCost: 5, risk: '低', tone: 'sage' },
    ],
  },
  ageStageOpenings: map.ageStageOpenings,
  maps: [map],
  rules: {
    'urban-observe': { id: 'urban-observe', allowedMapIds: ['old-bridge'], allowedAgeStages: ['adult'], revealsLocationId: 'urban-square' },
    'urban-notice': { id: 'urban-notice', allowedMapIds: ['old-bridge'], allowedAgeStages: ['adult'], revealsLocationId: 'urban-square' },
    'urban-meet': { id: 'urban-meet', allowedMapIds: ['old-bridge'], allowedAgeStages: ['adult'], conditions: [{ path: 'player.health', operator: 'min', value: 10, message: '先确保身体状态足够，再去社区中心。' }], revealsLocationId: 'urban-center', delayedEventId: 'urban-lin-followup' },
    'urban-choose': { id: 'urban-choose', allowedMapIds: ['old-bridge'], allowedAgeStages: ['adult'] },
    'urban-opportunity': { id: 'urban-opportunity', allowedMapIds: ['old-bridge'], allowedAgeStages: ['adult'], conditions: [{ path: 'player.money', operator: 'min', value: 2, message: '这件小机会需要至少 2 枚铜币作为交通和材料成本。' }], revealsLocationId: 'urban-market' },
    'urban-recover': { id: 'urban-recover', allowedMapIds: ['old-bridge'], allowedAgeStages: ['adult'] },
    'urban-explore': { id: 'urban-explore', allowedMapIds: ['old-bridge'], allowedAgeStages: ['adult'], revealsLocationId: 'urban-market' },
    'urban-study': { id: 'urban-study', allowedMapIds: ['old-bridge'], allowedAgeStages: ['adult'], conditions: [{ path: 'player.money', operator: 'min', value: 5, message: '先准备至少 5 枚铜币，才够支付去大学城的交通。' }], revealsLocationId: 'urban-campus' },
    'urban-review': { id: 'urban-review', allowedMapIds: ['old-bridge'], allowedAgeStages: ['adult'] },
    'baby-care': { id: 'baby-care', allowedMapIds: ['old-bridge'], allowedAgeStages: ['baby'] },
    'baby-observe': { id: 'baby-observe', allowedMapIds: ['old-bridge'], allowedAgeStages: ['baby'] },
    'baby-rest': { id: 'baby-rest', allowedMapIds: ['old-bridge'], allowedAgeStages: ['baby'] },
    'child-play': { id: 'child-play', allowedMapIds: ['old-bridge'], allowedAgeStages: ['child'] },
    'child-learn': { id: 'child-learn', allowedMapIds: ['old-bridge'], allowedAgeStages: ['child'] },
    'child-help': { id: 'child-help', allowedMapIds: ['old-bridge'], allowedAgeStages: ['child'] },
    'teen-study': { id: 'teen-study', allowedMapIds: ['old-bridge'], allowedAgeStages: ['teen'] },
    'teen-apprentice': { id: 'teen-apprentice', allowedMapIds: ['old-bridge'], allowedAgeStages: ['teen'] },
    'teen-explore': { id: 'teen-explore', allowedMapIds: ['old-bridge'], allowedAgeStages: ['teen'] },
    'elder-rest': { id: 'elder-rest', allowedMapIds: ['old-bridge'], allowedAgeStages: ['elder'] },
    'elder-teach': { id: 'elder-teach', allowedMapIds: ['old-bridge'], allowedAgeStages: ['elder'] },
    'elder-walk': { id: 'elder-walk', allowedMapIds: ['old-bridge'], allowedAgeStages: ['elder'] },
  },
  events: [{ id: 'urban-lin-followup', dueTurn: 2, title: '林晚晴发来一条社区消息', body: '林晚晴把一张社区互助活动的通知留在了公告栏边，像是在等你决定要不要继续了解。', tags: ['社区', '线索'], npcId: 'npc-lin', relationshipDelta: 2, revealsLocationId: 'urban-market' }],
  incidentPolicy: { enabled: true, chance: 0.12, maxScheduled: 2 },
  world: { startingMapId: 'old-bridge', startingLocation: map.startingLocation, opening: map.opening, mapDiscovery: discoveryPolicy, seedState },
}
