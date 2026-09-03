import type { ScriptPackage } from '../types'

const dawnmere: ScriptPackage = {
  manifest: {
    id: 'dawnmere',
    title: '晨雾镇：一段普通人生',
    subtitle: '原创西幻 · 日常人生沙盒',
    version: '0.1',
    author: 'AI Life Worlds',
    description: '在边境小镇开始生活。没有预言，没有主线，只有你和这个会继续向前的世界。',
    capabilities: ['家庭', '职业', '关系', '经济'],
  },
  theme: {
    accent: '#31513c',
    accentSoft: '#e4ede1',
    accentWarm: '#d8896b',
    ink: '#25362d',
    paper: '#f6f0e6',
    surface: '#fffaf2',
    sky: '#dbe9ee',
  },
  characterCreation: { enabled: true, roles: ['普通居民', '外来旅人', '工坊学徒'], professions: ['木匠学徒', '面包房帮工', '自由手艺人'], traits: ['耐心', '手巧', '观察敏锐', '不喜欢欠人情', '对远方好奇'] },
  rules: {
    forest: { id: 'forest', conditions: [{ path: 'player.health', operator: 'min', value: 10, message: '你的身体状态还不错，但至少要保留 10 点状态才能进入雾林。' }], blockedMessage: '先休息或处理伤口，再去雾林。', delayedEventId: 'dawnmere-forest-return' },
    market: { id: 'market', delayedEventId: 'dawnmere-market-rumor' },
    smith: { id: 'smith', delayedEventId: 'dawnmere-smith-trial' },
  },
  events: [
    { id: 'dawnmere-market-rumor', dueTurn: 2, title: '米拉带来一条新消息', body: '米拉在你离开集市后听见了更具体的消息：旧桥修缮可能会提前开始。', tags: ['人物', '线索'], fact: '旧桥修缮可能会提前开始', npcId: 'mira', relationshipDelta: 1 },
    { id: 'dawnmere-smith-trial', dueTurn: 1, title: '奥伦留了一句口信', body: '奥伦让人捎来口信：如果你明早还愿意来，试工可以从整理木柄开始。', tags: ['工作', '安排'], fact: '奥伦的试工从整理木柄开始', npcId: 'oren', relationshipDelta: 2 },
    { id: 'dawnmere-forest-return', dueTurn: 2, title: '药草师认出了你的药草', body: '塞拉看过你带回的药草后，指出其中一株可以换成更好的止痛草。', tags: ['探索', '人物'], fact: '塞拉愿意帮你辨认药草', npcId: 'sela', relationshipDelta: 1 },
  ],
  world: {
    startingLocation: '晨雾镇 · 住处',
    opening: [
      '晨雾镇的钟声穿过还没有完全散去的薄雾。',
      '你在窗边醒来，木桌上放着一杯已经凉了一半的茶。',
      '今天没有人替你安排命运。镇上的人已经开始各自忙碌，而你可以决定先做什么。',
    ],
    seedState: {
      player: {
        name: '林澄', age: 22, ageStage: 'adult', role: '普通居民', profession: '木匠学徒', mood: '平静',
        health: 82, stamina: 68, money: 42, reputation: 12, traits: ['耐心', '手巧', '还在寻找方向'],
      },
      world: {
        day: 3, time: '清晨 · 07:20', season: '初春', weather: '薄雾',
        location: '晨雾镇 · 住处', region: '北境边缘', atmosphere: '微凉 · 安静',
        headline: '镇外的旧桥昨夜被雨水冲坏了一段，南边的商队可能会晚到。',
        narrative: [], currentFocus: '决定今天先做什么',
        publicNews: ['南门旧桥需要修缮', '铁匠铺正在招一名短工', '集市今天有来自河谷的布料'],
      },
      npcs: [
        { id: 'mira', name: '米拉', role: '邻居 · 面包师', avatar: 'M', summary: '每天清晨第一个开门，知道镇上大多数新鲜消息。', relationship: 26, lastInteraction: '昨天借给你一小袋燕麦', status: '正在准备早市面包', schedule: ['正在准备早市面包', '给邻居送出第一炉面包', '在门口听镇民谈旧桥'] },
        { id: 'oren', name: '奥伦', role: '铁匠', avatar: 'O', summary: '话少，做事稳，最近因为旧桥维修多了不少活。', relationship: 8, lastInteraction: '五天前在铺门口点头致意', status: '已经在铁砧旁工作', schedule: ['已经在铁砧旁工作', '去南门查看旧桥用的铆钉', '把试工材料摆到门边'] },
        { id: 'sela', name: '塞拉', role: '草药师', avatar: 'S', summary: '住在镇北边，常去雾林采药，讨厌浪费药材。', relationship: 14, lastInteraction: '上周帮你处理了手上的小伤', status: '准备出门采集', schedule: ['准备出门采集', '在屋后晾晒药草', '整理今天采到的根茎'] },
        { id: 'tavin', name: '塔文', role: '渡船人', avatar: 'T', summary: '熟悉河道和南边村落，午后通常会在渡口休息。', relationship: 3, lastInteraction: '还没有真正聊过', status: '正在检查渡船缆绳', schedule: ['正在检查渡船缆绳', '在渡口修补旧木桩', '替南边村民捎来一封信'] },
      ],
      locations: [
        { id: 'home', name: '住处', kind: '生活', description: '一间向东的小屋，窗台能看到镇钟和北坡。', distance: '当前位置', available: true },
        { id: 'market', name: '晨雾集市', kind: '贸易', description: '商贩、面包香和来自河谷的布料在这里汇聚。', distance: '步行 12 分钟', available: true },
        { id: 'forge', name: '奥伦铁匠铺', kind: '工作', description: '镇南侧的铁匠铺，今天似乎比往常更早开门。', distance: '步行 18 分钟', available: true },
        { id: 'northwood', name: '北坡雾林', kind: '探索', description: '有药草、旧猎径和不太稳定的山路。', distance: '步行 40 分钟', available: true },
      ],
      suggestedActions: [
        { id: 'market', title: '去集市', description: '逛一圈早市，看看有没有新鲜消息或便宜的布料。', location: '晨雾集市', timeCost: 70, moneyCost: 0, staminaCost: 8, risk: '低', tone: 'sage' },
        { id: 'smith', title: '拜访铁匠', description: '听听奥伦有没有适合木匠学徒的短工。', location: '奥伦铁匠铺', timeCost: 45, moneyCost: 0, staminaCost: 4, risk: '低', tone: 'gold' },
        { id: 'tidy', title: '整理房间', description: '把木屑、旧工具和堆在窗边的衣物收拾好。', location: '住处', timeCost: 35, moneyCost: 0, staminaCost: 2, risk: '几乎没有', tone: 'sky' },
        { id: 'forest', title: '去北坡采药', description: '趁雾还没有完全散，沿熟悉的猎径找一圈常见药草。', location: '北坡雾林', timeCost: 120, moneyCost: 0, staminaCost: 18, risk: '中', tone: 'coral' },
      ],
      history: [
        { id: 'h1', date: '第 2 日 · 傍晚', title: '修好了窗闩', body: '你用剩下的木料把松动的窗闩重新固定，屋里晚上不再灌风。', outcome: 'success', tags: ['生活', '手工'] },
        { id: 'h2', date: '第 2 日 · 清晨', title: '米拉借给你燕麦', body: '你答应下次帮她搬面粉，她没有收钱。', outcome: 'success', tags: ['人物', '邻里'] },
      ],
      inventory: ['旧木工刀', '半袋燕麦', '粗麻线'],
      knownFacts: ['南门旧桥需要修缮', '奥伦铁匠铺最近缺人手'],
      turn: 2,
    },
  },
}

