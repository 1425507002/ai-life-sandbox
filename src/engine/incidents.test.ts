import { describe, expect, it } from 'vitest'
import { getScript } from '../data/scripts'
import { buildInitialState, buildNewLifeState } from './actionEngine'
import { queueIncidentCandidate, validateIncidentCandidate, validateScheduledEvent } from './incidents'

describe('incident candidates', () => {
  it('accepts a bounded candidate and schedules it without applying direct state changes', () => {
    const script = getScript('western-world')
    const state = buildInitialState(script)
    const candidate = { title: '窗外传来三声铃', body: '夜风里传来三声短促的铃响，附近的人都停下了手里的事。', kind: 'encounter', tags: ['环境', '声音'], dueInTurns: 2 }

    expect(validateIncidentCandidate(candidate, state, script)).toBe(true)
    const queued = queueIncidentCandidate(state, candidate, 8, script)
    expect(queued?.state.scheduledEvents).toHaveLength(1)
    expect(queued?.state.scheduledEvents?.[0].dueTurn).toBe(state.turn + 2)
    expect(queued?.state.player.money).toBe(state.player.money)
    expect(queued?.state.knownFacts).toEqual(state.knownFacts)
  })

  it('rejects invented NPCs and oversized relationship changes', () => {
    const script = getScript('western-world')
    const state = buildInitialState(script)
    expect(validateIncidentCandidate({ title: '陌生人来访', body: '有人站在门口。', kind: 'encounter', tags: [], npcId: 'invented' }, state, script)).toBe(false)
    expect(validateIncidentCandidate({ title: '关系突变', body: '一件小事改变了关系。', kind: 'opportunity', tags: [], relationshipDelta: 9 }, state, script)).toBe(false)
  })

  it('rejects imported events with unsafe timing or relationship deltas', () => {
    const script = getScript('western-world')
    const state = buildInitialState(script)
    expect(validateScheduledEvent({ id: 'bad', dueTurn: state.turn + 1, title: '结构损坏', body: '缺少 tags。', tags: [], npcId: 'mira', relationshipDelta: 999 }, state, script)).toBe(false)
    expect(validateScheduledEvent({ id: 'good', dueTurn: state.turn + 1, title: '一阵风', body: '窗外吹来一阵风。', tags: ['天气'] }, state, script)).toBe(true)
  })

  it('allows an incident to reveal only an existing undiscovered location', () => {
    const script = getScript('western-world')
    const state = buildInitialState(script)
    state.locations = state.locations.map((location) => ({ ...location, discovered: location.id === 'home' }))
    const candidate = { title: '有人提起北坡', body: '邻居说起北坡雾林最近长出了一批早春药草。', kind: 'opportunity', tags: ['传闻'], dueInTurns: 1, revealsLocationId: 'northwood' }

    expect(validateIncidentCandidate(candidate, state, script)).toBe(true)
    const queued = queueIncidentCandidate(state, candidate, 8, script)
    expect(queued?.state.scheduledEvents?.[0].revealsLocationId).toBe('northwood')
    expect(queueIncidentCandidate(state, { ...candidate, revealsLocationId: 'home' }, 8, script)).toBeNull()
    expect(queueIncidentCandidate(state, { ...candidate, revealsLocationId: 'invented-place' }, 8, script)).toBeNull()
  })

  it('does not let an AI event reveal an unauthorized location or unknown NPC', () => {
    const script = getScript('western-world')
    const state = buildNewLifeState(script, { mapId: 'mist-town', ageStage: 'adult', player: { name: '事件边界测试' } })

    expect(validateIncidentCandidate({ title: '陌生人送信', body: '有人捎来一封没有署名的信。', kind: 'encounter', tags: [], npcId: 'mira' }, state, script)).toBe(false)
    expect(validateIncidentCandidate({ title: '凭空出现的地方', body: '传闻提到一个没有登记在地图上的地方。', kind: 'opportunity', tags: [], revealsLocationId: 'home' }, state, script)).toBe(false)
    expect(validateScheduledEvent({ id: 'unknown-npc', dueTurn: 1, title: '陌生人事件', body: '不应该让陌生人直接进入关系。', tags: [], npcId: 'mira' }, state, script)).toBe(false)
  })
})
