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
    expect(result.state.history[0].actionId).toBe('market')
    expect(result.state.suggestedActions.every((action) => action.ruleId !== 'market')).toBe(true)
    expect(result.state.suggestedActions.map((action) => action.title)).not.toEqual(state.suggestedActions.map((action) => action.title))

    const followUp = resolveAction(result.state, result.state.suggestedActions[0].title, script)
    expect(followUp.outcome).not.toBe('unknown')
  })

  it('charges the tavern cost exactly once', () => {
    const state = buildInitialState(harborScript)
    const startingMoney = state.player.money
    const result = resolveAction(state, '去潮声酒馆听听今晚的消息', harborScript)

    expect(result.outcome).toBe('success')
    expect(result.state.player.money).toBe(startingMoney - 5)
    expect(result.deltas).toContain('花费 5 枚铜币')
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
})