const tideglass: ScriptPackage = {
  manifest: {
    id: 'tideglass',
    title: '灰潮港：潮汐之间',
    subtitle: '原创海港 · 生活与选择沙盒',
    version: '0.1',
    author: 'AI Life Worlds',
    description: '在一个被潮汐、商船和旧传闻塑造的海港里，慢慢找到自己的位置。',
    capabilities: ['航运', '关系', '职业', '传闻'],
  },
  theme: {
    accent: '#275769',
    accentSoft: '#e1eef0',
    accentWarm: '#d28c62',
    ink: '#203b43',
    paper: '#eff5f2',
    surface: '#fbfffd',
    sky: '#d7e8e9',
  },
  characterCreation: { enabled: true, roles: ['港口居民', '外来水手', '船具店帮工'], professions: ['船具店帮工', '码头搬运工', '自由水手'], traits: ['观察敏锐', '不喜欢欠人情', '对远方好奇', '记性很好'] },
  rules: {
    tavern: { id: 'tavern', delayedEventId: 'tideglass-tavern-rumor' },
    lighthouse: { id: 'lighthouse', conditions: [{ path: 'player.health', operator: 'min', value: 8, message: '礁石路很滑，至少保留 8 点状态再出发。' }], delayedEventId: 'tideglass-lighthouse-key' },
    dock: { id: 'dock', delayedEventId: 'tideglass-dock-work' },
  },
  events: [
    { id: 'tideglass-tavern-rumor', dueTurn: 1, title: '水手又补上半句传闻', body: '昨天窗边的水手在你离开后又想起一件事：那艘旧货船的船尾有新换过的漆。', tags: ['酒馆', '传闻'], fact: '陌生货船船尾有新换过的漆' },
    { id: 'tideglass-lighthouse-key', dueTurn: 2, title: '艾尔娜找到了半截钥匙', body: '艾尔娜在灯塔外的碎石里找到了半截旧钥匙，另一半可能还在外港。', tags: ['灯塔', '线索'], fact: '灯塔钥匙只找到半截', npcId: 'elna', relationshipDelta: 2 },
    { id: 'tideglass-dock-work', dueTurn: 1, title: '乔恩替你留了一个位置', body: '乔恩把明早的短工名单压在仓棚门后，特意给你留了一个位置。', tags: ['码头', '工作'], fact: '明早西堤仓棚有一份短工', npcId: 'jon', relationshipDelta: 1 },
  ],
  world: {
    startingLocation: '灰潮港 · 灯塔街',
    opening: ['海风把盐味送进半开的窗。', '港口刚刚退潮，湿石路上留下了一层闪光的水。', '今天的第一班货船午后靠岸，而你还没有决定要不要去码头看看。'],
    seedState: {
      player: { name: '沈原', age: 27, ageStage: 'adult', role: '港口居民', profession: '船具店帮工', mood: '有些犹豫', health: 76, stamina: 62, money: 58, reputation: 18, traits: ['观察敏锐', '不喜欢欠人情', '对远方好奇'] },
      world: { day: 12, time: '黄昏 · 17:10', season: '晚夏', weather: '海风', location: '灰潮港 · 灯塔街', region: '西海岸', atmosphere: '潮湿 · 有人声', headline: '一艘没有挂出港旗的旧货船正在外港减速。', narrative: [], currentFocus: '决定今晚是否去码头', publicNews: ['西堤仓库临时招工', '灯塔管理员在找丢失的钥匙', '外港有一艘陌生货船'] },
      npcs: [
        { id: 'rhea', name: '瑞娅', role: '船具店老板', avatar: 'R', summary: '精打细算，但会记住每个认真工作的人。', relationship: 31, lastInteraction: '今天下午一起盘点了麻绳', status: '正在关店', schedule: ['正在关店', '核对今天的船具账目', '把潮湿的帆布挂到后院'] },
        { id: 'jon', name: '乔恩', role: '码头搬运工', avatar: 'J', summary: '消息灵通，喜欢讲一半故事，再看别人会不会追问。', relationship: 11, lastInteraction: '三天前在酒馆打过照面', status: '在西堤等活', schedule: ['在西堤等活', '替仓棚清点木箱', '去外港看一眼潮位'] },
        { id: 'elna', name: '艾尔娜', role: '灯塔管理员', avatar: 'E', summary: '沉默而可靠，熟悉潮汐和所有通往外港的小路。', relationship: 6, lastInteraction: '上月替她送过一次灯油', status: '正在找钥匙', schedule: ['正在找钥匙', '擦拭灯塔的铜制护栏', '记录今晚的潮位'] },
      ],
      locations: [
        { id: 'shop', name: '船具店', kind: '工作', description: '卖缆绳、帆布和旧航海工具的小店。', distance: '当前位置', available: true },
        { id: 'dock', name: '西堤码头', kind: '工作', description: '货船靠岸、搬运工等活的地方。', distance: '步行 9 分钟', available: true },
        { id: 'lighthouse', name: '旧灯塔', kind: '探索', description: '能看到外港和北侧礁群，夜里风很大。', distance: '步行 26 分钟', available: true },
        { id: 'tavern', name: '潮声酒馆', kind: '社交', description: '水手、商人和本地居民交换消息的地方。', distance: '步行 14 分钟', available: true },
      ],
      suggestedActions: [
        { id: 'dock', title: '去西堤看看', description: '去码头走一圈，也许能找到临时搬运的活。', location: '西堤码头', timeCost: 50, moneyCost: 0, staminaCost: 6, risk: '低', tone: 'sage' },
        { id: 'rhea', title: '帮瑞娅关店', description: '留下来帮忙整理船具，也顺便问问她对那艘货船的看法。', location: '船具店', timeCost: 35, moneyCost: 0, staminaCost: 3, risk: '低', tone: 'gold' },
        { id: 'tavern', title: '去潮声酒馆', description: '点一杯便宜的麦酒，听听今晚港口在传什么。', location: '潮声酒馆', timeCost: 80, moneyCost: 5, staminaCost: 2, risk: '中', tone: 'sky' },
        { id: 'lighthouse', title: '去旧灯塔', description: '趁天还没完全黑，替艾尔娜找找丢失的钥匙。', location: '旧灯塔', timeCost: 100, moneyCost: 0, staminaCost: 14, risk: '中', tone: 'coral' },
      ],
      history: [{ id: 't1', date: '第 12 日 · 午后', title: '发现陌生货船', body: '在船具店后窗，你看到外港有一艘没有挂出港旗的旧货船。', outcome: 'unknown', tags: ['传闻', '港口'] }],
      inventory: ['旧船具账本', '一枚生锈的铜扣', '半块黑麦面包'],
      knownFacts: ['外港有陌生货船', '艾尔娜正在寻找灯塔钥匙'],
      turn: 1,
    },
  },
}

