import { describe, expect, it } from 'vitest'
import { buildInitialState, buildNewLifeState, resolveAction } from './actionEngine'
import { getScript } from '../data/scripts'

describe('action engine', () => {
  const script = getScript('dawnmere')
  const harborScript = getScript('tideglass')

  it('resolves a concrete suggested action and mutates the world', () => {
    const state = buildInitialState(script)
    const result = resolveAction(state, '去集市看看今天有什么新鲜事', script)

    expect(result.outcome).toBe('success')
    expect(result.state.world.location).toContain('晨雾集市')
    expect(result.state.turn).toBe(state.turn + 1)
    expect(result.state.player.stamina).toBeLessThan(state.player.stamina)
    expect(result.state.history[0].ruleId).toBe('market')
    expect(result.state.history[0].actionId).toContain('western-world:market:')
    expect(result.state.history[0].stateDiff?.some((diff) => diff.key === 'player.stamina')).toBe(true)
    expect(result.state.suggestedActions.every((action) => action.ruleId !== 'market')).toBe(true)
    expect(result.state.suggestedActions.map((action) => action.title)).not.toEqual(state.suggestedActions.map((action) => action.title))

    const followUp = resolveAction(result.state, result.state.suggestedActions[0].title, script)
    expect(followUp.outcome).not.toBe('unknown')
  })

  it('charges the tavern cost exactly once', () => {
    const harborState = buildInitialState(harborScript, 'tide-harbor')
    const startingMoney = harborState.player.money
    const result = resolveAction(harborState, '去潮声酒馆听听今晚的消息', harborScript)

    expect(result.outcome).toBe('success')
    expect(result.state.player.money).toBe(startingMoney - 5)
    expect(result.deltas).toContain('花费 5 枚铜币')
  })

  it('only offers actions that belong to the active map', () => {
    const harborState = buildInitialState(harborScript, 'tide-harbor')
    expect(harborState.suggestedActions.length).toBeGreaterThan(0)
    expect(harborState.suggestedActions.every((action) => ['dock', 'rhea', 'tavern', 'lighthouse'].includes(action.ruleId ?? action.id))).toBe(true)
    expect(harborState.suggestedActions.some((action) => (action.ruleId ?? action.id) === 'market')).toBe(false)
  })

  it('refuses a map-specific free-form keyword instead of silently advancing time', () => {
    const harborState = buildInitialState(harborScript, 'tide-harbor')
    const result = resolveAction(harborState, '我想去北坡雾林采药', harborScript)

    expect(result.outcome).toBe('refused')
    expect(result.state.turn).toBe(harborState.turn)
    expect(result.deltas).toContain('地图条件不满足')
  })

  it('refuses actions that exceed the player resources without mutating state', () => {
    const state = buildInitialState(script)
    state.player.stamina = 2
    const result = resolveAction(state, '去北坡雾林采药', script)

    expect(result.outcome).toBe('refused')
    expect(result.state.world.location).toBe(state.world.location)
    expect(result.state.turn).toBe(state.turn)
  })

  it('keeps unknown free-form actions visible as unresolved facts', () => {
    const state = buildInitialState(script)
    const result = resolveAction(state, '我想观察屋顶上的鸟', script)

    expect(result.outcome).toBe('unknown')
    expect(result.state.history[0].tags).toContain('待确认')
    expect(result.state.world.currentFocus).toContain('观察屋顶上的鸟')
  })

  it('blocks a rule when its DSL condition is not met', () => {
    const state = buildInitialState(script)
    state.player.health = 5
    const result = resolveAction(state, '去北坡雾林采药', script)

    expect(result.outcome).toBe('refused')
    expect(result.deltas).toContain('前置条件不满足')
    expect(result.state.turn).toBe(state.turn)
  })

  it('schedules and resolves a delayed event without AI', () => {
    const state = buildInitialState(script)
    const result = resolveAction(state, '去铁匠铺帮一会儿', script)

    expect(result.state.scheduledEvents?.some((event) => event.id === 'dawnmere-smith-trial')).toBe(true)
    const next = resolveAction(result.state, result.state.suggestedActions[0].title, script)
    expect(next.state.history.some((event) => event.title === '奥伦留了一句口信')).toBe(true)
  })

  it('lets NPCs advance their own schedule as the world progresses', () => {
    const state = buildInitialState(script)
    const result = resolveAction(state, '去集市看看今天有什么新鲜事', script)

    expect(result.state.npcs.some((npc) => npc.status !== script.world.seedState.npcs.find((item) => item.id === npc.id)?.status)).toBe(true)
  })

  it('advances the calendar day when an action crosses midnight', () => {
    const state = buildInitialState(script)
    state.world.day = 7
    state.world.time = '夜晚 · 23:50'
    const result = resolveAction(state, '整理房间', script)

    expect(result.state.world.day).toBe(8)
    expect(result.state.world.time).toBe('深夜 · 00:25')
  })

  it('creates a clean age-aware baby life instead of reusing the demo seed', () => {
    const state = buildNewLifeState(script, { mapId: 'tide-harbor', ageStage: 'baby', player: { name: '婴儿测试', age: 0 } })

    expect(state.turn).toBe(0)
    expect(state.world.day).toBe(1)
    expect(state.world.time).toBe('清晨 · 07:00')
    expect(state.history).toHaveLength(0)
    expect(state.knownFacts).toHaveLength(0)
    expect(state.scheduledEvents).toHaveLength(0)
    expect(state.player.ageStage).toBe('baby')
    expect(state.player.role).toBe('被照料的孩子')
    expect(state.player.profession).toBe('尚未拥有职业')
    expect(state.player.health).toBe(30)
    expect(state.player.maxHealth).toBe(30)
    expect(state.player.stamina).toBe(25)
    expect(state.player.maxStamina).toBe(25)
    expect(state.npcs.every((npc) => npc.relationship === 0 && npc.lastInteraction === '尚未相遇')).toBe(true)
    expect(state.locations.filter((location) => location.discovered !== false)).toHaveLength(1)
    expect(state.locations.find((location) => location.discovered)?.name).toBe('灯塔街')
    expect(state.suggestedActions.every((action) => action.ruleId?.startsWith('baby-'))).toBe(true)
    expect(state.suggestedActions.some((action) => action.ruleId === 'dock')).toBe(false)

    const blocked = resolveAction(state, '去码头问问乔恩', script)
    expect(blocked.outcome).toBe('refused')
    expect(blocked.deltas).toContain('年龄阶段不满足')
    expect(blocked.state.turn).toBe(0)
  })

  it('does not let an unverified baby free-form action bypass age rules', () => {
    const state = buildNewLifeState(script, { ageStage: 'baby', player: { name: '自由行动测试', age: 0 } })
    const result = resolveAction(state, '去外地工作', script)

    expect(result.outcome).toBe('refused')
    expect(result.state.turn).toBe(0)
    expect(result.deltas).toContain('年龄阶段未验证')
  })

  it('derives the age stage from an explicit numeric age', () => {
    const state = buildNewLifeState(script, { ageStage: 'baby', player: { name: '年龄优先测试', age: 18 } })

    expect(state.player.age).toBe(18)
    expect(state.player.ageStage).toBe('adult')
    expect(state.player.profession).not.toBe('尚未拥有职业')
  })

  it('resolves an age-specific action without adult side effects', () => {
    const state = buildNewLifeState(script, { ageStage: 'child', player: { name: '童年测试' } })
    const result = resolveAction(state, state.suggestedActions[0].title, script)

    expect(result.outcome).toBe('success')
    expect(result.state.turn).toBe(1)
    expect(result.state.history[0].ruleId).toMatch(/^child-/)
    expect(result.state.player.profession).toBe('学生')
  })

  it('hides NPCs until a real interaction marks them as met', () => {
    const state = buildNewLifeState(harborScript, { mapId: 'tide-harbor', ageStage: 'adult', player: { name: '初次相遇测试' } })
    expect(state.npcs.every((npc) => npc.met === false)).toBe(true)
    const rheaAction = state.suggestedActions.find((action) => action.ruleId === 'rhea')
    expect(rheaAction?.title).toBe('找一份附近的帮工')
    const result = resolveAction(state, rheaAction?.title ?? '', harborScript)
    expect(result.state.npcs.find((npc) => npc.id === 'rhea')?.met).toBe(true)
    expect(result.state.npcs.find((npc) => npc.id === 'jon')?.met).toBe(false)
  })

  it('starts a new life without carrying old news or headline details', () => {
    const state = buildNewLifeState(harborScript, { mapId: 'tide-harbor', ageStage: 'baby', player: { name: '新生儿状态测试' } })

    expect(state.world.day).toBe(1)
    expect(state.world.time).toBe('清晨 · 07:00')
    expect(state.world.publicNews).toEqual([])
    expect(state.world.headline).toBe('海风把盐味送进半开的窗。')
    expect(state.knownFacts).toEqual([])

    const firstAction = resolveAction(buildNewLifeState(script, { mapId: 'mist-town', ageStage: 'adult', player: { name: '陌生人新闻测试' } }), '整理房间', script)
    expect(firstAction.state.world.publicNews).toEqual([])
  })

  it('expands the map only after a rule explicitly reveals a location', () => {
    const state = buildNewLifeState(script, { mapId: 'mist-town', ageStage: 'adult', player: { name: '地图探索测试' } })
    expect(state.locations.filter((location) => location.discovered !== false).map((location) => location.id)).toEqual(['home'])

    const result = resolveAction(state, '去集市看看今天有什么新鲜事', script)
    expect(result.state.locations.find((location) => location.id === 'market')?.discovered).toBe(true)
    expect(result.state.locations.find((location) => location.id === 'forge')?.discovered).toBe(false)
    expect(result.deltas).toContain('发现地点：晨雾集市')
    expect(result.state.history[0].stateDiff?.some((diff) => diff.key === 'locations.market.discovered')).toBe(true)
  })

  it('reveals a catalogued location when a delayed event arrives', () => {
    const state = buildNewLifeState(script, { mapId: 'mist-town', ageStage: 'adult', player: { name: '事件地图测试' } })
    state.scheduledEvents = [{ id: 'map-event', dueTurn: 1, title: '邻居提起集市', body: '有人告诉你，集市今天比平时热闹。', tags: ['传闻'], revealsLocationId: 'market' }]

    const result = resolveAction(state, '整理房间', script)
    expect(result.state.locations.find((location) => location.id === 'market')?.discovered).toBe(true)
    expect(result.state.history.some((event) => event.title === '邻居提起集市')).toBe(true)
  })

  it('limits one action to one newly revealed location', () => {
    const state = buildNewLifeState(script, { mapId: 'mist-town', ageStage: 'adult', player: { name: '单次解锁测试' } })
    state.scheduledEvents = [
      { id: 'market-event', dueTurn: 1, title: '有人提起集市', body: '有人提起集市的消息。', tags: ['传闻'], revealsLocationId: 'market' },
      { id: 'forge-event', dueTurn: 1, title: '有人提起铁匠铺', body: '有人提起铁匠铺的消息。', tags: ['传闻'], revealsLocationId: 'forge' },
    ]

    const result = resolveAction(state, '整理房间', script)

    expect(result.state.locations.find((location) => location.id === 'market')?.discovered).toBe(true)
    expect(result.state.locations.find((location) => location.id === 'forge')?.discovered).toBe(false)
  })

  it('does not silently choose between two specific free-form destinations', () => {
    const state = buildNewLifeState(script, { mapId: 'mist-town', ageStage: 'adult', player: { name: '歧义行动测试' } })
    const result = resolveAction(state, '先去集市再去铁匠铺', script)

    expect(result.outcome).toBe('refused')
    expect(result.state.turn).toBe(state.turn)
    expect(result.state.world.location).toBe(state.world.location)
  })
})
