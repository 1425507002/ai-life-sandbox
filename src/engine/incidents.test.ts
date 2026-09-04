import { describe, expect, it } from 'vitest'
import { getScript } from '../data/scripts'
import { buildInitialState } from './actionEngine'
import { queueIncidentCandidate, validateIncidentCandidate, validateScheduledEvent } from './incidents'

describe('incident candidates', () => {
  it('accepts a bounded candidate and schedules it without applying direct state changes', () => {
    const state = buildInitialState(getScript('western-world'))
    const candidate = { title: '窗外传来三声铃', body: '夜风里传来三声短促的铃响，附近的人都停下了手里的事。', kind: 'encounter', tags: ['环境', '声音'], dueInTurns: 2 }

    expect(validateIncidentCandidate(candidate, state)).toBe(true)
    const queued = queueIncidentCandidate(state, candidate)
    expect(queued?.state.scheduledEvents).toHaveLength(1)
    expect(queued?.state.scheduledEvents?.[0].dueTurn).toBe(state.turn + 2)
    expect(queued?.state.player.money).toBe(state.player.money)
    expect(queued?.state.knownFacts).toEqual(state.knownFacts)
  })

  it('rejects invented NPCs and oversized relationship changes', () => {
    const state = buildInitialState(getScript('western-world'))
    expect(validateIncidentCandidate({ title: '陌生人来访', body: '有人站在门口。', kind: 'encounter', tags: [], npcId: 'invented' }, state)).toBe(false)
    expect(validateIncidentCandidate({ title: '关系突变', body: '一件小事改变了关系。', kind: 'opportunity', tags: [], relationshipDelta: 9 }, state)).toBe(false)
  })

  it('rejects imported events with unsafe timing or relationship deltas', () => {
    const state = buildInitialState(getScript('western-world'))
    expect(validateScheduledEvent({ id: 'bad', dueTurn: state.turn + 1, title: '结构损坏', body: '缺少 tags。', tags: [], npcId: 'mira', relationshipDelta: 999 }, state)).toBe(false)
    expect(validateScheduledEvent({ id: 'good', dueTurn: state.turn + 1, title: '一阵风', body: '窗外吹来一阵风。', tags: ['天气'] }, state)).toBe(true)
  })

  it('allows an incident to reveal only an existing undiscovered location', () => {
    const state = buildInitialState(getScript('western-world'))
    state.locations = state.locations.map((location) => ({ ...location, discovered: location.id === 'home' }))
    const candidate = { title: '有人提起北坡', body: '邻居说起北坡雾林最近长出了一批早春药草。', kind: 'opportunity', tags: ['传闻'], dueInTurns: 1, revealsLocationId: 'northwood' }

    expect(validateIncidentCandidate(candidate, state)).toBe(true)
    const queued = queueIncidentCandidate(state, candidate)
    expect(queued?.state.scheduledEvents?.[0].revealsLocationId).toBe('northwood')
    expect(queueIncidentCandidate(state, { ...candidate, revealsLocationId: 'invented-place' })).toBeNull()
  })
})