const ageStageActions = {
  baby: [
    { id: 'baby-care', ruleId: 'baby-care', title: '接受照料', description: '让照料者安排喂食、擦洗和安抚，先把身体照顾好。', location: '住处', timeCost: 45, moneyCost: 0, staminaCost: 1, risk: '几乎没有', tone: 'sky' },
    { id: 'baby-observe', ruleId: 'baby-observe', title: '观察熟悉的声音', description: '在安全的住处听一听、看一看，把一个细节留在记忆里。', location: '住处', timeCost: 30, moneyCost: 0, staminaCost: 1, risk: '几乎没有', tone: 'sage' },
    { id: 'baby-rest', ruleId: 'baby-rest', title: '安稳睡一觉', description: '在照料下休息，让身体和精力慢慢恢复。', location: '住处', timeCost: 90, moneyCost: 0, staminaCost: 0, risk: '没有', tone: 'gold' },
  ],
  child: [
    { id: 'child-play', ruleId: 'child-play', title: '在住处附近玩耍', description: '只在熟悉又安全的地方玩一会儿，记住附近的路。', location: '住处', timeCost: 60, moneyCost: 0, staminaCost: 3, risk: '低', tone: 'sage' },
    { id: 'child-learn', ruleId: 'child-learn', title: '学习基础知识', description: '跟着照料者认字、认路或认识生活中常见的东西。', location: '住处', timeCost: 50, moneyCost: 0, staminaCost: 2, risk: '几乎没有', tone: 'sky' },
    { id: 'child-help', ruleId: 'child-help', title: '帮家里做一点小事', description: '完成自己拿得动、做得到的整理和递送。', location: '住处', timeCost: 45, moneyCost: 0, staminaCost: 4, risk: '低', tone: 'gold' },
  ],
  teen: [
    { id: 'teen-study', ruleId: 'teen-study', title: '整理学习方向', description: '花时间比较学习、手艺和未来工作需要的准备。', location: '住处', timeCost: 90, moneyCost: 0, staminaCost: 4, risk: '低', tone: 'sky' },
    { id: 'teen-apprentice', ruleId: 'teen-apprentice', title: '打听学徒机会', description: '在生活圈附近询问是否有人愿意教你一门手艺。', location: '住处', timeCost: 80, moneyCost: 0, staminaCost: 6, risk: '低', tone: 'gold' },
    { id: 'teen-explore', ruleId: 'teen-explore', title: '探索生活圈边缘', description: '只沿安全路线走一段，不进入当前年龄不适合的危险区域。', location: '住处', timeCost: 110, moneyCost: 0, staminaCost: 8, risk: '中', tone: 'coral' },
  ],
  elder: [
    { id: 'elder-rest', ruleId: 'elder-rest', title: '放慢节奏休息', description: '照顾身体，把今天的安排调整得更从容。', location: '住处', timeCost: 60, moneyCost: 0, staminaCost: 0, risk: '没有', tone: 'sky' },
    { id: 'elder-teach', ruleId: 'elder-teach', title: '传授一段经验', description: '把自己熟悉的经验讲给愿意倾听的人。', location: '住处', timeCost: 70, moneyCost: 0, staminaCost: 2, risk: '低', tone: 'gold' },
    { id: 'elder-walk', ruleId: 'elder-walk', title: '沿熟悉街道散步', description: '沿着熟悉的路线走一圈，看看环境有什么变化。', location: '住处', timeCost: 60, moneyCost: 0, staminaCost: 5, risk: '低', tone: 'sage' },
  ],
} as const

