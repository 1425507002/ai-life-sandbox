import { describe, expect, it } from 'vitest'
import { buildInitialState, resolveAction } from './actionEngine'
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
})
