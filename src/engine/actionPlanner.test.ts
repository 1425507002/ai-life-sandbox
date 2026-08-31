import { describe, expect, it } from 'vitest'
import { getActionOptions } from './actionPlanner'
import { buildInitialState } from './actionEngine'
import { getScript } from '../data/scripts'

describe('action planner', () => {
  const script = getScript('dawnmere')

  it('keeps guided mode choice-first with a compact set', () => {
    const state = buildInitialState(script)

    expect(getActionOptions(state, 'guided')).toHaveLength(3)
  })

  it('rotates varied suggestions with world progress', () => {
    const state = buildInitialState(script)
    const options = getActionOptions(state, 'varied')
    const offset = state.turn % state.suggestedActions.length

    expect(options).toHaveLength(state.suggestedActions.length)
    expect(options[0].id).toBe(state.suggestedActions[offset].id)
  })

  it('can rotate the attention order without advancing the world', () => {
    const state = buildInitialState(script)
    const first = getActionOptions(state, 'varied', 0)
    const next = getActionOptions(state, 'varied', 1)

    expect(next[0].id).not.toBe(first[0].id)
  })

  it('keeps every option available in freeform mode', () => {
    const state = buildInitialState(script)

    expect(getActionOptions(state, 'freeform').map((action) => action.id)).toEqual(state.suggestedActions.map((action) => action.id))
  })
})