const ageActionRules = Object.fromEntries(Object.entries(ageStageActions).flatMap(([stage, actions]) => actions.map((action) => [action.ruleId, { id: action.ruleId, allowedAgeStages: [stage], blockedMessage: '这个行动只适合当前对应的年龄阶段。' }])) )

const westernWorld: ScriptPackage = {
  manifest: {
    id: 'western-world',
    title: '西方世界的人生',
    subtitle: '原创西幻 · 开放人生沙盘',
    version: '0.2',
    author: 'AI Life Worlds',
    description: '一个没有固定主线的西方世界。你可以从不同地区开始生活，也可以让同一个世界见证多条人生。',
    capabilities: ['地图', '职业', '关系', '经济', '长期因果'],
  },
  theme: dawnmere.theme,
  characterCreation: {
    enabled: true,
    roles: [...new Set([...(dawnmere.characterCreation?.roles ?? []), ...(tideglass.characterCreation?.roles ?? [])])],
    professions: [...new Set([...(dawnmere.characterCreation?.professions ?? []), ...(tideglass.characterCreation?.professions ?? [])])],
    traits: [...new Set([...(dawnmere.characterCreation?.traits ?? []), ...(tideglass.characterCreation?.traits ?? [])])],
    ageStages: [
      { id: 'baby', label: '婴儿期', minAge: 0, maxAge: 3, description: '从出生开始，行动范围和成长节奏会受到照料与家庭影响。' },
      { id: 'child', label: '童年期', minAge: 4, maxAge: 11, description: '可以探索住处、学习基础技能并建立最初的人际关系。' },
      { id: 'teen', label: '少年期', minAge: 12, maxAge: 17, description: '可以学习、拜师或开始尝试承担有限的工作。' },
      { id: 'adult', label: '成年期', minAge: 18, maxAge: 59, description: '拥有完整的职业、迁居、交易和关系选择。' },
      { id: 'elder', label: '老年期', minAge: 60, maxAge: 120, description: '经验更丰富，但体力、健康和时间安排需要更谨慎。' },
    ],
    ageStageProfiles: {
      baby: { roles: ['被照料的孩子'], professions: ['尚未拥有职业'], startingHealth: 70, startingStamina: 25, startingMoney: 0, startingReputation: 0, startingInventory: [], startingMood: '需要照料' },
      child: { roles: ['镇上孩子'], professions: ['学生'], startingHealth: 82, startingStamina: 40, startingMoney: 2, startingReputation: 0, startingInventory: [], startingMood: '精力充沛' },
      teen: { roles: ['少年学徒'], professions: ['学徒候选'], startingHealth: 88, startingStamina: 60, startingMoney: 8, startingReputation: 0, startingInventory: ['简易随身包'], startingMood: '正在寻找方向' },
      elder: { roles: ['退休居民'], professions: ['自由顾问'], startingHealth: 78, startingStamina: 45, startingMoney: 30, startingReputation: 0, startingInventory: ['旧怀表'], startingMood: '沉静' },
    },
  },
  ageStageActions,
  maps: [
    {
      id: 'mist-town', title: '晨雾镇', subtitle: '北境边缘 · 边境小镇', description: dawnmere.manifest.description,
      region: '北境边缘', kind: '城镇', startingLocation: dawnmere.world.startingLocation, opening: dawnmere.world.opening,
      availableRoles: dawnmere.characterCreation?.roles, availableProfessions: dawnmere.characterCreation?.professions, seedState: dawnmere.world.seedState,
    },
    {
      id: 'tide-harbor', title: '灰潮港', subtitle: '西海岸 · 潮汐港口', description: tideglass.manifest.description,
      region: '西海岸', kind: '港口', startingLocation: tideglass.world.startingLocation, opening: tideglass.world.opening,
      availableRoles: tideglass.characterCreation?.roles, availableProfessions: tideglass.characterCreation?.professions, seedState: tideglass.world.seedState,
    },
  ],
  rules: {
    forest: { ...dawnmere.rules?.forest, id: 'forest', allowedMapIds: ['mist-town'], allowedAgeStages: ['adult'] },
    market: { ...dawnmere.rules?.market, id: 'market', allowedMapIds: ['mist-town'], allowedAgeStages: ['adult'] },
    smith: { ...dawnmere.rules?.smith, id: 'smith', allowedMapIds: ['mist-town'], allowedAgeStages: ['adult'] },
    tidy: { id: 'tidy', allowedMapIds: ['mist-town'], allowedAgeStages: ['adult'] },
    tavern: { ...tideglass.rules?.tavern, id: 'tavern', allowedMapIds: ['tide-harbor'], allowedAgeStages: ['adult'] },
    rhea: { id: 'rhea', allowedMapIds: ['tide-harbor'], allowedAgeStages: ['adult'] },
    lighthouse: { ...tideglass.rules?.lighthouse, id: 'lighthouse', allowedMapIds: ['tide-harbor'], allowedAgeStages: ['adult'] },
    dock: { ...tideglass.rules?.dock, id: 'dock', allowedMapIds: ['tide-harbor'], allowedAgeStages: ['adult'] },
    ...ageActionRules,
  },
  incidentPolicy: { enabled: true, chance: 0.18, maxScheduled: 2 },
  events: [...(dawnmere.events ?? []), ...(tideglass.events ?? [])],
  world: {
    startingMapId: 'mist-town', startingLocation: dawnmere.world.startingLocation, opening: dawnmere.world.opening,
    seedState: { ...dawnmere.world.seedState, world: { ...dawnmere.world.seedState.world, mapId: 'mist-town' } },
  },
}

export const scriptPackages: ScriptPackage[] = [westernWorld]

export function getScript(scriptId: string) {
  if (scriptId === 'dawnmere' || scriptId === 'tideglass') return westernWorld
  return scriptPackages.find((script) => script.manifest.id === scriptId) ?? scriptPackages[0]
}

export function getMap(script: ScriptPackage, mapId: string) {
  return script.maps?.find((map) => map.id === mapId)
}
