import { describe, expect, it } from 'vitest'
import { buildInitialState, buildNewLifeState } from './actionEngine'
import { generateSuggestedActions } from './suggestionEngine'
import { getScript } from '../data/scripts'

describe('suggestion engine', () => {
  it('keeps producing unique, non-empty variants across consecutive turns', () => {
    const script = getScript('dawnmere')
    let state = buildInitialState(script)
    let previousTitles = new Set<string>()

    for (let turn = 0; turn < 6; turn += 1) {
      const actions = generateSuggestedActions(state, script)
      const titles = actions.map((action) => action.title)

      expect(actions.length).toBeGreaterThan(0)
      expect(new Set(titles).size).toBe(titles.length)
      expect(titles.some((title) => previousTitles.has(title))).toBe(false)

      const chosen = actions[0]
      previousTitles = new Set(titles)
      state = {
        ...state,
        turn: state.turn + 1,
        history: [{ id: `test-${turn}`, actionId: chosen.id, ruleId: chosen.ruleId, date: '', title: chosen.title, body: '', outcome: 'success', tags: [] }, ...state.history],
      }
    }
  })

  it('does not return an empty list when the only rule was just used', () => {
    const script = getScript('dawnmere')
    const singleActionScript = {
      ...script,
      maps: [],
      world: { ...script.world, seedState: { ...script.world.seedState, suggestedActions: [script.world.seedState.suggestedActions[0]] } },
    }
    const state = buildInitialState(singleActionScript)
    const action = state.suggestedActions[0]
    const nextState = { ...state, history: [{ id: 'test-used', actionId: action.id, ruleId: action.ruleId, date: '', title: action.title, body: '', outcome: 'success' as const, tags: [] }] }

    expect(generateSuggestedActions(nextState, singleActionScript)).toHaveLength(1)
  })

  it('keeps exploration actions available without leaking undiscovered place names', () => {
    const script = getScript('western-world')
    const state = buildNewLifeState(script, { mapId: 'mist-town', ageStage: 'adult', player: { name: '未知地点行动测试' } })
    const actions = generateSuggestedActions(state, script)
    const copy = actions.map((action) => `${action.title} ${action.description} ${action.location}`).join(' ')

    expect(actions.some((action) => action.ruleId === 'market')).toBe(true)
    expect(copy).not.toContain('晨雾集市')
    expect(copy).not.toContain('奥伦铁匠铺')
    expect(copy).not.toContain('北坡雾林')
    expect(actions.filter((action) => action.location === '未知方向').length).toBeGreaterThan(0)
  })

  it('does not name an NPC before the player has met them', () => {
    const script = getScript('western-world')
    const state = buildNewLifeState(script, { mapId: 'mist-town', ageStage: 'adult', player: { name: '未知人物行动测试' } })
    state.locations = state.locations.map((location) => location.id === 'market' ? { ...location, discovered: true } : location)
    const actions = generateSuggestedActions(state, script)
    const marketAction = actions.find((action) => action.ruleId === 'market')

    expect(marketAction?.title).toBe('在集市看看')
    expect(`${marketAction?.title} ${marketAction?.description}`).not.toContain('米拉')
  })
})
